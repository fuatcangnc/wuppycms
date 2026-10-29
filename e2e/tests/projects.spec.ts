// Projects ekranı + GitHub App durumu — kurulum yokken "App'i kur" kartı,
// mock reponun listelenmesi ve durum API'sinin sözleşmesi.

import { expect, test } from "@playwright/test";

test.describe("projects / GitHub App", () => {
	test("kurulum yokken App kartını gösterir ve repoyu listeler", async ({ page }) => {
		await page.goto("/projects");
		await expect(page.getByRole("heading", { name: "Your projects" })).toBeVisible();

		// Sunucu durumu: app yapılandırılmış, kurulum yok.
		await expect(page.getByText("No GitHub App installation yet.")).toBeVisible();
		await expect(page.getByRole("link", { name: "Install GitHub App" }).first()).toBeVisible();

		await page.getByRole("button", { name: /New project/i }).click();
		await expect(page.getByText("mock/site", { exact: true })).toBeVisible();
	});

	test("status ucu app + installations sözleşmesini döner", async ({ page }) => {
		const res = await page.request.get("/api/github/app/status");
		expect(res.ok()).toBeTruthy();
		const data = (await res.json()) as {
			app: { configured: boolean; slug: string; installUrl: string; manageUrl: string };
			installations: unknown[];
		};
		expect(data.app.configured).toBe(true);
		expect(data.app.slug).toBe("wuppycms");
		expect(data.app.installUrl).toBe("/api/github/app/install");
		expect(data.installations).toEqual([]);
	});

	test("kurulum ucu oturumu GitHub'a yönlendirir", async ({ page }) => {
		const res = await page.request.get("/api/github/app/install", { maxRedirects: 0 });
		expect(res.status()).toBe(302);
		const location = res.headers()["location"] ?? "";
		expect(location).toContain("https://github.com/apps/wuppycms/installations/new");
		expect(location).toContain("state=");
	});
});
