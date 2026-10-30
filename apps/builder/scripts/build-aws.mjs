// AWS/Node derlemesi: Astro (Node adapter) + Hono API + platform bundle.
// Kullanım: node scripts/build-aws.mjs

import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { build } from "esbuild";

rmSync("dist-node", { recursive: true, force: true });

console.log("==> astro build (node adapter)");
execSync("pnpm exec astro build --config astro.config.node.mjs", { stdio: "inherit" });

const shared = {
	bundle: true,
	platform: "node",
	format: "esm",
	target: "node22",
	sourcemap: false,
	logLevel: "info",
	external: ["better-sqlite3", "@aws-sdk/*"],
};

console.log("==> api bundle");
await build({
	...shared,
	entryPoints: ["src/server-aws-api.ts"],
	outfile: "dist-node/api.mjs",
	alias: { "cloudflare:workers": "./src/lib/platform/cf-shim.ts" },
});

console.log("==> platform bundle");
await build({
	...shared,
	entryPoints: ["src/lib/platform/aws-node.ts"],
	outfile: "dist-node/platform.mjs",
});

console.log("==> tamam");
