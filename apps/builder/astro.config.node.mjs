// AWS/Node hedefi için Astro yapılandırması.
// Cloudflare yapılandırması (astro.config.mjs) varsayılan olarak korunur;
// AWS build'i bu dosyayı kullanır: `astro build --config astro.config.node.mjs`.

import { fileURLToPath } from "node:url";
import node from "@astrojs/node";
import base from "./astro.config.mjs";

const shim = fileURLToPath(new URL("./src/lib/platform/cf-shim.ts", import.meta.url));

export default {
	...base,
	adapter: node({ mode: "middleware" }),
	vite: {
		...base.vite,
		resolve: {
			...(base.vite?.resolve ?? {}),
			alias: {
				...(base.vite?.resolve?.alias ?? {}),
				"cloudflare:workers": shim,
			},
		},
	},
};
