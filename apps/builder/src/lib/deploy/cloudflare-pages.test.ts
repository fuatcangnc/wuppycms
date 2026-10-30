// Cloudflare Pages yardımcıları — proje adı deterministik ve sınırlı olmalı.

import { describe, expect, it } from "vitest";
import { pagesProjectName } from "./cloudflare-pages";

describe("pagesProjectName", () => {
	it("deterministik ve güvenli bir ad üretir", () => {
		const name = pagesProjectName("FuatCangnc/My Site_2");
		expect(name).toBe(pagesProjectName("fuatcangnc/my site_2"));
		expect(name).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/);
		expect(name.length).toBeLessThanOrEqual(58);
		expect(name.startsWith("wuppy-fuatcangnc-my-site-2-")).toBe(true);
	});

	it("benzer adlarda çakışmayı hash ile ayırır", () => {
		expect(pagesProjectName("a/repo")).not.toBe(pagesProjectName("b/repo"));
	});

	it("uzun adları kırpar", () => {
		const name = pagesProjectName(`owner/${"x".repeat(200)}`);
		expect(name.length).toBeLessThanOrEqual(58);
		expect(name.endsWith("-")).toBe(false);
	});
});

