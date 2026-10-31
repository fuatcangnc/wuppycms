// AWS CodeBuild ile site derleme — VM'deki deploy worker'ın sunucusuz eşdeğeri.
//
// `AWS_CODEBUILD_PROJECT` tanımlıysa enqueueDeploy bu yolu kullanır; aksi
// halde mevcut VM worker'ı çalışmaya devam eder. Build bittiğinde buildspec
// `/api/deploy/callback`'i çağırır; durum akışı değişmez.

import { AwsClient } from "aws4fetch";
import type { AppEnv } from "../../api/types";



export function codeBuildConfigured(env: AppEnv): boolean {
	return Boolean(env.AWS_CODEBUILD_PROJECT && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

export type CodeBuildInput = {
	target?: "aws" | "cloudflare";
	cloudflare?: { accountId: string; projectName: string; accessToken: string };
	repo: string;
	branch: string;
	token: string;
	slug: string;
	jobId: string;
	callbackUrl: string;
};

/**
 * CodeBuild projesini başlatır. Buildspec `scripts/aws/buildspec.yml`,
 * proje oluşturulurken source olarak bu dosyayı kullanır (NO_SOURCE + inline
 * buildspec ya da S3'e yüklenmiş buildspec).
 */
export async function startSiteBuild(env: AppEnv, input: CodeBuildInput): Promise<void> {
	const project = env.AWS_CODEBUILD_PROJECT;
	if (!project) throw new Error("AWS_CODEBUILD_PROJECT tanımlı değil.");
	const region = env.AWS_REGION ?? "us-east-1";
	const body = {
		projectName: project,
		environmentVariablesOverride: [
			{ name: "REPO", value: input.repo, type: "PLAINTEXT" },
			{ name: "BRANCH", value: input.branch, type: "PLAINTEXT" },
			{ name: "GIT_TOKEN", value: input.token, type: "PLAINTEXT" },
			{ name: "SLUG", value: input.slug, type: "PLAINTEXT" },
			{ name: "JOB_ID", value: input.jobId, type: "PLAINTEXT" },
			{ name: "CALLBACK_URL", value: input.callbackUrl, type: "PLAINTEXT" },
			{
				name: "CALLBACK_SECRET",
				value: env.DEPLOY_WORKER_SECRET ?? "",
				type: "PLAINTEXT",
			},
			{ name: "TARGET", value: input.target ?? "aws", type: "PLAINTEXT" },
			{ name: "CF_ACCOUNT_ID", value: input.cloudflare?.accountId ?? "", type: "PLAINTEXT" },
			{ name: "CF_PROJECT", value: input.cloudflare?.projectName ?? "", type: "PLAINTEXT" },
			{ name: "CF_TOKEN", value: input.cloudflare?.accessToken ?? "", type: "PLAINTEXT" },
			{ name: "BUCKET", value: env.AWS_S3_BUCKET ?? "", type: "PLAINTEXT" },
			{
				name: "DISTRIBUTION_ID",
				value: env.AWS_CLOUDFRONT_DISTRIBUTION_ID ?? "",
				type: "PLAINTEXT",
			},
		],
	};

	const res = await new AwsClient({
		accessKeyId: env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
		sessionToken: env.AWS_SESSION_TOKEN,
		service: "codebuild",
		region,
	}).fetch(`https://codebuild.${region}.amazonaws.com/`, {
		method: "POST",
		headers: {
			"content-type": "application/x-amz-json-1.1",
			"x-amz-target": "CodeBuild_20161006.StartBuild",
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const detail = (await res.text().catch(() => "")).slice(0, 400);
		throw new Error(`CodeBuild StartBuild başarısız (${res.status}): ${detail}`);
	}
}

export type BuildSummary = {
	id: string;
	status: "queued" | "deployed" | "failed";
	rawStatus: string;
	startTime?: string;
	endTime?: string;
	slug?: string;
	repo?: string;
};

const summaryCache = new Map<string, { at: number; value: BuildSummary | null }>();

/**
 * Bir slug'ın en son CodeBuild derlemesini döndürür. Yayın durumu böylece
 * örnek başına `deploy_jobs` satırına bağlı kalmaz; hangi Lambda örneği
 * yanıtlarsa yanıtlasın aynı CodeBuild gerçeği görülür.
 */
export async function latestBuildForSlug(env: AppEnv, slug: string): Promise<BuildSummary | null> {
	const project = env.AWS_CODEBUILD_PROJECT;
	if (!project) return null;
	const cacheKey = `${project}:${slug}`;
	const hit = summaryCache.get(cacheKey);
	if (hit && Date.now() - hit.at < 2000) return hit.value;

	const region = env.AWS_REGION ?? "us-east-1";
	const aws = new AwsClient({
		accessKeyId: env.AWS_ACCESS_KEY_ID!,
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
		sessionToken: env.AWS_SESSION_TOKEN,
		service: "codebuild",
		region,
	});
	const call = async (target: string, body: unknown) => {
		const res = await aws.fetch(`https://codebuild.${region}.amazonaws.com/`, {
			method: "POST",
			headers: { "content-type": "application/x-amz-json-1.1", "x-amz-target": target },
			body: JSON.stringify(body),
		});
		if (!res.ok) throw new Error(`CodeBuild ${target} ${res.status}`);
		return (await res.json()) as { ids?: string[]; builds?: Array<Record<string, unknown>> };
	};

	const list = await call("CodeBuild_20161006.ListBuildsForProject", { projectName: project });
	const ids = (list.ids ?? []).slice(0, 20);
	if (!ids.length) {
		summaryCache.set(cacheKey, { at: Date.now(), value: null });
		return null;
	}
	const batch = await call("CodeBuild_20161006.BatchGetBuilds", { ids });
	let best: { build: Record<string, unknown>; start: number } | null = null;
	for (const build of batch.builds ?? []) {
		const vars = (build.environment as { environmentVariables?: Array<{ name?: string; value?: string }> })
			?.environmentVariables ?? [];
		const envValue = (name: string) => vars.find((entry) => entry.name === name)?.value;
		if (envValue("SLUG") !== slug) continue;
		const start = build.startTime ? Date.parse(String(build.startTime)) : 0;
		if (!best || start > best.start) best = { build, start: Number.isFinite(start) ? start : 0 };
	}
	if (!best) {
		summaryCache.set(cacheKey, { at: Date.now(), value: null });
		return null;
	}
	const raw = String(best.build.buildStatus ?? "");
	const status: BuildSummary["status"] =
		raw === "SUCCEEDED"
			? "deployed"
			: raw === "FAILED" || raw === "FAULT" || raw === "STOPPED" || raw === "TIMED_OUT"
				? "failed"
				: "queued";
	const value: BuildSummary = {
		id: String(best.build.id ?? ""),
		status,
		rawStatus: raw,
		startTime: best.build.startTime ? String(best.build.startTime) : undefined,
		endTime: best.build.endTime ? String(best.build.endTime) : undefined,
		slug,
		repo: ((best.build.environment as { environmentVariables?: Array<{ name?: string; value?: string }> })
			?.environmentVariables ?? []).find((entry) => entry.name === "REPO")?.value,
	};
	summaryCache.set(cacheKey, { at: Date.now(), value });
	return value;
}
