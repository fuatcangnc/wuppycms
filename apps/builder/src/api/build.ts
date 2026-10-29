// "With AI" yeni site üretimi — public Astro template repo'sundan yeni bir
// GitHub reposu üretir, marka/renk token'larını uygular ve projeyi bağlar.
// Ajan brief'i istemcide saklanır; burada yalnızca iskelet + token'lar kurulur.

import { Hono } from "hono";
import { commitFiles, getFile, getRepo } from "../lib/git";
import { getInstallationToken } from "../lib/git/github/app";
import {
	ensurePagesProject,
	pagesConfigured,
	triggerPagesDeployment,
} from "../lib/deploy/cloudflare-pages";
import { listInstallations } from "../lib/git/github/installations";
import { createRepoFromTemplate, getViewer } from "../lib/git/github/repo";
import type { AppEnv } from "./types";
import { platform, requireUser, resolveOAuthToken, unauthorized } from "./helpers";
import { body, buildSiteSchema } from "./schemas";

const build = new Hono<{ Bindings: AppEnv }>();

async function readTemplateFile(
	token: string,
	fullName: string,
	path: string,
	branch: string,
): Promise<{ path: string; sha: string; content: string }> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 15; attempt += 1) {
		try {
			return await getFile(token, fullName, path, branch);
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 700));
		}
	}
	throw lastError instanceof Error ? lastError : new Error(`Template dosyası okunamadı: ${path}`);
}

