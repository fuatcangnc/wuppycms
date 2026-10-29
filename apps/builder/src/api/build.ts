// "With AI" yeni site üretimi — public Astro template repo'sundan yeni bir
// GitHub reposu üretir, marka/renk token'larını uygular ve projeyi bağlar.
// Ajan brief'i istemcide saklanır; burada yalnızca iskelet + token'lar kurulur.

import { Hono } from "hono";
import { commitFiles, getFile, getRepo, listTree } from "../lib/git";
import { getInstallationToken } from "../lib/git/github/app";
import {
	ensurePagesProject,
	pagesConfigured,
	triggerPagesDeployment,
} from "../lib/deploy/cloudflare-pages";
import { listInstallations } from "../lib/git/github/installations";
import { listSiteTemplates, resolveSiteTemplate } from "../lib/build/templates";
import {
	formatAnswers,
	generateQuestions,
	generateSiteContent,
	type QuestionAnswer,
	type SiteContent,
} from "../lib/build/interview";
import { resolveAiConfig } from "./agent";
import { createRepoFromTemplate, getViewer } from "../lib/git/github/repo";
import type { AppEnv } from "./types";
import { platform, requireUser, resolveOAuthToken, unauthorized } from "./helpers";
import { body, buildQuestionsSchema, buildSiteSchema } from "./schemas";

const build = new Hono<{ Bindings: AppEnv }>();

// GET /api/build/templates — With AI şablon seçimi (görselli kartlar).
build.get("/templates", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	return c.json({ templates: listSiteTemplates(c.env) });
});

// POST /api/build/questions — brief'e göre İŞE ÖZEL netleştirici sorular
// (EmDash Build'in `ask_questions` deseni). Model çalışmazsa boş liste döner
// ve istemci doğrudan tasarım adımına geçebilir.
build.post("/questions", body(buildQuestionsSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const config = await resolveAiConfig(c, user.id);
	if (!config) {
		return c.json({ questions: [], reason: "ai_not_configured" });
	}
	const template = resolveSiteTemplate(c.env, payload.template);
	try {
		const questions = await generateQuestions(config, {
			brief: payload.prompt,
			siteName: payload.siteName,
			templateName: template.name,
		});
		return c.json({ questions });
	} catch (error) {
		console.warn("[build] sorular üretilemedi:", error);
		return c.json({ questions: [], reason: "provider_failed" });
	}
});

