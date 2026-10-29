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
