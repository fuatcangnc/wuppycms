// Yayın API'si (ADR 0022) — iki hedef:
//
//  • AWS (varsayılan)  : WuppyCMS altyapısı. Müşteri hiçbir şey kurmaz.
//                        Build VM'de koşar, çıktı S3'e yazılır, CloudFront
//                        `<slug>.sites.wuppycms.com` ile sunar.
//  • Cloudflare (opsiyonel): Müşteri kendi hesabını OAuth ile bağlar; site ve
//                        domain ayarları onun panelinde kalır.
//
// Önizleme her iki hedefte de aynı origin'den geçer:
//   /preview/<slug>/  →  AWS ise S3/CloudFront, Cloudflare ise pages.dev

import { Hono } from "hono";
import { z } from "zod";
import { getRepo } from "../lib/git";
import {
	awsDeployConfigured,
	invalidate,
	siteSlug,
	siteUrl as awsSiteUrl,
} from "../lib/deploy/aws";
import {
	accessToken as cloudflareAccessToken,
	cloudflareOAuthConfigured,
	completeConnection,
	disconnect,
	getAccount,
} from "../lib/deploy/cloudflare-oauth";
import {
	ensurePagesProject,
} from "../lib/deploy/cloudflare-pages";
import { writeSiteUrls } from "../lib/deploy/site-url";
import { codeBuildConfigured, startSiteBuild } from "../lib/deploy/codebuild";
import { createInstallState, verifyInstallState } from "../lib/git/github/app";
import type { AppEnv } from "./types";
import { platform, requireUser, resolveGitToken } from "./helpers";
import { body } from "./schemas";

export const deploy = new Hono<{ Bindings: AppEnv }>();

const syncSchema = z.object({
	/** Boşsa kullanıcının tüm projeleri. */
	full_name: z
		.string()
		.trim()
		.regex(/^[^/\s]+\/[^/\s]+$/, "owner/repo biçiminde olmalı")
		.optional(),
	/** `aws` (varsayılan) | `cloudflare` */
	target: z.enum(["aws", "cloudflare"]).optional(),
});

const callbackSchema = z.object({
	jobId: z.string().min(1),
	status: z.enum(["deployed", "failed"]),
	error: z.string().max(4000).optional(),
	slug: z.string().max(120).optional(),
	target: z.enum(["aws", "cloudflare"]).optional(),
	secret: z.string().min(1),
});

export type DeploySyncResult = {
	repo: string;
	ok: boolean;
	target: "aws" | "cloudflare";
	url?: string;
	previewUrl?: string;
	status?: "queued" | "deployed" | "failed";
	error?: string;
};

/** Bu ortamda hangi hedefler kullanılabilir? */
deploy.get("/targets", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const account = db ? await getAccount(db, user.id) : null;
	return c.json({
		aws: { available: awsDeployConfigured(c.env), default: true },
		cloudflare: {
			available: cloudflareOAuthConfigured(c.env),
			connected: Boolean(account),
			accountName: account?.accountName ?? null,
			accountId: account?.accountId ?? null,
		},
	});
});

// --- Cloudflare hesap bağlama ------------------------------------------------

deploy.get("/cloudflare/connect", async (c) => {
	const user = await requireUser(c);
	if (!user) {
		return c.redirect(`/login?next=${encodeURIComponent("/api/deploy/cloudflare/connect")}`);
	}
	if (!cloudflareOAuthConfigured(c.env)) {
		return c.redirect("/projects?cloudflare=not_configured");
	}
	const state = await createInstallState(c.env, user.id);
	if (!state) return c.redirect("/projects?cloudflare=no_secret");
	const { authorizationUrl, cloudflareRedirectUri } = await import(
		"../lib/deploy/cloudflare-oauth"
	);
	const origin = new URL(c.req.url).origin;
	const url = authorizationUrl(c.env, {
		state,
		redirectUri: cloudflareRedirectUri(c.env, origin),
	});
	return c.redirect(url);
});

