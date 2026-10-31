// Canlı önizleme kontrolü — VM'deki `astro dev` sunucusunu açar/tazeler.
//
// Neden ayrı uç: önizleme proxy'si (`/preview/<slug>/`) herkese açıktır ve
// git token'ı bilmez. Dev sunucusunu açmak için repoya erişim gerekir; bu
// yüzden oturum + token burada çözülür.

import { Hono } from "hono";
import { z } from "zod";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getRepo } from "../lib/git";
import { siteSlug } from "../lib/deploy/aws";
import type { AppEnv } from "./types";
import { requireUser, resolveGitToken } from "./helpers";
import { body } from "./schemas";

export const previewControl = new Hono<{ Bindings: AppEnv }>();

const openSchema = z.object({
	full_name: z.string().trim().min(3).max(200),
	branch: z.string().trim().max(200).optional(),
});

function managerBase(env: AppEnv): string {
	return env.PREVIEW_MANAGER_URL || "http://127.0.0.1:8791";
}

function managerHeaders(env: AppEnv): Record<string, string> {
	return {
		"content-type": "application/json",
		...(env.PREVIEW_SECRET ? { "x-preview-secret": env.PREVIEW_SECRET } : {}),
	};
}

/** POST /api/preview/open — siteyi canlı önizlemeye alır (varsa yeniden kullanır). */
previewControl.post("/open", body(openSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const token = await resolveGitToken(c, payload.full_name);
	if (!token) return c.json({ ok: false, error: "git_not_connected" }, 400);

	let branch = payload.branch;
	if (!branch) {
		try {
			branch = (await getRepo(token, payload.full_name)).defaultBranch || "main";
		} catch {
			branch = "main";
		}
	}
	const slug = siteSlug(payload.full_name);
	try {
		const res = await fetch(`${managerBase(c.env)}/open`, {
			method: "POST",
			headers: managerHeaders(c.env),
			body: JSON.stringify({ slug, repo: payload.full_name, branch, token }),
			signal: AbortSignal.timeout(140_000),
		});
		const data = (await res.json().catch(() => ({}))) as {
			port?: number;
			ready?: boolean;
			error?: string;
		};
		if (!res.ok) return c.json({ ok: false, slug, error: data.error ?? "preview_failed" }, 502);
		return c.json({ ok: true, slug, port: data.port ?? null, ready: data.ready ?? false });
	} catch (error) {
		return c.json(
			{
				ok: false,
				slug,
				error: error instanceof Error ? error.message : "preview_unreachable",
			},
			502,
		);
	}
});

/** POST /api/preview/refresh — dev sunucusunda `git pull` (AI yazımı sonrası). */
previewControl.post("/refresh", body(openSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const token = await resolveGitToken(c, payload.full_name);
	if (!token) return c.json({ ok: false, error: "git_not_connected" }, 400);
	const slug = siteSlug(payload.full_name);
	try {
		const res = await fetch(`${managerBase(c.env)}/refresh`, {
			method: "POST",
			headers: managerHeaders(c.env),
			body: JSON.stringify({ slug, token, branch: payload.branch }),
			signal: AbortSignal.timeout(60_000),
		});
		const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
		return c.json({ ok: res.ok && data.ok !== false, slug, error: data.error }, res.ok ? 200 : 502);
	} catch (error) {
		return c.json(
			{
				ok: false,
				slug,
				error: error instanceof Error ? error.message : "preview_unreachable",
			},
			502,
		);
	}
});

/** GET /api/preview/status?slug=… — dev sunucusu hazır mı? */
previewControl.get("/status", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const slug = c.req.query("slug") ?? "";
	if (!/^[a-z0-9][a-z0-9-]{2,80}$/.test(slug)) {
		return c.json({ ok: false, error: "invalid_slug" }, 400);
	}
	try {
		const res = await fetch(`${managerBase(c.env)}/status?slug=${encodeURIComponent(slug)}`, {
			headers: c.env.PREVIEW_SECRET ? { "x-preview-secret": c.env.PREVIEW_SECRET } : {},
			signal: AbortSignal.timeout(2500),
		});
		const data = (await res.json().catch(() => ({}))) as {
			running?: boolean;
			ready?: boolean;
			port?: number;
		};
		return c.json({ ok: res.ok, slug, ...data });
	} catch {
		return c.json({ ok: false, slug, running: false, ready: false });
	}
});

/**
 * GET /api/preview/bundle?full_name=owner/repo&branch=main
 * Tarayıcı önizlemesi (Nodepod) için repoyu zip olarak akıtır. Token istemciye
 * verilmez; GitHub App kurulum token'ı yalnız sunucuda kullanılır.
 */
previewControl.get("/bundle", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const fullName = c.req.query("full_name") ?? "";
	const branch = c.req.query("branch") ?? "main";
	if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) {
		return c.json({ error: "invalid_repo" }, 400);
	}
	try {
	const token = await resolveGitToken(c, fullName);
	if (!token) return c.json({ error: "git_not_connected" }, 400);
	const res = await fetch(
		`https://api.github.com/repos/${fullName}/zipball/${encodeURIComponent(branch)}`,
		{
			headers: {
				authorization: `Bearer ${token}`,
				accept: "application/vnd.github+json",
				"user-agent": "wuppycms-preview",
			},
			redirect: "follow",
		},
	);
	if (!res.ok) {
		return c.json({ error: "bundle_failed", status: res.status }, 502);
	}
	const zip = await res.arrayBuffer();
	const bucket = c.env.MEDIA_BUCKET;
	if (!bucket) return c.json({ error: "media_bucket_missing" }, 503);
	const region = c.env.AWS_REGION || "us-east-1";
	const s3 = new S3Client({ region });
	const key = `preview-bundles/${fullName.replace("/", "-")}-${Date.now()}.zip`;
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: new Uint8Array(zip),
			ContentType: "application/zip",
		}),
	);
	const url = await getSignedUrl(
		s3,
		new GetObjectCommand({ Bucket: bucket, Key: key }),
		{ expiresIn: 900 },
	);
	console.log("[preview] bundle", fullName, zip.byteLength, "bytes →", key);
	return c.json({ url, size: zip.byteLength, key });
	} catch (error) {
		console.error("[preview] bundle hatası:", error);
		return c.json({ error: "bundle_failed", message: error instanceof Error ? error.message : String(error) }, 502);
	}
});