async function readTemplateFile(
	token: string,
	fullName: string,
	path: string,
	branch: string,
): Promise<{ path: string; sha: string; content: string }> {
	let lastError: unknown;
	// GitHub şablon üretimi büyük repolarda geç yayılır; 30 sn'ye kadar bekle.
	for (let attempt = 0; attempt < 30; attempt += 1) {
		try {
			return await getFile(token, fullName, path, branch);
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 1000));
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

/** Şablonun sabit marka metinlerini site adıyla değiştirir (tek commit). */
async function rebrandTemplate(
	token: string,
	fullName: string,
	branch: string,
	siteName: string,
): Promise<number> {
	const PLACEHOLDER = "Yeni Site";
	const TEXT_EXT = /\.(astro|mdx?|json|ts|html)$/i;
	const SKIP = /^(public|node_modules|dist|\.astro|pnpm-lock\.yaml)/;
	const tree = await listTree(token, fullName, branch, true);
	const candidates = tree.entries
		.filter(
			(entry) =>
				entry.type === "blob" &&
				TEXT_EXT.test(entry.path) &&
				!SKIP.test(entry.path) &&
				(entry.size ?? 0) < 200_000,
		)
		.slice(0, 80);

	const changed: { path: string; content: string }[] = [];
	for (const entry of candidates) {
		try {
			const file = await getFile(token, fullName, entry.path, branch);
			if (!file.content.includes(PLACEHOLDER)) continue;
			changed.push({
				path: entry.path,
				content: file.content.split(PLACEHOLDER).join(siteName),
			});
		} catch {
			// okunamayan dosya atlanır
		}
	}
	if (!changed.length) return 0;
	await commitFiles(
		token,
		fullName,
		branch,
		changed,
		`chore: marka metinleri ${siteName} (via WuppyCMS)`,
	);
	return changed.length;
}

build.post("/site", body(buildSiteSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured", message: "D1 bağlı değil." }, 503);

	const payload = c.req.valid("json");
	const template = resolveSiteTemplate(c.env, payload.template);
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
	// Yeni oluşturulan template repoları eski cache'lenmiş token'da görünmez;
	// repo üretiminden önce taze installation token'ı al.
	const appToken = appInstallation
		? await getInstallationToken(c.env, appInstallation.installationId, { refresh: true }).catch(
				() => null,
			)
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
			generated = await createRepoFromTemplate(candidate.token, template.repo, {
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

	// Repo iskeleti hazır olmadan dosya okumaya çalışma: package.json görünene
	// kadar bekle (büyük şablonlarda generate birkaç saniye sürebilir).
	try {
		await readTemplateFile(token, generated.fullName, "package.json", generated.defaultBranch || "main");
	} catch {
		// package.json yoksa aşağıdaki okumalar kendi hatasını verir
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
	// Admin önizlemesi aynı origin'deki proxy'den geçer (pages.dev bazı
	// ağlarda engelli). Kanonik site adresi yine Pages URL'sidir.
	const previewOrigin = (c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin).replace(/\/+$/, "");
	const previewUrl = pagesTarget ? `${previewOrigin}/preview/${pagesTarget.projectName}/` : null;

	// İçerik: brief + dinamik cevaplardan işe özel metinler üretilir. Model
	// yoksa/başarısızsa şablonun kendi içeriği kalır (site yine kurulur).
	const answers: QuestionAnswer[] = Array.isArray(payload.answers)
		? payload.answers
		: Object.entries(payload.answers ?? {}).map(([question, value]) => ({
				question,
				selected: [],
				custom: value,
			}));
	let siteContent: SiteContent | null = null;
	const aiConfig = await resolveAiConfig(c, user.id);
	if (aiConfig) {
		try {
			siteContent = await generateSiteContent(aiConfig, {
				brief: payload.prompt,
				siteName: payload.siteName,
				tagline: payload.tagline,
				templateName: template.name,
				answers,
			});
		} catch (error) {
			console.warn("[build] içerik üretilemedi:", error);
		}
	}

	const files: { path: string; content: string }[] = [];

	// Marka bilgisi — iki şablon ailesi de desteklenir:
	//  - Starter: `src/data/site.ts` içindeki alanlar,
	//  - Karakas: `src/data/site-settings.json`.
	try {
		const siteFile = await readTemplateFile(token, repo.fullName, "src/data/site.ts", branch);
		let site = siteFile.content;
		site = site.replace(/brandName:\s*"[^"]*"/, `brandName: ${JSON.stringify(payload.siteName)}`);
		site = site.replace(/tagline:\s*"[^"]*"/, `tagline: ${JSON.stringify(payload.tagline)}`);
		site = site.replace(/description:\s*"[^"]*"/, `description: ${JSON.stringify(payload.prompt.slice(0, 300))}`);
		site = site.replace(/email:\s*"[^"]*"/, 'email: "hello@example.com"');
		site = site.replace(/github:\s*"[^"]*"/, `github: ${JSON.stringify(repo.htmlUrl)}`);
		files.push({ path: "src/data/site.ts", content: site });
	} catch {
		// site.ts yoksa JSON ayarları denenir
	}
	try {
		const settingsFile = await readTemplateFile(
			token,
			repo.fullName,
			"src/data/site-settings.json",
			branch,
		);
		const settings = JSON.parse(settingsFile.content) as Record<string, unknown>;
		settings.brandName = payload.siteName;
		settings.email = "hello@example.com";
		settings.heroDescription = siteContent?.heroDescription || payload.tagline;
		if (siteContent) {
			settings.heroEyebrow = siteContent.heroEyebrow || settings.heroEyebrow;
			settings.heroTitle = siteContent.heroTitle || settings.heroTitle;
		}
		files.push({
			path: "src/data/site-settings.json",
			content: `${JSON.stringify(settings, null, 2)}\n`,
		});
	} catch {
		// JSON ayar dosyası yoksa atla
	}

	if (siteContent) {
		try {
			// Şablonun kendi içerik dosyaları varsa üzerine yaz; yoksa ekle.
			const contentFile = await getFile(
				token,
				repo.fullName,
				"src/data/content.json",
				branch,
			).catch(() => null);
			const nextContent = {
				...(contentFile ? (JSON.parse(contentFile.content) as Record<string, unknown>) : {}),
				industry: siteContent.industry,
				automotive: siteContent.automotive,
				heroEyebrow: siteContent.heroEyebrow,
				heroTitle: siteContent.heroTitle,
				heroDescription: siteContent.heroDescription,
				highlights: siteContent.highlights,
				metrics: siteContent.metrics,
				aboutTitle: siteContent.aboutTitle,
				aboutText: siteContent.aboutText,
				categories: siteContent.categories,
				services: siteContent.services,
				faq: siteContent.faq,
				ctaLabel: siteContent.ctaLabel,
			};
			files.push({
				path: "src/data/content.json",
				content: `${JSON.stringify(nextContent, null, 2)}\n`,
			});

			// Kartlar ve detay sayfaları `services.json` üzerinden çalışır.
			let icons = ["wrench", "settings", "thermometer", "shield-check", "truck", "clock"];
			try {
				const prevServices = await getFile(
					token,
					repo.fullName,
					"src/data/services.json",
					branch,
				);
				const parsed = JSON.parse(prevServices.content) as {
					services?: Array<{ icon?: string }>;
				};
				const used = (parsed.services ?? [])
					.map((entry) => entry.icon)
					.filter((icon): icon is string => Boolean(icon));
				if (used.length) icons = [...used, ...icons];
			} catch {
				// ilk kurulum: varsayılan ikonlar
			}
			files.push({
				path: "src/data/services.json",
				content: `${JSON.stringify(
					{
						services: siteContent.services.map((service, index) => ({
							category: service.category,
							featured: index < 3,
							icon: icons[index % icons.length],
							order: index + 1,
							shortTitle: service.shortTitle,
							slug: service.slug,
							summary: service.summary,
							title: service.title,
							image: "",
						})),
					},
					null,
					2,
				)}\n`,
			});
		} catch (error) {
			console.warn("[build] içerik dosyaları yazılamadı:", error);
		}
	}

	// Astro `site` — varsa mevcut değeri değiştir, yoksa ekle.
	try {
		const configFile = await readTemplateFile(token, repo.fullName, "astro.config.mjs", branch);
		let config = configFile.content;
		if (pagesTarget) {
			const siteLine = `site: ${JSON.stringify(pagesTarget.url)}`;
			if (/site:\s*["'][^"']*["']/.test(config)) {
				config = config.replace(/site:\s*["'][^"']*["']/, siteLine);
			} else {
				config = config.replace(
					/export default defineConfig\(\{/,
					`export default defineConfig({\n\t${siteLine},`,
				);
			}
		}
		files.push({ path: "astro.config.mjs", content: config });
	} catch {
		// config yoksa atla
	}

	// Tasarım sistemi primary rengi.
	const cssFile = await readTemplateFile(token, repo.fullName, template.stylesPath, branch);
	let css = cssFile.content;
	css = css.replace(/--primary:\s*#[0-9a-f]{6};/i, `--primary: ${color};`);
	css = css.replace(/--primary-dark:\s*#[0-9a-f]{6};/i, `--primary-dark: ${darken(color)};`);
	css = css.replace(/--color-primary:\s*#[0-9a-f]{6};/i, `--color-primary: ${color};`);
	css = css.replace(/--color-primary-dark:\s*#[0-9a-f]{6};/i, `--color-primary-dark: ${darken(color)};`);
	files.push({ path: template.stylesPath, content: css });

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
		if (previewUrl) {
			sites = sites.replace(
				/("name":\s*"[^"]*",)/,
				`$1\n\t\t\t"url": ${JSON.stringify(previewUrl)},`,
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

	// Marka geçişi: şablonun sabit metinlerinde (başlık, footer, yasal sayfalar)
	// kalan şablon adını site adıyla değiştir. Her dosyayı tek tek elle
	// düzenlemek yerine tek bir marka commit'i atılır.
	try {
		const replaced = await rebrandTemplate(token, repo.fullName, branch, payload.siteName);
		if (replaced > 0) {
			console.info(`[build] ${replaced} dosyada şablon adı güncellendi`);
		}
	} catch (error) {
		console.warn("[build] marka geçişi atlandı:", error);
	}

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
		previewUrl,
	});
});

export { build };