deploy.get("/cloudflare/callback", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.redirect("/login?next=/projects");
	const db = platform(c).db;
	if (!db) return c.redirect("/projects?cloudflare=no_db");

	const code = c.req.query("code");
	const stateUser = await verifyInstallState(c.env, c.req.query("state"));
	if (!code) return c.redirect("/projects?cloudflare=denied");
	if (stateUser && stateUser !== user.id) return c.redirect("/projects?cloudflare=state_mismatch");

	try {
		const { cloudflareRedirectUri } = await import("../lib/deploy/cloudflare-oauth");
		await completeConnection(c.env, db, user.id, {
			code,
			redirectUri: cloudflareRedirectUri(c.env, new URL(c.req.url).origin),
		});
		return c.redirect("/projects?cloudflare=connected");
	} catch (error) {
		console.warn("[deploy] Cloudflare bağlanamadı:", error);
		return c.redirect("/projects?cloudflare=failed");
	}
});

deploy.post("/cloudflare/disconnect", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);
	await disconnect(db, user.id);
	return c.json({ ok: true });
});

// --- Yayınlama ---------------------------------------------------------------

type EnqueueInput = {
	jobId: string;
	repo: string;
	branch: string;
	token: string;
	slug: string;
	target: "aws" | "cloudflare";
	/** Cloudflare hedefinde: müşterinin hesabı ve geçici OAuth token'ı. */
	cloudflare?: { accountId: string; projectName: string; accessToken: string };
};

async function enqueueBuild(
	c: Parameters<typeof requireUser>[0],
	input: EnqueueInput,
): Promise<{ ok: boolean; error?: string }> {
	// CodeBuild yapılandırıldıysa VM worker'ı atla (AWS + Cloudflare).
	if (codeBuildConfigured(c.env)) {
		const origin = (c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin).replace(/\/+$/, "");
		try {
			await startSiteBuild(c.env, {
				repo: input.repo,
				branch: input.branch,
				token: input.token,
				slug: input.slug,
				jobId: input.jobId,
				target: input.target,
				cloudflare: input.cloudflare,
				callbackUrl: `${origin}/api/deploy/callback`,
			});
			return { ok: true };
		} catch (error) {
			return { ok: false, error: error instanceof Error ? error.message : "CodeBuild başlatılamadı." };
		}
	}
	const base = c.env.DEPLOY_WORKER_URL || "http://127.0.0.1:8790";
	try {
		const res = await fetch(`${base}/build`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				jobId: input.jobId,
				repo: input.repo,
				branch: input.branch,
				token: input.token,
				slug: input.slug,
				target: input.target,
				cloudflare: input.cloudflare,
				secret: c.env.DEPLOY_WORKER_SECRET ?? "",
			}),
		});
		if (!res.ok) {
			return { ok: false, error: `Deploy worker ${res.status}` };
		}
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Deploy worker'a ulaşılamadı.",
		};
	}
}

/**
 * POST /api/deploy/sync — { full_name?, target? }
 * AWS'de build kuyruğa girer (`queued`), worker bitince callback gelir.
 */
