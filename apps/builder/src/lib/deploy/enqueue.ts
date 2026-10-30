// Yayın kuyruğu — iki hedef: AWS (varsayılan) ve müşterinin Cloudflare hesabı.
//
// Hem "Yeniden yayınla" hem de AI düzenlemesi sonrası otomatik yayın bu
// yardımcıyı kullanır: deploy_jobs satırı yazılır, worker'a iş verilir.
// Durumu worker callback'i günceller (/api/deploy/callback).

import type { AppEnv } from "../../api/types";
import type { SqlDatabase } from "../platform";
import { awsDeployConfigured, siteSlug, siteUrl } from "./aws";
import { accessToken as cloudflareAccessToken, getAccount } from "./cloudflare-oauth";
import { ensurePagesProject } from "./cloudflare-pages";
import { writeSiteUrls } from "./site-url";
import { codeBuildConfigured, startSiteBuild } from "./codebuild";

export type DeployTarget = "aws" | "cloudflare";

export type EnqueueDeployInput = {
	userId: string;
	repo: string;
	branch: string;
	token: string;
	/** Önizleme adresi için uygulamanın kökü (ör. https://app.wuppycms.com). */
	origin: string;
	/** Verilmezse projenin kayıtlı hedefi; o da yoksa aws. */
	target?: DeployTarget;
};

export type EnqueueDeployResult = {
	ok: boolean;
	target: DeployTarget;
	url?: string;
	previewUrl?: string;
	error?: string;
};

async function postBuild(
	env: AppEnv,
	payload: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
	const base = env.DEPLOY_WORKER_URL || "http://127.0.0.1:8790";
	try {
		const res = await fetch(`${base}/build`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ...payload, secret: env.DEPLOY_WORKER_SECRET ?? "" }),
		});
		if (!res.ok) return { ok: false, error: `Deploy worker ${res.status}` };
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : "Deploy worker'a ulaşılamadı.",
		};
	}
}

async function failJob(db: SqlDatabase, jobId: string, error?: string): Promise<void> {
	await db
		.prepare("UPDATE deploy_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?")
		.bind(error ?? "kuyruğa alınamadı", new Date().toISOString(), jobId)
		.run();
}

async function insertJob(
	db: SqlDatabase,
	input: {
		jobId: string;
		projectId: string | null;
		repo: string;
		branch: string;
		target: DeployTarget;
		url: string;
		previewUrl: string;
	},
): Promise<void> {
	const now = new Date().toISOString();
	await db
		.prepare(
			`INSERT INTO deploy_jobs
				(id, project_id, repo_full_name, branch, target, status, url, preview_url, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, ?, ?)`,
		)
		.bind(
			input.jobId,
			input.projectId ?? input.repo,
			input.repo,
			input.branch,
			input.target,
			input.url,
			input.previewUrl,
			now,
			now,
		)
		.run();
}

async function recordProjectUrl(
	db: SqlDatabase,
	input: { projectId: string | null; target: DeployTarget; url: string; previewUrl: string },
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

export async function enqueueDeploy(
	env: AppEnv,
	db: SqlDatabase,
	input: EnqueueDeployInput,
): Promise<EnqueueDeployResult> {
	const project = await db
		.prepare("SELECT id, deploy_target FROM projects WHERE repo_full_name = ? AND user_id = ?")
		.bind(input.repo, input.userId)
		.first<{ id: string; deploy_target: string | null }>();
	const projectId = project?.id ?? null;
	const target: DeployTarget =
		input.target ?? (project?.deploy_target === "cloudflare" ? "cloudflare" : "aws");

	if (target === "cloudflare") {
		const account = await getAccount(db, input.userId);
		if (!account) return { ok: false, target, error: "cloudflare_not_connected" };
		const pages = await ensurePagesProject(env, db, input.userId, {
			repoFullName: input.repo,
			branch: input.branch,
		});
		const access = await cloudflareAccessToken(env, db, input.userId);
		const previewUrl = `${input.origin}/preview/${pages.projectName}/`;
		await writeSiteUrls(input.token, input.repo, input.branch, {
			previewUrl,
			siteUrl: pages.url,
		}).catch((error) => console.warn("[deploy] site adresleri yazılamadı:", error));

		const jobId = crypto.randomUUID();
		await insertJob(db, {
			jobId,
			projectId,
			repo: input.repo,
			branch: input.branch,
			target,
			url: pages.url,
			previewUrl,
		});
		const queued = await postBuild(env, {
			jobId,
			repo: input.repo,
			branch: input.branch,
			token: input.token,
			slug: pages.projectName,
			target,
			cloudflare: {
				accountId: access.accountId,
				projectName: pages.projectName,
				accessToken: access.token,
			},
		});
		if (!queued.ok) {
			await failJob(db, jobId, queued.error);
			return { ok: false, target, error: queued.error };
		}
		await recordProjectUrl(db, { projectId, target, url: pages.url, previewUrl });
		return { ok: true, target, url: pages.url, previewUrl };
	}

	if (!awsDeployConfigured(env)) {
		return { ok: false, target, error: "aws_not_configured" };
	}
	const slug = siteSlug(input.repo);
	const url = siteUrl(env, input.repo);
	const previewUrl = `${input.origin}/preview/${slug}/`;
	await writeSiteUrls(input.token, input.repo, input.branch, {
		previewUrl,
		siteUrl: url,
	}).catch((error) => console.warn("[deploy] site adresleri yazılamadı:", error));

	const jobId = crypto.randomUUID();
	await insertJob(db, {
		jobId,
		projectId,
		repo: input.repo,
		branch: input.branch,
		target,
		url,
		previewUrl,
	});
	// AWS hedefi: CodeBuild yapılandırıldıysa VM worker yerine onu kullan.
	console.log("[deploy] builder=", codeBuildConfigured(env) ? "codebuild" : "worker");
	const queued = codeBuildConfigured(env)
		? await startSiteBuild(env, {
				repo: input.repo,
				branch: input.branch,
				token: input.token,
				slug,
				jobId,
				callbackUrl: `${input.origin}/api/deploy/callback`,
			}).then(
				() => ({ ok: true }),
				(error: Error) => ({ ok: false, error: error.message }),
			)
		: await postBuild(env, {
				jobId,
				repo: input.repo,
				branch: input.branch,
				token: input.token,
				slug,
				target,
			});
	if (!queued.ok) {
		await failJob(db, jobId, queued.error);
		return { ok: false, target, error: queued.error };
	}
	await recordProjectUrl(db, { projectId, target, url, previewUrl });
	return { ok: true, target, url, previewUrl };
}
