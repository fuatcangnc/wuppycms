// AWS (Lambda / Node) girişi: Hono API + Astro Node handler.
//
// - `/api/*` ve `/preview/*` → Hono (mevcut API, değişmeden)
// - diğerleri → Astro Node standalone handler
//
// Env, `globalThis.__WUPPYCMS_ENV__` üzerine konur; `cloudflare:workers`
// shim'i (cf-shim.ts) buradan okur.

import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
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

const CLIENT_DIR = new URL("./dist/client", import.meta.url).pathname;
const TYPES = {
	".html": "text/html; charset=utf-8",
	".htm": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".avif": "image/avif",
	".gif": "image/gif",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".wasm": "application/wasm",
	".txt": "text/plain; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".webmanifest": "application/manifest+json",
};

function serveStatic(req, res, pathname) {
	try {
		const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
		if (!rel || rel.includes("..")) return false;
		const file = normalize(join(CLIENT_DIR, rel));
		if (!file.startsWith(CLIENT_DIR)) return false;
		const stat = statSync(file);
		if (!stat.isFile()) return false;
		res.statusCode = 200;
		res.setHeader("content-type", TYPES[extname(file)] ?? "application/octet-stream");
		res.setHeader("content-length", stat.size);
		res.setHeader(
			"cache-control",
			rel.startsWith("_astro/") ? "public, max-age=31536000, immutable" : "public, max-age=60",
		);
		if (req.method === "HEAD") {
			res.end();
			return true;
		}
		createReadStream(file).pipe(res);
		return true;
	} catch {
		return false;
	}
}

const notFound = (_req, res) => {
	res.statusCode = 404;
	res.end("Not found");
};

const server = createServer((req, res) => {
	const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
	if (url.pathname.startsWith("/api") || url.pathname.startsWith("/preview")) {
		return apiListener(req, res);
	}
	if (serveStatic(req, res, url.pathname)) return;
	return astro(req, res, () => notFound(req, res));
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, "0.0.0.0", () => {
	console.log(`[wuppycms] listening on :${port}`);
});
