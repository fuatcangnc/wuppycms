// Git API'si — Hono route'ları. Kimlik çözümü şimdilik tek adımlı:
// dev'de env.GITHUB_TOKEN; better-auth geldiğinde git_connections tablosundan
// şifreli token okunacak (bkz. lib/crypto.ts).

import { Hono } from "hono";
import type { CommitAuthor, CommitFile, RepoSummary } from "@wuppycms/shared";
import { createAuth, findGitHubToken } from "../lib/auth";
import {
	BackendError,
	commitFiles,
	compareCommits,
	getBranch,
	getFile,
	getRepo,
	listBranches,
	listCommits,
	listTree,
	listUserRepos,
	setGitHubApiBase,
} from "../lib/git";
import { listInstallationRepos } from "../lib/git/github/app";
import { claimInstallations, listInstallations } from "../lib/git/github/installations";
import type { AppEnv } from "./types";
import {
	platform,
	requireQuery,
	requireUser,
	resolveGitAuth,
	resolveGitToken,
	unauthorized,
} from "./helpers";
import { body, projectCreateSchema } from "./schemas";
import { content } from "./content";
import { media } from "./media";
import { schedule } from "./schedule";
import { site } from "./site";
import { team } from "./team";
import { ai } from "./ai";
import { agent } from "./agent";
import { pages } from "./pages";
import { review } from "./review";
import { build } from "./build";
import { githubApp } from "./github-app";
import { deploy } from "./deploy";
import { runScheduled } from "./schedule";
import { previewControl } from "./preview-control";

export const api = new Hono<{ Bindings: AppEnv }>();

// GitHub API kökünü her istekte bağlamadan uygula — ağsız E2E'de sahte
// sunucuya yönlendirmenin tek anahtarı (bkz. scripts/lib/mock-github.mjs).
api.use("*", async (c, next) => {
	setGitHubApiBase(c.env.GITHUB_API_BASE);
	await next();
});

api.get("/health", (c) =>
	c.json({ ok: true, service: "wuppycms-builder", time: new Date().toISOString() }),
);

// better-auth: /api/auth/* (giriş, kayıt, OAuth callback, oturum)
api.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

// ---------------------------------------------------------------------------
// Git route'ları
// ---------------------------------------------------------------------------

const git = new Hono<{ Bindings: AppEnv }>();

git.get("/repo", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const repo = await getRepo(token, fullName);
	return c.json(repo);
});

/**
 * Kullanıcının erişebildiği depolar: GitHub App kurulumları (varsa) ve
 * OAuth/geliştirme token'ı (varsa) birleşik, tekrarsız liste.
 */
git.get("/repos", async (c) => {
	const user = await requireUser(c);
	const db = platform(c).db;
	const byFullName = new Map<string, RepoSummary>();

	if (user && db) {
		const oauth = await findGitHubToken(db, user.id);
		if (oauth) await claimInstallations(c.env, db, user.id, oauth).catch(() => 0);
	}

	if (user && db && c.env.GITHUB_APP_ID && c.env.GITHUB_APP_PRIVATE_KEY_B64) {
		for (const installation of await listInstallations(db, user.id)) {
			try {
				for (const repo of await listInstallationRepos(c.env, installation.installationId)) {
					byFullName.set(repo.fullName, {
						fullName: repo.fullName,
						private: repo.private,
						defaultBranch: repo.defaultBranch,
						htmlUrl: repo.htmlUrl,
						description: repo.description,
						pushedAt: repo.pushedAt,
						source: "app" as const,
					});
				}
			} catch {
				// kurulum kaldırılmış ya da private key yok — atla
			}
		}
	}

	const auth = await resolveGitAuth(c);
	if (auth && auth.kind !== "app") {
		try {
			for (const repo of await listUserRepos(auth.token)) {
				if (!byFullName.has(repo.fullName)) byFullName.set(repo.fullName, repo);
			}
		} catch {
			// token süresi dolmuş olabilir — kurulum listesi yine dönsün
		}
	}

	// Hiç kimlik yoksa route sözleşmesi 401 kalır (Projects UI kurulum kartı
	// gösterir); kimlik varsa boş liste de geçerli yanıttır.
	if (!auth && byFullName.size === 0) return unauthorized(c);
	return c.json({ repos: [...byFullName.values()] });
});

