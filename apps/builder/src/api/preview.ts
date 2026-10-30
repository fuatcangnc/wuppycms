// Üretilen sitelerin önizleme köprüsü (ADR 0022).
//
// Neden proxy: sitenin kanonik adresi `<slug>.sites.wuppycms.com`, ama
// müşteri henüz domain bağlamamış olabilir; ayrıca admin iframe'i ile
// `WuppycmsBridge` (element seçici, "Write to chat") **aynı origin** ister.
//
// Tek yol, iki upstream:
//   AWS hedefi        → https://<slug>.<AWS_SITES_DOMAIN>/...
//   Cloudflare hedefi → https://<proje>.pages.dev/...
//
// Googlebot/ziyaretçi için kanonik adres değişmez; preview yalnız editör
// içindir. HTML/CSS içindeki kök göreli URL'ler önekle yeniden yazılır.

import { Hono, type Context } from "hono";
import type { AppEnv } from "./types";

export const preview = new Hono<{ Bindings: AppEnv }>();

/** AWS site slug'ı: `owner-repo-hash`. */
const AWS_SLUG_RE = /^[a-z0-9][a-z0-9-]{2,80}$/;
/** Cloudflare projesi: `wuppy-...`. */
const PAGES_SLUG_RE = /^wuppy-[a-z0-9][a-z0-9-]{2,57}$/;

