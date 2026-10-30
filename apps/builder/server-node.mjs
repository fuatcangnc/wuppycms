// AWS (Lambda / Node) girişi: Hono API + Astro Node handler.
//
// - `/api/*` ve `/preview/*` → Hono (mevcut API, değişmeden)
// - diğerleri → Astro Node standalone handler
//
// Env, `globalThis.__WUPPYCMS_ENV__` üzerine konur; `cloudflare:workers`
// shim'i (cf-shim.ts) buradan okur.

import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { awsApp } from "./dist-node/api.mjs";
import { createNodePlatform } from "./dist-node/platform.mjs";
import { handler as astro } from "./dist/server/entry.mjs";

const platform = createNodePlatform();
const env = {
	...process.env,
	DB: platform.db,
	SQLITE_RAW: platform.raw,
	MEDIA_R2: platform.blobs,
};
globalThis.__WUPPYCMS_ENV__ = env;

const apiListener = getRequestListener((request) =>
	awsApp.fetch(request, env, {
		waitUntil: (promise) => {
			void promise;
		},
		passThroughOnException: () => undefined,
	}),
);

const notFound = (_req, res) => {
	res.statusCode = 404;
	res.end("Not found");
};

const server = createServer((req, res) => {
	const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
	if (url.pathname.startsWith("/api") || url.pathname.startsWith("/preview")) {
		return apiListener(req, res);
	}
	return astro(req, res, () => notFound(req, res));
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0", () => {
	console.log(`[wuppycms] listening on :${port}`);
});