function darken(hex: string, amount = 0.12): string {
	const value = hex.replace("#", "");
	const r = Math.max(0, Math.round(parseInt(value.slice(0, 2), 16) * (1 - amount)));
	const g = Math.max(0, Math.round(parseInt(value.slice(2, 4), 16) * (1 - amount)));
	const b = Math.max(0, Math.round(parseInt(value.slice(4, 6), 16) * (1 - amount)));
	return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

build.post("/site", body(buildSiteSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured", message: "D1 bağlı değil." }, 503);

	const payload = c.req.valid("json");
	const template = c.env.SITE_TEMPLATE_REPO || "fuatcangnc/wuppycms-tailwind-starter";
	const color = payload.color ?? "#dd641e";

	// Repo sahibi seçimi: istenen sahip bir GitHub App kurulumuysa installation
	// token'ı; değilse kullanıcının OAuth token'ı (kişisel hesapta repo açmak
	// OAuth ister). İki yol da yoksa kurulum istemeye yönlendir.
	const installations = await listInstallations(db, user.id);
	const wantedOwner = payload.owner?.trim().toLowerCase();
	const oauthToken = await resolveOAuthToken(c);
	const oauthViewer = oauthToken ? await getViewer(oauthToken).catch(() => null) : null;

	// İstenen sahip verilmemişse: OAuth kullanıcısının kendi kurulumu, yoksa
	// ilk kurulum. Böylece yalnız kurulumu olan kullanıcı da site üretebilir.
	const appInstallation = wantedOwner
		? installations.find((entry) => entry.accountLogin.toLowerCase() === wantedOwner)
		: oauthViewer
			? (installations.find(
					(entry) => entry.accountLogin.toLowerCase() === oauthViewer.login.toLowerCase(),
				) ?? installations[0])
			: installations[0];
	const appToken = appInstallation
		? await getInstallationToken(c.env, appInstallation.installationId).catch(() => null)
		: null;

	type Candidate = { token: string; owner: string };
	const candidates: Candidate[] = [];
	// Kişisel hesapta repo açmak OAuth kullanıcı token'ı ister; GitHub App
	// installation token'ı org depoları içindir. Bu yüzden OAuth eşleşiyorsa
	// önce o denenir, sonra kurulum.
	if (oauthToken && oauthViewer) {
		if (!wantedOwner || oauthViewer.login.toLowerCase() === wantedOwner) {
			candidates.push({ token: oauthToken, owner: oauthViewer.login });
		}
	}
	if (appInstallation && appToken) {
		const sameAsOauth =
			oauthViewer?.login.toLowerCase() === appInstallation.accountLogin.toLowerCase();
		if (!sameAsOauth) {
			candidates.push({ token: appToken, owner: appInstallation.accountLogin });
		}
	}
	if (candidates.length === 0) {
		if (!oauthToken && installations.length === 0) return unauthorized(c);
		return c.json(
			{
				error: "owner_unavailable",
				message: payload.owner
					? `“${payload.owner}” için geçerli bir GitHub App kurulumu yok.`
					: "Site oluşturmak için GitHub App kurun ya da GitHub hesabıyla giriş yapın.",
			},
			400,
		);
	}

	// Şablon repo'suna erişimi olan adayla üret; olmazsa sıradakini dene.
	let generated: Awaited<ReturnType<typeof createRepoFromTemplate>> | null = null;
	let owner = candidates[0]!.owner;
	let token = candidates[0]!.token;
	let lastError: unknown;
	for (const candidate of candidates) {
		try {
			generated = await createRepoFromTemplate(candidate.token, template, {
				owner: candidate.owner,
				name: payload.repoName,
				description: payload.tagline,
				private: Boolean(payload.private),
			});
			owner = candidate.owner;
			token = candidate.token;
			break;
		} catch (error) {
			lastError = error;
		}
	}
	if (!generated) {
		throw lastError instanceof Error
			? lastError
			: new Error("Depo şablondan üretilemedi.");
	}

	let branch = generated.defaultBranch || "main";
	let repo = generated;
	for (let attempt = 0; attempt < 8; attempt += 1) {
		try {
			repo = await getRepo(token, generated.fullName);
			branch = repo.defaultBranch || branch;
			break;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	// Yayın hedefi: Cloudflare Pages. GitHub Actions kullanılmaz; proje
	// oluşturulamazsa site URL'siz kalır (yanlış bir adres yazmayız).
	let pagesTarget: Awaited<ReturnType<typeof ensurePagesProject>> | null = null;
	if (pagesConfigured(c.env)) {
		try {
			pagesTarget = await ensurePagesProject(c.env, db, {
				repoFullName: repo.fullName,
				branch,
			});
		} catch (error) {
			console.warn("[build] Cloudflare Pages projesi kurulamadı:", error);
		}
	}
	const deployUrl: string | null = pagesTarget?.url ?? null;

	const files: { path: string; content: string }[] = [];

	// site.ts — marka/tagline/description/iletişim/GitHub bağlantısı.
	const siteFile = await readTemplateFile(token, repo.fullName, "src/data/site.ts", branch);
	let site = siteFile.content;
	site = site.replace(/brandName:\s*"[^"]*"/, `brandName: ${JSON.stringify(payload.siteName)}`);
	site = site.replace(/tagline:\s*"[^"]*"/, `tagline: ${JSON.stringify(payload.tagline)}`);
	site = site.replace(/description:\s*"[^"]*"/, `description: ${JSON.stringify(payload.prompt.slice(0, 300))}`);
	site = site.replace(/email:\s*"[^"]*"/, 'email: "hello@example.com"');
	site = site.replace(/github:\s*"[^"]*"/, `github: ${JSON.stringify(repo.htmlUrl)}`);
	files.push({ path: "src/data/site.ts", content: site });

	// Astro `site` — Cloudflare Pages kökte yayınlar; base gerekmez.
	try {
		const configFile = await readTemplateFile(token, repo.fullName, "astro.config.mjs", branch);
		const config = pagesTarget
			? configFile.content.replace(
					/export default defineConfig\(\{/,
					`export default defineConfig({\n\tsite: ${JSON.stringify(pagesTarget.url)},`,
				)
			: configFile.content;
		files.push({ path: "astro.config.mjs", content: config });
	} catch {
		// config yoksa atla
	}

	// Tasarım sistemi primary rengi.
	const cssFile = await readTemplateFile(token, repo.fullName, "src/styles/global.css", branch);
	let css = cssFile.content;
	css = css.replace(/--primary:\s*#[0-9a-f]{6};/i, `--primary: ${color};`);
	css = css.replace(/--primary-dark:\s*#[0-9a-f]{6};/i, `--primary-dark: ${darken(color)};`);
	css = css.replace(/--color-primary:\s*#[0-9a-f]{6};/i, `--color-primary: ${color};`);
	css = css.replace(/--color-primary-dark:\s*#[0-9a-f]{6};/i, `--color-primary-dark: ${darken(color)};`);
	files.push({ path: "src/styles/global.css", content: css });

	// Site başlığı — admin boot bu dosyadan okur.
	try {
		const sitesFile = await readTemplateFile(token, repo.fullName, ".wuppycms/sites.jsonc", branch);
		let sites = sitesFile.content.replace(/"name":\s*"[^"]*"/, `"name": ${JSON.stringify(payload.siteName)}`);
		// Eski/özel şablonlarda `name` yoksa `title` alanını kanonik şemaya taşı.
		if (!/"name"\s*:/.test(sites)) {
			sites = sites.replace(/"title":\s*"[^"]*"/, `"name": ${JSON.stringify(payload.siteName)}`);
		}
		if (!/"version"\s*:/.test(sites)) {
			sites = sites.replace(/^\s*\{/, `{\n\t"version": 1,`);
		}
		if (deployUrl) {
			sites = sites.replace(
				/("name":\s*"[^"]*",)/,
				`$1\n\t\t\t"url": ${JSON.stringify(deployUrl)},`,
			);
		}
		files.push({ path: ".wuppycms/sites.jsonc", content: sites });
	} catch {
		// eski template'lerde dosya yoksa atla
	}

	await commitFiles(
		token,
		repo.fullName,
		branch,
		files,
		`Build with AI: ${payload.siteName} (via WuppyCMS)`,
	);

	// Cloudflare bağlı depoyu kendi build runner'ında derler; tetikleme
	// başarısız olsa da push webhook'u bir sonraki fırsatta derler.
	if (pagesTarget) {
		await triggerPagesDeployment(c.env, db, pagesTarget.projectName, branch);
	}

	const existing = await db
		.prepare("SELECT id FROM projects WHERE user_id = ? AND repo_full_name = ?")
		.bind(user.id, repo.fullName)
		.first<{ id: string }>();
	let projectId = existing?.id;
	if (projectId) {
		await db
			.prepare("UPDATE projects SET name = ?, default_branch = ?, updated_at = datetime('now') WHERE id = ?")
			.bind(payload.siteName, branch, projectId)
			.run();
	} else {
		projectId = crypto.randomUUID();
		await db
			.prepare(
				"INSERT INTO projects (id, user_id, name, repo_full_name, default_branch) VALUES (?, ?, ?, ?, ?)",
			)
			.bind(projectId, user.id, payload.siteName, repo.fullName, branch)
			.run();
	}

	return c.json({
		id: projectId,
		name: payload.siteName,
		repoFullName: repo.fullName,
		branch,
		color,
		url: deployUrl,
	});
});

export { build };
