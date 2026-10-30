// Yayın onarımı — "yeniden yayınla".
//
// Bir site üretildiğinde Cloudflare Pages projesi kurulamazsa (kimlik hatası,
// ağ), repo URL'siz kalır ve önizleme çalışmaz. Bu uç, mevcut projeler için
// eksik Pages projesini kurar, adresleri repoya yazar ve deploy tetikler.
//
// Kimlik doğrulanmış kullanıcı yalnız kendi projelerini onarabilir.

import { Hono } from "hono";
import { z } from "zod";
import { getRepo } from "../lib/git";
import {
	ensurePagesProject,
	pagesConfigured,
	triggerPagesDeployment,
} from "../lib/deploy/cloudflare-pages";
import { writeSiteUrls } from "../lib/deploy/site-url";
import type { AppEnv } from "./types";
import { platform, requireUser, resolveGitToken, unauthorized } from "./helpers";
import { body } from "./schemas";

export const deploy = new Hono<{ Bindings: AppEnv }>();

const syncSchema = z.object({
	/** Boşsa kullanıcının tüm projeleri onarılır. */
	full_name: z
		.string()
		.trim()
		.regex(/^[^/\s]+\/[^/\s]+$/, "owner/repo biçiminde olmalı")
		.optional(),
});

export type DeploySyncResult = {
	repo: string;
	ok: boolean;
	url?: string;
	previewUrl?: string;
	created?: boolean;
	error?: string;
};

// GET /api/deploy/status — Pages yapılandırıldı mı?
deploy.get("/status", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	return c.json({ configured: pagesConfigured(c.env) });
});

// POST /api/deploy/sync — { full_name? }
deploy.post("/sync", body(syncSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);
	if (!pagesConfigured(c.env)) {
		return c.json(
			{
				error: "pages_not_configured",
				message:
					"Cloudflare Pages yapılandırılmadı. CLOUDFLARE_ACCOUNT_ID ve CLOUDFLARE_API_TOKEN ekleyin.",
			},
			503,
		);
	}

	const payload = c.req.valid("json");
	const rows = payload.full_name
		? [{ repo_full_name: payload.full_name, default_branch: "main" }]
		: ((
				await db
					.prepare(
						`SELECT p.repo_full_name, p.default_branch
						 FROM projects p
						 LEFT JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
						 WHERE p.user_id = ? OR m.user_id IS NOT NULL`,
					)
					.bind(user.id, user.id)
					.all<{ repo_full_name: string; default_branch: string }>()
			).results ?? []);

	const origin = (c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin).replace(/\/+$/, "");
	const results: DeploySyncResult[] = [];

	for (const row of rows) {
		const repo = row.repo_full_name;
		try {
			const token = await resolveGitToken(c, repo);
			if (!token) {
				results.push({ repo, ok: false, error: "GitHub bağlantısı yok" });
				continue;
			}
			// Varsayılan dalı repodan al (DB'de eski kalmış olabilir).
			const info = await getRepo(token, repo);
			const branch = info.defaultBranch || row.default_branch || "main";
			const target = await ensurePagesProject(c.env, db, {
				repoFullName: repo,
				branch,
			});
			const previewUrl = `${origin}/preview/${target.projectName}/`;
			await writeSiteUrls(token, repo, branch, {
				previewUrl,
				siteUrl: target.url,
			});
			await triggerPagesDeployment(c.env, db, target.projectName, branch);
			results.push({
				repo,
				ok: true,
				url: target.url,
				previewUrl,
				created: target.created,
			});
		} catch (error) {
			results.push({
				repo,
				ok: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return c.json({ results });
});
