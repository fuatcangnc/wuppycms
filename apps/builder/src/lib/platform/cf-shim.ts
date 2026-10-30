// `cloudflare:workers` yerine Node/AWS ortamında kullanılan shim.
// Astro sayfaları `getEnv()` üzerinden env okur; Node girişi gerçek env'i
// `globalThis.__WUPPYCMS_ENV__` üzerine koyar.

type Env = Record<string, unknown>;

export const env = new Proxy(
	{},
	{
		get(_target, key: string | symbol) {
			const source = (globalThis as Record<string, unknown>).__WUPPYCMS_ENV__ as
				| Env
				| undefined;
			return source?.[key as string];
		},
		has(_target, key: string | symbol) {
			const source = (globalThis as Record<string, unknown>).__WUPPYCMS_ENV__ as
				| Env
				| undefined;
			return key in (source ?? {});
		},
	},
) as Env;
