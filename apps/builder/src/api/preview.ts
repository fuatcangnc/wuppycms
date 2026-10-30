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
	let out = html.replace(
		/\b(href|src|action|poster)=(["'])\/(?!\/)/gi,
		(_match, attr: string, quote: string) => `${attr}=${quote}${prefix}/`,
	);
	// Inline modül import'ları (`import('/scripts/...')`) mutlak yol kullanır;
	// bunlar da öneklenmezse tema animasyonları çalışmaz ve sayfa boş kalır.
	out = out.replace(
		/\bimport\s*\(\s*(["'])\/(?!\/)/g,
		(_match, quote: string) => `import(${quote}${prefix}/`,
	);
	// srcset: virgülle ayrılmış adaylar
	out = out.replace(/\bsrcset=(["'])(.*?)\1/gis, (match, quote: string, value: string) => {
		const rewritten = value
			.split(",")
			.map((part) => part.replace(/^(\s*)\/(?!\/)/, `$1${prefix}/`))
			.join(",");
		return `srcset=${quote}${rewritten}${quote}`;
	});
	return out;
}

export function rewriteCss(css: string, prefix: string): string {
	return css
		.replace(/url\((\s*)\/(?!\/)/gi, (_m, ws: string) => `url(${ws}${prefix}/`)
		.replace(/@import\s+(["'])\/(?!\/)/gi, (_m, quote: string) => `@import ${quote}${prefix}/`);
}

/** Preview kimliği → upstream taban adresi. */
function upstreamFor(env: AppEnv, id: string): string | null {
	if (PAGES_SLUG_RE.test(id)) return `https://${id}.pages.dev`;
	if (!AWS_SLUG_RE.test(id)) return null;
	const base = env.AWS_SITES_DOMAIN || "sites.wuppycms.com";
	return `https://${id}.${base}`;
}

async function handler(c: Context<{ Bindings: AppEnv }>) {
	const id = c.req.param("project") ?? "";
	const upstreamBase = upstreamFor(c.env, id);
	if (!upstreamBase) return c.json({ error: "invalid_project" }, 400);

	const prefix = `/preview/${id}`;
	const incoming = new URL(c.req.url);
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
