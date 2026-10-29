// Site API'si — sihirbazın "Reading your repository…" adımı ve Configure
// sekmesinin sites.jsonc kaydı. Keşif repoda, sonuçta kopya tutulmaz.

import { Hono } from "hono";
import {
	SITES_CONFIG_PATH,
	validateSitesFile,
	type SiteConfigEntry,
	type SitesFile,
	type SitesValidationIssue,
} from "@wuppycms/shared";
import { CONTENT_CONFIG_PATH, parseContentConfig } from "@wuppycms/content-schema";
import { commitFiles, getFile, getRepo, BackendError, listTree } from "../lib/git";
import type { AppEnv } from "./types";
import { requireQuery, requireUser, resolveGitToken, unauthorized } from "./helpers";
import { body, siteConfigSchema } from "./schemas";

export const site = new Hono<{ Bindings: AppEnv }>();

const ASTRO_CONFIG_RE = /^astro\.config\.(mjs|cjs|js|ts|mts)$/;

/** JSONC → JSON: yorum satırlarını atar (bizim yazdığımız saf JSON'da no-op). */
function stripJsonComments(text: string): string {
	return text
		.replace(/\/\*[\s\S]*?\*\//g, "")
		.replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
}

/** sites.jsonc'yi şemayla okur — geçerli girdiler korunur, sorunlar raporlanır. */
function parseSitesFile(raw: string): { file: SitesFile | null; issues: SitesValidationIssue[] } {
	try {
		const parsed = JSON.parse(stripJsonComments(raw)) as unknown;
		const result = validateSitesFile(parsed);
		return { file: result.ok ? result.file : result.file.sites.length ? result.file : null, issues: result.issues };
	} catch {
		return { file: null, issues: [{ path: "", message: "sites.jsonc geçerli JSON değil." }] };
	}
}

// GET /api/site/scan?full_name=owner/repo — kurulum sihirbazının taraması.
site.get("/scan", async (c) => {
	const token = await resolveGitToken(c);
	if (!token) return unauthorized(c);
	const fullName = requireQuery(c, "full_name");
	const repo = await getRepo(token, fullName);
	const ref = repo.defaultBranch;

	const [tree, configFile, setupFile] = await Promise.all([
		listTree(token, fullName, ref, true),
		getFile(token, fullName, CONTENT_CONFIG_PATH, ref).catch(() => null),
		getFile(token, fullName, SITES_CONFIG_PATH, ref).catch(() => null),
	]);

	const paths = new Set(tree.entries.map((e) => e.path));
	const astroConfig = tree.entries.find(
		(e) => e.type === "blob" && ASTRO_CONFIG_RE.test(e.path),
	);

	let siteUrl: string | null = null;
	if (astroConfig) {
		try {
			const source = (await getFile(token, fullName, astroConfig.path, ref)).content;
			siteUrl = source.match(/site\s*:\s*["']([^"']+)["']/)?.[1] ?? null;
		} catch {
			// adres çıkmazsa sihirbaz boş doldurur
		}
	}

	const collections = (configFile ? parseContentConfig(configFile.content) : []).map(
		(collection) => ({
			...collection,
			entryCount: tree.entries.filter(
				(e) =>
					e.type === "blob" &&
					e.path.startsWith(`${collection.base}/`) &&
					e.path.endsWith(`.${collection.extension}`),
			).length,
		}),
	);

	const mediaCandidates = ["public", "src/assets", "static"];
	const media =
		mediaCandidates.find((folder) =>
			tree.entries.some((e) => e.type === "blob" && e.path.startsWith(`${folder}/`)),
		) ?? null;

	const setup = setupFile ? parseSitesFile(setupFile.content) : { file: null, issues: [] };

	return c.json({
		fullName: repo.fullName,
		ref,
		astro: Boolean(astroConfig) || paths.has("package.json"),
		astroConfigFound: Boolean(astroConfig),
		siteUrl,
		configFound: Boolean(configFile),
		collections,
		media,
		hasPublic: paths.has("public") || tree.entries.some((e) => e.path.startsWith("public/")),
		setup: setup.file,
		setupIssues: setup.issues,
		treeTruncated: tree.truncated,
	});
});

// PUT /api/site/config — { full_name, sites } → .wuppycms/sites.jsonc commit'i.
site.put("/config", body(siteConfigSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const token = await resolveGitToken(c);
	if (!token) return unauthorized(c);

	const payload = c.req.valid("json");
	const fullName = payload.full_name;
	const sites = payload.sites as SiteConfigEntry[];
	const validation = validateSitesFile({ version: 1, sites });
	if (!validation.ok) {
		return c.json(
			{
				error: "invalid",
				message: `sites.jsonc doğrulanamadı: ${validation.issues
					.map((issue) => `${issue.path || "kök"}: ${issue.message}`)
					.join(" · ")}`,
				issues: validation.issues,
			},
			400,
		);
	}

	const repo = await getRepo(token, fullName);
	const existing = await getFile(token, fullName, SITES_CONFIG_PATH, repo.defaultBranch).catch(
		(error) => {
			if (error instanceof BackendError && error.status === 404) return null;
			throw error;
		},
	);

	const file: SitesFile = validation.file;
	const result = await commitFiles(
		token,
		repo.fullName,
		repo.defaultBranch,
		[{ path: SITES_CONFIG_PATH, content: `${JSON.stringify(file, null, 2)}\n` }],
		existing
			? "wuppycms: update site config (via WuppyCMS)"
			: `wuppycms: initialize site config for ${fullName} (via WuppyCMS)`,
	);
	if (!result) return c.json({ error: "no_changes", message: "Yapılandırma zaten güncel." }, 409);
	return c.json(result);
});
