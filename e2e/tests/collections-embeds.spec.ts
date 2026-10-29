/**
 * Koleksiyon sihirbazı + embed diyaloğu.
 */

import { test, expect } from "../fixtures";

test.describe("Collections & embeds", () => {
	test("yeni koleksiyon content.config.ts'e commit edilir", async ({ admin, page, request, serverInfo }) => {
		await admin.goToSite();

		await page.getByTitle("Add collection").click();
		await expect(page.getByRole("dialog")).toBeVisible();

		const key = `e2e${Date.now()}`;
		await page.getByLabel("Koleksiyon anahtarı").fill(key);
		await page.getByRole("button", { name: "Create collection" }).click();

		await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });
		await expect(page.getByText(new RegExp(key, "i")).first()).toBeVisible({ timeout: 30_000 });

		const params = new URLSearchParams({
			full_name: serverInfo.repoFullName,
			path: "src/content.config.ts",
			ref: "main",
		});
		const res = await request.get(`/api/git/file?${params}`);
		expect(res.ok()).toBe(true);
		expect(((await res.json()) as { content: string }).content).toContain(key);
	});

	test("embed: YouTube bağlantısı tanınır ve eklenir", async ({ admin, page }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToDoc("blog", "merhaba-dunya");

		await page.getByRole("button", { name: "Embed", exact: true }).click();
		await expect(page.getByRole("dialog")).toBeVisible();

		await page.getByLabel("Embed bağlantısı").fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		await expect(page.getByText(/Detected: YouTube/)).toBeVisible();
		await page.getByRole("button", { name: "Add", exact: true }).click();

		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator('iframe[src*="youtube"]').first()).toBeVisible({ timeout: 30_000 });
	});
});
