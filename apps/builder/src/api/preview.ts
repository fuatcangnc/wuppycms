// Üretilen sitelerin önizleme köprüsü.
//
// `*.pages.dev` bazı ağlarda (ör. TR ISP'leri) çözümlenmiyor/engelleniyor.
// Bu route, Pages çıktısını admin ile aynı origin altında `/preview/<proje>/`
// yolundan sunar: iframe önizlemesi ve müşteri linkleri çalışır.
//
// Yalnızca `wuppy-` önekli proje adları proxylanır; HTML/CSS içindeki kök
// göreli URL'ler önekle yeniden yazılır. Böylece asset'ler ve iç linkler
// önizleme yolunda kalır.

import { Hono, type Context } from "hono";
import type { AppEnv } from "./types";

export const preview = new Hono<{ Bindings: AppEnv }>();

const PROJECT_RE = /^wuppy-[a-z0-9][a-z0-9-]{2,57}$/;

function rewriteHtml(html: string, prefix: string): string {
	let out = html.replace(
		/\b(href|src|action|poster)=(["'])\/(?!\/)/gi,
		(_match, attr: string, quote: string) => `${attr}=${quote}${prefix}/`,
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

function rewriteCss(css: string, prefix: string): string {
	return css
		.replace(/url\((\s*)\/(?!\/)/gi, (_m, ws: string) => `url(${ws}${prefix}/`)
		.replace(/@import\s+(["'])\/(?!\/)/gi, (_m, quote: string) => `@import ${quote}${prefix}/`);
}

async function handler(c: Context<{ Bindings: AppEnv }>) {
	const project = c.req.param("project") ?? "";
	if (!PROJECT_RE.test(project)) {
		return c.json({ error: "invalid_project" }, 400);
	}

	const prefix = `/preview/${project}`;
	const incoming = new URL(c.req.url);
	const rest = incoming.pathname.startsWith(prefix)
		? incoming.pathname.slice(prefix.length) || "/"
		: "/";
	const target = `https://${project}.pages.dev${rest}${incoming.search}`;

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
			if (loc.hostname === `${project}.pages.dev`) {
				return c.redirect(`${prefix}${loc.pathname}${loc.search}`, status);
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
		return new Response(rewriteCss(css, prefix), {
			status: upstream.status,
			headers,
		});
	}

	return new Response(c.req.method === "HEAD" ? null : upstream.body, {
		status: upstream.status,
		headers,
	});
}

preview.get("/:project", handler);
preview.get("/:project/*", handler);
