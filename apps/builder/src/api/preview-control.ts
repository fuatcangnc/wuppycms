// Canlı önizleme kontrolü — VM'deki `astro dev` sunucusunu açar/tazeler.
//
// Neden ayrı uç: önizleme proxy'si (`/preview/<slug>/`) herkese açıktır ve
// git token'ı bilmez. Dev sunucusunu açmak için repoya erişim gerekir; bu
// yüzden oturum + token burada çözülür.

import { Hono } from "hono";
import { z } from "zod";
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
