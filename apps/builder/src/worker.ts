// Worker girişi: Hono API + Astro.
//
// İstek akışı: cf() middleware'i statik varlıkları Cloudflare Assets'ten
// karşılar ve yanıtı sonlandırır; /api/* Hono route'larına, kalan her şey
// Astro sunucusuna gider. (Hono + Astro entegrasyonu: @astrojs/cloudflare/hono)

import { Hono } from "hono";
import { cf } from "@astrojs/cloudflare/hono";
import server from "@astrojs/cloudflare/entrypoints/server";
import { api } from "./api/app";
import { preview } from "./api/preview";
import { runScheduled } from "./api/schedule";
import type { AppEnv } from "./api/types";

const app = new Hono<{ Bindings: AppEnv }>();

// www. ile gelen istekler aynı adresin www'suz hâline kalıcı yönlendirilir:
// kanonik tek_host tek tutulur (better-auth tek origin bekler, SEO da ister).
// www de custom domain olarak bu Worker'a bağlıdır (wrangler.jsonc routes).
app.use("*", async (c, next) => {
	const url = new URL(c.req.url);
	if (url.hostname.startsWith("www.")) {
		url.hostname = url.hostname.slice(4);
		return c.redirect(url.toString(), 301);
	}
	await next();
});

app.use(cf());

app.route("/api", api);
app.route("/preview", preview);

// --- WebContainer denemesi (geçici spike) -----------------------------------
// Tarayıcıda Node.js (WASM) çalıştırmak için sayfa cross-origin isolated
// olmalı: COOP/COEP. Boot başarılıysa gerçek site tarball'ı ile denenecek.
const SANDBOX_HTML = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>WebContainer spike</title></head>
<body style="font-family:system-ui;padding:24px">
<h1>WebContainer spike</h1>
<pre id="log" style="background:#111;color:#0f0;padding:12px;min-height:200px;white-space:pre-wrap"></pre>
<script type="module">
const log = (m) => { document.getElementById("log").textContent += m + "\\n"; };
window.__wcOk = false; window.__wcErr = null;
try {
  const { WebContainer } = await import("https://esm.sh/@webcontainer/api@1.6.4");
  log("module loaded");
  const wc = await WebContainer.boot();
  log("booted");
  await wc.mount({
    "package.json": { file: { contents: JSON.stringify({ name: "spike", type: "module" }) } },
    "index.js": { file: { contents: 'console.log("hello from webcontainer")' } }
  });
  log("mounted");
  const p = await wc.spawn("node", ["index.js"]);
  p.output.pipeTo(new WritableStream({ write(chunk) { log("OUT " + chunk); } }));
  const code = await p.exit;
  log("exit " + code);
  window.__wcOk = code === 0;
} catch (e) {
  log("ERR " + (e && e.message ? e.message : e));
  window.__wcErr = String(e && e.message ? e.message : e);
}
</script></body></html>`;

app.get("/sandbox", (c) =>
	c.html(SANDBOX_HTML, 200, {
		"Cross-Origin-Opener-Policy": "same-origin",
		"Cross-Origin-Embedder-Policy": "require-corp",
		"Cross-Origin-Resource-Policy": "cross-origin",
		"Cache-Control": "no-store",
	}),
);

app.all("*", (c) => server.fetch(c.req.raw, c.env, c.executionCtx));

export default {
	fetch: app.fetch.bind(app),
	/**
	 * Cron Trigger (wrangler.jsonc `triggers.crons`) — zamanlanmış yayın
	 * yürütücüsü. Durum taşımaz; yalnız zamanı gelen `publishAt` dokümanlarını
	 * "ready" yapıp commit atar (ADR 0006).
	 */
	scheduled: (_event: ScheduledController, env: AppEnv, ctx: ExecutionContext) => {
		ctx.waitUntil(runScheduled(env));
	},
};
