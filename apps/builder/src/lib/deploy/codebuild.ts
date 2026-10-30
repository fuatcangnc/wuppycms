// AWS CodeBuild ile site derleme — VM'deki deploy worker'ın sunucusuz eşdeğeri.
//
// `AWS_CODEBUILD_PROJECT` tanımlıysa enqueueDeploy bu yolu kullanır; aksi
// halde mevcut VM worker'ı çalışmaya devam eder. Build bittiğinde buildspec
// `/api/deploy/callback`'i çağırır; durum akışı değişmez.

import { AwsClient } from "aws4fetch";
import type { AppEnv } from "../../api/types";

const REGION = () => process.env.AWS_REGION ?? "us-east-1";

export function codeBuildConfigured(env: AppEnv): boolean {
	return Boolean(env.AWS_CODEBUILD_PROJECT && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
}

export type CodeBuildInput = {
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
	const region = REGION();
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
