// Vitest — birim testler saf mantık içindir (yönlendirici, frontmatter,
// adlandırma, biçimlendirme); DOM/derleyici gerekmez, node ortamı yeter.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