git.get("/repo-info", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const repo = await getRepo(token, fullName);
	const branch = repo.defaultBranch;
	const exists = async (path: string) => {
		try {
			await getFile(token, fullName, path, branch);
			return true;
		} catch {
			return false;
		}
	};
	const [astroConfig, astroTs, packageRaw, contentConfig, sitesConfig] = await Promise.all([
		exists("astro.config.mjs"),
		exists("astro.config.ts"),
		getFile(token, fullName, "package.json", branch).catch(() => null),
		exists("src/content.config.ts"),
		exists(".wuppycms/sites.jsonc"),
	]);
	let astro = astroConfig || astroTs;
	if (!astro && packageRaw) {
		try {
			const pkg = JSON.parse(packageRaw.content) as {
				dependencies?: Record<string, string>;
				devDependencies?: Record<string, string>;
			};
			astro = Boolean(pkg.dependencies?.astro || pkg.devDependencies?.astro);
		} catch {
			astro = false;
		}
	}
	return c.json({
		fullName: repo.fullName,
		defaultBranch: branch,
		private: repo.private,
		htmlUrl: repo.htmlUrl,
		astro,
		wuppy: contentConfig,
		sitesConfig,
	});
});

git.get("/branches", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const branches = await listBranches(token, fullName);
	return c.json({ branches });
});

git.get("/branch", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const branch = await getBranch(token, fullName, requireQuery(c, "branch"));
	return c.json(branch);
});

git.get("/tree", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	let ref = c.req.query("ref");
	if (!ref) {
		ref = (await getRepo(token, fullName)).defaultBranch;
	}
	const recursive = c.req.query("recursive") !== "0";
	const result = await listTree(token, fullName, ref, recursive);
	return c.json({ ref, ...result });
});

git.get("/file", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const file = await getFile(
		token,
		fullName,
		requireQuery(c, "path"),
		c.req.query("ref"),
	);
	return c.json(file);
});

git.get("/compare", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const result = await compareCommits(
		token,
		fullName,
		requireQuery(c, "base"),
		requireQuery(c, "head"),
	);
	return c.json(result);
});

type CommitBody = {
	full_name?: string;
	branch?: string;
	message?: string;
	files?: CommitFile[];
	author?: CommitAuthor;
	co_author?: CommitAuthor;
};

git.post("/commit", async (c) => {
	let body: CommitBody;
	try {
		body = await c.req.json<CommitBody>();
	} catch {
		throw new BackendError(400, "Gövde JSON olmalı.");
	}
	if (!body.full_name || !body.branch || !Array.isArray(body.files)) {
		throw new BackendError(400, "full_name, branch ve files zorunludur.");
	}
	const token = await resolveGitToken(c, body.full_name);
	if (!token) return unauthorized(c);

	const result = await commitFiles(
		token,
		body.full_name,
		body.branch,
		body.files,
		body.message ?? "",
		body.author,
		body.co_author,
	);
	if (!result) {
		return c.json({ error: "no_changes", message: "Commit edilecek dosya yok." }, 400);
	}
	return c.json(result);
});

git.get("/commits", async (c) => {
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const perPage = Math.min(Number(c.req.query("per_page") ?? 30) || 30, 100);
	const commits = await listCommits(token, fullName, {
		ref: c.req.query("ref"),
		path: c.req.query("path"),
		perPage,
	});
	return c.json({ commits });
});

type UploadBody = {
	full_name?: string;
	branch?: string;
	path?: string;
	content?: string; // base64
	message?: string;
};

git.post("/upload", async (c) => {
	const body = await c.req
		.json<UploadBody>()
		.catch(() => ({}) as UploadBody);
	if (!body.full_name || !body.branch || !body.path || !body.content) {
		throw new BackendError(400, "full_name, branch, path ve base64 content zorunludur.");
	}
	const token = await resolveGitToken(c, body.full_name);
	if (!token) return unauthorized(c);
	// ~4 MB decoded tavan (base64 ≈ 4/3 oranında şişer).
	if (body.content.length > 5_600_000) {
		throw new BackendError(413, "Dosya çok büyük — en fazla ~4 MB.");
	}
	const result = await commitFiles(
		token,
		body.full_name,
		body.branch,
		[{ path: body.path, content: body.content, base64: true }],
		body.message ?? `Upload ${body.path} (via WuppyCMS)`,
	);
	if (!result) {
		return c.json({ error: "no_changes", message: "Dosya zaten aynı içeriğe sahip." }, 409);
	}
	return c.json(result);
});

api.route("/git", git);
api.route("/site", site);
api.route("/media", media);

