// Zamanlanmış yayın yürütücüsü — ADR 0006: durumun tek kaynağı repo; bu uç
// yalnız `publishAt` zamanı gelmiş dokümanları "ready" yapar ve commit atar.
// Zamanlayıcı yürütücüdür, durum taşımaz: Cron Trigger (worker.ts scheduled)
// aynı `publishDue` fonksiyonunu çağırır; self-host kurulum kendi cron'uyla
// POST /api/schedule/run ucuna vurabilir.

import { Hono } from "hono";
import { parseDoc, serializeDoc } from "../lib/admin/frontmatter";
import { parseFrontmatterScalars } from "../lib/content/entry";
import { commitFiles, getFile, getRepo, listTree } from "../lib/git";
import { pickDueDocs, publishMessage } from "../lib/schedule";
import type { AppEnv } from "./types";
import { platform, requireUser, resolveGitToken, unauthorized } from "./helpers";
import { platformFromBindings } from "../lib/platform";
import { getInstallationToken } from "../lib/git/github/app";
import { installationForOwner, listInstallations } from "../lib/git/github/installations";
import { splitFullName } from "../lib/git/github/api";
import { body, scheduleRunSchema } from "./schemas";

export const schedule = new Hono<{ Bindings: AppEnv }>();

const TEXT_RE = /\.(mdx?|markdown)$/i;
const MAX_FILES = 200;
const MAX_SIZE = 200_000;

export type ScheduleRunResult = {
	repo: string;
	checked: number;
	published: string[];
	error?: string;
};

/** Tek repo için yürütücü — HTTP ucu ve Cron aynı fonksiyonu kullanır. */
export async function publishDue(
	token: string,
	fullName: string,
	branch: string,
	now: Date = new Date(),
): Promise<ScheduleRunResult> {
	const { entries } = await listTree(token, fullName, branch, true);
	const candidates = entries
		.filter((entry) => entry.type === "blob" && TEXT_RE.test(entry.path) && (entry.size ?? 0) < MAX_SIZE)
		.slice(0, MAX_FILES);

	// Adayları oku; "publishAt" içermeyen dosyalar hızlıca elenir.
	const files: { path: string; fm: Record<string, string>; raw: string }[] = [];
	for (let i = 0; i < candidates.length; i += 6) {
		const batch = candidates.slice(i, i + 6);
		const settled = await Promise.allSettled(batch.map((entry) => getFile(token, fullName, entry.path, branch)));
		settled.forEach((result, index) => {
			if (result.status !== "fulfilled") return;
			const raw = result.value.content;
			if (!raw.includes("publishAt")) return;
			files.push({ path: batch[index]!.path, fm: parseFrontmatterScalars(raw), raw });
		});
	}

	const published: string[] = [];
	for (const doc of pickDueDocs(files, now)) {
		const source = files.find((file) => file.path === doc.path)?.raw ?? "";
		const parsed = parseDoc(source);
		const order = parsed.order.includes("status") ? parsed.order : [...parsed.order, "status"];
		const values = new Map(parsed.values);
		values.set("status", doc.nextStatus);
		const slug = (doc.path.split("/").pop() ?? doc.path).replace(/\.\w+$/, "");
		await commitFiles(
			token,
			fullName,
			branch,
			[{ path: doc.path, content: serializeDoc(order, values, parsed.body) }],
			publishMessage(slug),
		);
		published.push(doc.path);
	}
	return { repo: fullName, checked: files.length, published };
}

// POST /api/schedule/run — { full_name? } verilirse tek repo; yoksa kullanıcının
// tüm projeleri. Elle çalıştırma + self-host cron yüzeyi.
schedule.post("/run", body(scheduleRunSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated", message: "Giriş gerekli." }, 401);
	const payload = c.req.valid("json");
	const token = await resolveGitToken(c, payload.full_name);
	if (!token) return unauthorized(c);
	const db = platform(c).db;

	const targets: { repo: string; branch: string }[] = [];
	if (payload.full_name) {
		const repo = await getRepo(token, payload.full_name);
		targets.push({ repo: repo.fullName, branch: repo.defaultBranch });
	} else if (db) {
		const { results } = await db.prepare(
			"SELECT repo_full_name, default_branch FROM projects WHERE user_id = ?",
		)
			.bind(user.id)
			.all<{ repo_full_name: string; default_branch: string }>();
		for (const row of results ?? []) {
			targets.push({ repo: row.repo_full_name, branch: row.default_branch });
		}
	}

	const runs: ScheduleRunResult[] = [];
	for (const target of targets) {
		// GitHub App kurulumu repoya özel olabilir; her hedef için yeniden çöz.
		const repoToken = payload.full_name ? token : ((await resolveGitToken(c, target.repo)) ?? token);
		try {
			runs.push(await publishDue(repoToken, target.repo, target.branch));
		} catch (error) {
			runs.push({
				repo: target.repo,
				checked: 0,
				published: [],
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return c.json({ runs });
});

/**
 * Cron yürütücüsü (worker.ts `scheduled`): tüm projeleri tarar.
 * Token: dev'de env.GITHUB_TOKEN, üretimde proje sahibinin bağlı token'ı.
 */
export async function runScheduled(env: AppEnv): Promise<ScheduleRunResult[]> {
	const db = platformFromBindings(env).db;
	if (!db) return [];
	const { results } = await db.prepare(
		"SELECT repo_full_name, default_branch, user_id FROM projects",
	).all<{ repo_full_name: string; default_branch: string; user_id: string }>();

	const runs: ScheduleRunResult[] = [];
	for (const row of results ?? []) {
		let token = env.GITHUB_TOKEN;
		if (!token) token = await installationTokenForRepo(env, db, row.user_id, row.repo_full_name);
		if (!token) {
			const { findGitHubToken } = await import("../lib/auth");
			token = (await findGitHubToken(db, row.user_id)) ?? undefined;
		}
		if (!token) {
			runs.push({ repo: row.repo_full_name, checked: 0, published: [], error: "token yok" });
			continue;
		}
		try {
			runs.push(await publishDue(token, row.repo_full_name, row.default_branch));
		} catch (error) {
			runs.push({
				repo: row.repo_full_name,
				checked: 0,
				published: [],
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return runs;
}

/**
 * Proje sahibinin, repo sahibine ait GitHub App kurulumu için token'ı.
 * Kurulum yoksa null döner (çağıran OAuth token'ına düşer).
 */
export async function installationTokenForRepo(
	env: AppEnv,
	db: import("../lib/platform").SqlDatabase,
	userId: string,
	repoFullName: string,
): Promise<string | undefined> {
	if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY_B64) return undefined;
	let installation = null;
	try {
		installation = await installationForOwner(db, userId, splitFullName(repoFullName).owner);
	} catch {
		installation = null;
	}
	if (!installation) {
		const all = await listInstallations(db, userId);
		installation = all[0] ?? null;
	}
	if (!installation) return undefined;
	try {
		return await getInstallationToken(env, installation.installationId);
	} catch {
		return undefined;
	}
}
