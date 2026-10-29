// @astrojs/cloudflare'ın tip yayınlamayan giriş noktaları için yerel bildirimler.

declare module "@astrojs/cloudflare/entrypoints/server" {
	const server: {
		fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>;
	};
	export default server;
}

declare module "@astrojs/cloudflare/hono" {
	import type { MiddlewareHandler } from "hono";
	/** Cloudflare varlık karşılama + yanıt sonlandırma middleware'i. */
	export function cf(): MiddlewareHandler;
}