export function rewriteHtml(html: string, prefix: string): string {
	const prefixed = (path: string) => path === prefix || path.startsWith(`${prefix}/`);
	let out = html.replace(
		/\b(href|src|action|poster)=(["'])(\/(?!\/)[^"']*)/gi,
		(match, attr: string, quote: string, path: string) =>
			prefixed(path) ? match : `${attr}=${quote}${prefix}${path}`,
	);
	// Inline modül import'ları (`import('/scripts/...')`) mutlak yol kullanır;
	// bunlar da öneklenmezse tema animasyonları çalışmaz ve sayfa boş kalır.
	out = out.replace(
		/\bimport\s*\(\s*(["'])(\/(?!\/)[^"']*)\1/g,
		(match, quote: string, path: string) =>
			prefixed(path) ? match : `import(${quote}${prefix}${path}${quote}`,
	);
	// srcset: virgülle ayrılmış adaylar
	out = out.replace(/\bsrcset=(["'])(.*?)\1/gis, (match, quote: string, value: string) => {
		const rewritten = value
			.split(",")
			.map((part) =>
				part.replace(/^(\s*)(\/(?!\/)[^\s,]*)/, (m, ws: string, path: string) =>
					prefixed(path) ? m : `${ws}${prefix}${path}`,
				),
			)
			.join(",");
		return `srcset=${quote}${rewritten}${quote}`;
	});
	// Astro dev stil blokları `url(/images/...)` üretir; bunlar da öneklenmeli.
	out = out.replace(
		/<style([^>]*)>([\s\S]*?)<\/style>/gi,
		(_match, attrs: string, css: string) => `<style${attrs}>${rewriteCss(css, prefix)}</style>`,
	);
	return out;
}

export function rewriteCss(css: string, prefix: string): string {
	const prefixed = (path: string) => path === prefix || path.startsWith(`${prefix}/`);
	return css
		.replace(
			/url\((\s*)(\/(?!\/)[^)]*)\)/gi,
			(match, ws: string, path: string) => (prefixed(path) ? match : `url(${ws}${prefix}${path})`),
		)
		.replace(
			/@import\s+(["'])(\/(?!\/)[^"']*)\1/gi,
			(match, quote: string, path: string) =>
				prefixed(path) ? match : `@import ${quote}${prefix}${path}${quote}`,
		);
}

/** Preview kimliği → upstream taban adresi. */
function upstreamFor(env: AppEnv, id: string): string | null {
	if (PAGES_SLUG_RE.test(id)) return `https://${id}.pages.dev`;
	if (!AWS_SLUG_RE.test(id)) return null;
	const base = env.AWS_SITES_DOMAIN || "sites.wuppycms.com";
	return `https://${id}.${base}`;
}

/**
 * Canlı (dev) önizleme: VM'deki `astro dev` sunucusu açıksa doğrudan oraya
 * gider. Bu yol build beklemeden AI düzenlemelerini anında gösterir.
 * Dev sunucu `--base /preview/<slug>/` ile açıldığı için yol aynen iletilir.
 */
async function devUpstream(env: AppEnv, slug: string): Promise<string | null> {
	const base = env.PREVIEW_MANAGER_URL;
	if (!base) return null;
	try {
		const res = await fetch(`${base}/status?slug=${encodeURIComponent(slug)}`, {
			headers: env.PREVIEW_SECRET ? { "x-preview-secret": env.PREVIEW_SECRET } : {},
			signal: AbortSignal.timeout(1500),
		});
		if (!res.ok) return null;
		const data = (await res.json()) as { running?: boolean; port?: number };
		return data.running && data.port ? `http://127.0.0.1:${data.port}` : null;
	} catch {
		return null;
	}
}

async function handler(c: Context<{ Bindings: AppEnv }>) {
	const id = c.req.param("project") ?? "";
	const incoming = new URL(c.req.url);

	// 1) Canlı dev önizleme (varsa) — build beklemez, yolu aynen iletir.
	const dev = await devUpstream(c.env, id);
	if (dev) {
		try {
			const upstream = await fetch(`${dev}${incoming.pathname}${incoming.search}`, {
				method: c.req.method === "HEAD" ? "HEAD" : "GET",
				headers: {
					accept: c.req.header("accept") ?? "*/*",
					"accept-language": c.req.header("accept-language") ?? "en",
					"user-agent": c.req.header("user-agent") ?? "wuppycms-preview",
				},
				redirect: "manual",
			});
			const headers = new Headers(upstream.headers);
			headers.delete("content-length");
			headers.delete("content-encoding");
			headers.delete("transfer-encoding");
			headers.delete("content-security-policy");
			headers.delete("x-frame-options");
			headers.set("cache-control", "no-store");
			headers.set("x-wuppycms-preview", "dev");

			// Dev HTML'indeki kök-göreli linkler (`/iletisim`) önek almazsa
			// iframe admin'in köküne gidip 404 olur. Üretim yolundaki gibi
			// HTML/CSS'i önekle yeniden yaz.
			const devPrefix = `/preview/${id}`;
			const devType = headers.get("content-type") ?? "";
			if (devType.includes("text/html")) {
				const html = await upstream.text();
				return new Response(c.req.method === "HEAD" ? null : rewriteHtml(html, devPrefix), {
					status: upstream.status,
					headers,
				});
			}
			if (devType.includes("text/css")) {
				const css = await upstream.text();
				return new Response(rewriteCss(css, devPrefix), {
					status: upstream.status,
					headers,
				});
			}
			return new Response(c.req.method === "HEAD" ? null : upstream.body, {
				status: upstream.status,
				headers,
			});
		} catch (error) {
			console.warn("[preview] dev upstream ulaşılamadı, üretime düşülüyor:", error);
		}
	}

	const upstreamBase = upstreamFor(c.env, id);
	if (!upstreamBase) return c.json({ error: "invalid_project" }, 400);

	const prefix = `/preview/${id}`;
	const rest = incoming.pathname.startsWith(prefix)
		? incoming.pathname.slice(prefix.length) || "/"
		: "/";
	const target = `${upstreamBase}${rest}${incoming.search}`;

	let upstream: Response;
	try {
		upstream = await fetch(target, {
			method: c.req.method === "HEAD" ? "HEAD" : "GET",
			headers: {
				accept: c.req.header("accept") ?? "*/*",
				"accept-language": c.req.header("accept-language") ?? "en",
				"user-agent": c.req.header("user-agent") ?? "wuppycms-preview",
			},
			redirect: "manual",
		});
	} catch (error) {
		console.warn("[preview] upstream ulaşılamadı:", error);
		return c.text("Önizleme şu anda yüklenemedi.", 502);
	}

	// Yönlendirmeleri önek altında tut.
	if (upstream.status >= 300 && upstream.status < 400) {
		const location = upstream.headers.get("location");
		if (!location) return new Response(null, { status: upstream.status });
		const status = upstream.status as 301 | 302 | 303 | 307 | 308;
		if (location.startsWith("/")) return c.redirect(`${prefix}${location}`, status);
		try {
			const loc = new URL(location);
			if (location.startsWith(upstreamBase)) {
				const path = loc.pathname + loc.search;
				return c.redirect(`${prefix}${path}`, status);
			}
		} catch {
			// mutlak olmayan Location — olduğu gibi
		}
		return c.redirect(location, status);
	}

	const headers = new Headers(upstream.headers);
	headers.delete("content-length");
	headers.delete("content-encoding");
	headers.delete("transfer-encoding");
	headers.delete("content-security-policy");
	headers.delete("strict-transport-security");
	headers.delete("x-frame-options");
	headers.set("x-wuppycms-preview", "1");

	const type = headers.get("content-type") ?? "";
	if (type.includes("text/html")) {
		const html = await upstream.text();
		headers.set("cache-control", "no-store");
		return new Response(c.req.method === "HEAD" ? null : rewriteHtml(html, prefix), {
			status: upstream.status,
			headers,
		});
	}
	if (type.includes("text/css")) {
		const css = await upstream.text();
		return new Response(rewriteCss(css, prefix), { status: upstream.status, headers });
	}

	return new Response(c.req.method === "HEAD" ? null : upstream.body, {
		status: upstream.status,
		headers,
	});
}

preview.get("/:project", handler);
preview.get("/:project/*", handler);