deploy.post("/sync", body(syncSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);

	const payload = c.req.valid("json");
	const target: "aws" | "cloudflare" = payload.target ?? "aws";

	if (target === "aws" && !awsDeployConfigured(c.env)) {
		return c.json(
			{
				error: "aws_not_configured",
				message: "AWS yayın yapılandırılmadı (bucket / CloudFront / kimlik).",
			},
			503,
		);
	}
	if (target === "cloudflare") {
		const account = await getAccount(db, user.id);
		if (!account) {
			return c.json(
				{
					error: "cloudflare_not_connected",
					message: "Önce Cloudflare hesabınızı bağlayın.",
					connectUrl: "/api/deploy/cloudflare/connect",
				},
				400,
			);
		}
	}

	const oneRepo = payload.full_name;
	const rows = oneRepo
		? await (async () => {
				// Tek repo yayınında da proje kaydını bul: yayın adresi projeye
				// yazılsın (yeniden yayınla → önizleme bağlantısı).
				const project = await db
					.prepare(
						"SELECT id, default_branch FROM projects WHERE repo_full_name = ? AND user_id = ?",
					)
					.bind(oneRepo, user.id)
					.first<{ id: string; default_branch: string }>();
				return [
					{
						repo_full_name: oneRepo,
						default_branch: project?.default_branch ?? "main",
						id: project?.id ?? null,
					},
				];
			})()
		: ((
				await db
					.prepare(
						`SELECT p.id, p.repo_full_name, p.default_branch
						 FROM projects p
						 LEFT JOIN project_members m ON m.project_id = p.id AND m.user_id = ?
						 WHERE p.user_id = ? OR m.user_id IS NOT NULL`,
					)
					.bind(user.id, user.id)
					.all<{ id: string; repo_full_name: string; default_branch: string }>()
			).results ?? []);

	const origin = (c.env.BETTER_AUTH_URL ?? new URL(c.req.url).origin).replace(/\/+$/, "");
	const results: DeploySyncResult[] = [];

	for (const row of rows) {
		const repo = row.repo_full_name;
		try {
			const token = await resolveGitToken(c, repo);
			if (!token) {
				results.push({ repo, ok: false, target, error: "GitHub bağlantısı yok" });
				continue;
			}
			const info = await getRepo(token, repo);
			const branch = info.defaultBranch || row.default_branch || "main";

			if (target === "cloudflare") {
				const pages = await ensurePagesProject(c.env, db, user.id, {
					repoFullName: repo,
					branch,
				});
				const access = await cloudflareAccessToken(c.env, db, user.id);
				const previewUrl = `${origin}/preview/${pages.projectName}/`;
				// Kanonik adres ve önizleme adresi repoya işlenir; build bunları
				// okur (astro.config.mjs `site`, .wuppycms/sites.jsonc `url`).
				await writeSiteUrls(token, repo, branch, {
					previewUrl,
					siteUrl: pages.url,
				}).catch((error) => {
					console.warn("[deploy] site adresleri yazılamadı:", error);
				});
				const jobId = crypto.randomUUID();
				const now = new Date().toISOString();
				await db
					.prepare(
						`INSERT INTO deploy_jobs
							(id, project_id, repo_full_name, branch, target, status, url, preview_url, created_at, updated_at)
						 VALUES (?, ?, ?, ?, 'cloudflare', 'queued', ?, ?, ?, ?)`,
					)
					.bind(jobId, row.id ?? repo, repo, branch, pages.url, previewUrl, now, now)
					.run();

				const queued = await enqueueBuild(c, {
					jobId,
					repo,
					branch,
					token,
					slug: pages.projectName,
					target: "cloudflare",
					cloudflare: {
						accountId: access.accountId,
						projectName: pages.projectName,
						accessToken: access.token,
					},
				});
				if (!queued.ok) {
					await markJob(db, jobId, "failed", queued.error);
					results.push({ repo, ok: false, target, error: queued.error });
					continue;
				}

				await upsertProjectDeploy(db, {
					projectId: row.id,
					repo,
					target,
					url: pages.url,
					previewUrl,
				});
				results.push({
					repo,
					ok: true,
					target,
					url: pages.url,
					previewUrl,
					status: "queued",
				});
				continue;
			}

			// AWS: build kuyruğa girer.
			const slug = siteSlug(repo);
			const url = awsSiteUrl(c.env, repo);
			const previewUrl = `${origin}/preview/${slug}/`;
			await writeSiteUrls(token, repo, branch, {
				previewUrl,
				siteUrl: url,
			}).catch((error) => {
				console.warn("[deploy] site adresleri yazılamadı:", error);
			});
			const jobId = crypto.randomUUID();
			const now = new Date().toISOString();
			await db
				.prepare(
					`INSERT INTO deploy_jobs
						(id, project_id, repo_full_name, branch, target, status, url, preview_url, created_at, updated_at)
					 VALUES (?, ?, ?, ?, 'aws', 'queued', ?, ?, ?, ?)`,
				)
				.bind(jobId, row.id ?? repo, repo, branch, url, previewUrl, now, now)
				.run();

			const queued = await enqueueBuild(c, {
				jobId,
				repo,
				branch,
				token,
				slug,
				target: "aws",
			});
			if (!queued.ok) {
				await markJob(db, jobId, "failed", queued.error);
				results.push({ repo, ok: false, target, error: queued.error });
				continue;
			}

			await upsertProjectDeploy(db, {
				projectId: row.id,
				repo,
				target,
				url,
				previewUrl,
			});
			results.push({ repo, ok: true, target, url, previewUrl, status: "queued" });
		} catch (error) {
			results.push({
				repo,
				ok: false,
				target,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return c.json({ results });
});

async function markJob(
	db: NonNullable<ReturnType<typeof platform>["db"]>,
	jobId: string,
	status: string,
	error?: string,
): Promise<void> {
	await db
		.prepare("UPDATE deploy_jobs SET status = ?, error = ?, updated_at = ? WHERE id = ?")
		.bind(status, error ?? null, new Date().toISOString(), jobId)
		.run();
}

async function upsertProjectDeploy(
	db: NonNullable<ReturnType<typeof platform>["db"]>,
	input: {
		projectId: string | null;
		repo: string;
		target: "aws" | "cloudflare";
		url: string;
		previewUrl: string;
	},
): Promise<void> {
	if (!input.projectId) return;
	await db
		.prepare(
			`UPDATE projects
			 SET deploy_target = ?, deploy_url = ?, preview_url = ?, updated_at = datetime('now')
			 WHERE id = ?`,
		)
		.bind(input.target, input.url, input.previewUrl, input.projectId)
		.run();
}

/** Deploy worker bitince çağırır: durumu yazar, önbelleği temizler. */
deploy.post("/callback", body(callbackSchema), async (c) => {
	const payload = c.req.valid("json");
	if (!c.env.DEPLOY_WORKER_SECRET || payload.secret !== c.env.DEPLOY_WORKER_SECRET) {
		return c.json({ error: "invalid_secret" }, 401);
	}
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);

	await markJob(db, payload.jobId, payload.status, payload.error);

	if (payload.status === "deployed" && payload.slug && payload.target !== "cloudflare") {
		try {
			await invalidate(c.env, [`/sites/${payload.slug}/*`]);
		} catch (error) {
			console.warn("[deploy] invalidation başarısız:", error);
		}
	}
	return c.json({ ok: true });
});

/** Son yayın durumu (UI rozeti). */
deploy.get("/status", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ jobs: [] });
	const repo = c.req.query("full_name");
	const siteUrl = c.req.query("url");
	const rows = await db
		.prepare(
			repo
				? `SELECT id, repo_full_name, status, url, preview_url, error, updated_at
				   FROM deploy_jobs WHERE repo_full_name = ? ORDER BY created_at DESC LIMIT 1`
				: siteUrl
					? `SELECT id, repo_full_name, status, url, preview_url, error, updated_at
					   FROM deploy_jobs WHERE url = ? ORDER BY created_at DESC LIMIT 1`
					: `SELECT id, repo_full_name, status, url, preview_url, error, updated_at
					   FROM deploy_jobs ORDER BY created_at DESC LIMIT 20`,
		)
		.bind(...(repo ? [repo] : siteUrl ? [siteUrl] : []))
		.all();

	// Worker kuyruğu bellekte tutar; servis yeniden başlarsa iş "queued" kalır.
	// 10 dakikadan eski kuyruk satırlarını başarısız göster ki UI sonsuza dek
	// "yayınlanıyor" demesin ve kullanıcı yeniden yayınlayabilsin.
	const staleMs = 10 * 60_000;
	const jobs = (rows.results ?? []).map((job) => {
		const row = job as { status?: string; updated_at?: string };
		if (row.status !== "queued" || !row.updated_at) return job;
		const age = Date.now() - Date.parse(row.updated_at);
		if (!Number.isFinite(age) || age <= staleMs) return job;
		return {
			...job,
			status: "failed",
			error: "Yayın kuyruğu yeniden başladı; yeniden yayınlayın.",
		};
	});
	return c.json({ jobs });
});
