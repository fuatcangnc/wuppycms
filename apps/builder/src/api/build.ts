// "With AI" yeni site üretimi — public Astro template repo'sundan yeni bir
// GitHub reposu üretir, marka/renk token'larını uygular ve projeyi bağlar.
// Ajan brief'i istemcide saklanır; burada yalnızca iskelet + token'lar kurulur.

import { Hono } from "hono";
import { commitFiles, getFile, getRepo } from "../lib/git";
import { createRepoFromTemplate, enablePages, getViewer } from "../lib/git/github/repo";
import type { AppEnv } from "./types";
import { platform, requireUser, resolveGitToken, unauthorized } from "./helpers";
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
	const token = await resolveGitToken(c);
	if (!token) return unauthorized(c);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured", message: "D1 bağlı değil." }, 503);

	const payload = c.req.valid("json");
	const viewer = await getViewer(token);
	const template = c.env.SITE_TEMPLATE_REPO || "fuatcangnc/wuppycms-tailwind-starter";
	const color = payload.color ?? "#dd641e";

	const generated = await createRepoFromTemplate(token, template, {
		owner: viewer.login,
		name: payload.repoName,
		description: payload.tagline,
		private: Boolean(payload.private),
	});

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

	const files: { path: string; content: string }[] = [];
	const repoName = repo.fullName.split("/").pop() ?? payload.repoName;
	const isUserSite = repoName.toLowerCase() === `${viewer.login.toLowerCase()}.github.io`;
	const pagesBase = isUserSite ? "/" : `/${repoName}/`;
	const pagesUrl = isUserSite
		? `https://${viewer.login}.github.io/`
		: `https://${viewer.login}.github.io/${repoName}/`;
	const pagesEnabled = await enablePages(token, repo.fullName);

	// site.ts — marka/tagline/description/iletişim/GitHub bağlantısı.
	const siteFile = await readTemplateFile(token, repo.fullName, "src/data/site.ts", branch);
	let site = siteFile.content;
	site = site.replace(/brandName:\s*"[^"]*"/, `brandName: ${JSON.stringify(payload.siteName)}`);
	site = site.replace(/tagline:\s*"[^"]*"/, `tagline: ${JSON.stringify(payload.tagline)}`);
	site = site.replace(/description:\s*"[^"]*"/, `description: ${JSON.stringify(payload.prompt.slice(0, 300))}`);
	site = site.replace(/email:\s*"[^"]*"/, 'email: "hello@example.com"');
	site = site.replace(/github:\s*"[^"]*"/, `github: ${JSON.stringify(repo.htmlUrl)}`);
	files.push({ path: "src/data/site.ts", content: site });

	// Astro Pages base/site — GitHub Pages alt yolunda doğru linkler için.
	try {
		const configFile = await readTemplateFile(token, repo.fullName, "astro.config.mjs", branch);
		const config = configFile.content.replace(
			/export default defineConfig\(\{/,
			`export default defineConfig({\n\tsite: ${JSON.stringify(`https://${viewer.login}.github.io`)},\n\tbase: ${JSON.stringify(pagesBase)},`,
		);
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
		if (pagesEnabled) {
			sites = sites.replace(
				/("name":\s*"[^"]*",)/,
				`$1\n\t\t\t"url": ${JSON.stringify(pagesUrl)},`,
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
	});
});

export { build };