// ---------------------------------------------------------------------------
// Projeler — kullanıcının bağladığı siteler (D1). Akış: repo seç → proje oluşt
// → editör. İçerik repoda kalır; burada yalnızca bağlantı tutulur.
// ---------------------------------------------------------------------------

type ProjectRow = {
	id: string;
	name: string;
	repo_full_name: string;
	default_branch: string;
	created_at: string;
};

const projects = new Hono<{ Bindings: AppEnv }>();

projects.get("/", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	// Kendi projeleri + üyesi olduğu paylaşılan projeler (parity 2b).
	const { results } = await platform(c).db!.prepare(
		`SELECT p.id, p.name, p.repo_full_name, p.default_branch, p.created_at,
		        CASE WHEN p.user_id = ? THEN 'owner' ELSE COALESCE(m.role, 'editor') END AS role
		 FROM projects p
		 LEFT JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
		 WHERE p.user_id = ? OR m.user_id IS NOT NULL
		 ORDER BY p.created_at DESC`,
	)
		.bind(user.id, user.id, user.id)
		.all<ProjectRow & { role: string }>();
	return c.json({ projects: results ?? [] });
});

projects.post("/", body(projectCreateSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const fullName = payload.full_name;
	// Yetki + varlık doğrulaması: token'ın repoya erişimi yoksa patlar.
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const repo = await getRepo(token, fullName);
	const name = payload.name || repo.fullName.split("/")[1]!;
	const existing = await platform(c).db!.prepare(
		"SELECT id FROM projects WHERE user_id = ? AND repo_full_name = ?",
	)
		.bind(user.id, repo.fullName)
		.first<{ id: string }>();
	if (existing) {
		await platform(c).db!.prepare(
			"UPDATE projects SET name = ?, default_branch = ?, updated_at = datetime('now') WHERE id = ?",
		)
			.bind(name, repo.defaultBranch, existing.id)
			.run();
		return c.json({
			id: existing.id,
			name,
			repoFullName: repo.fullName,
			branch: repo.defaultBranch,
		});
	}
	const id = crypto.randomUUID();
	await platform(c).db!.prepare(
		"INSERT INTO projects (id, user_id, name, repo_full_name, default_branch) VALUES (?, ?, ?, ?, ?)",
	)
		.bind(id, user.id, name, repo.fullName, repo.defaultBranch)
		.run();
	return c.json(
		{ id, name, repoFullName: repo.fullName, branch: repo.defaultBranch },
		201,
	);
});

projects.delete("/:id", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	await platform(c).db!.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?")
		.bind(c.req.param("id"), user.id)
		.run();
	return c.json({ ok: true });
});

api.route("/projects", projects);
api.route("/content", content);
api.route("/schedule", schedule);
api.route("/ai", ai);
api.route("/agent", agent);
api.route("/pages", pages);
api.route("/team", team);
api.route("/review", review);
api.route("/build", build);
api.route("/github/app", githubApp);
api.route("/deploy", deploy);

// Zamanlanmış yayın yürütücüsü — EventBridge (veya harici cron) çağırır.
api.post("/cron", async (c) => {
	const secret = c.req.header("x-cron-secret") ?? "";
	if (!c.env.DEPLOY_WORKER_SECRET || secret !== c.env.DEPLOY_WORKER_SECRET) {
		return c.json({ error: "unauthorized" }, 401);
	}
	const results = await runScheduled(c.env);
	return c.json({ ok: true, results });
});
api.route("/preview", previewControl);

/**
 * Hono uygulamasının tipi — istemci sözleşmesi testleri `hc<AppType>` ile
 * uçların yolunu ve yanıt şeklini derleme zamanında sabitler
 * (bkz. src/lib/admin/api-contract.test.ts). Tam istemci göçü, ikinci bir
 * istemci doğana dek ertelendi — mevcut istemci ince ve E2E kapsamı geniş.
 */
export type AppType = typeof api;

// ---------------------------------------------------------------------------
// Hata yönetimi
// ---------------------------------------------------------------------------

api.onError((err, c) => {
	if (err instanceof BackendError) {
		return c.json(
			{ error: "github", message: err.message },
			err.status as 400 | 401 | 403 | 404 | 409 | 422 | 500,
		);
	}
	console.error("[api] beklenmeyen hata:", err);
	return c.json({ error: "internal", message: "Beklenmeyen bir hata oluştu." }, 500);
});
