/**
 * Yönlendirme sözleşmesi (ADR 0005) + i18n açılış dili.
 */

import { test, expect } from "../fixtures";

test.describe("Navigation", () => {
	test("/cms eski adresi /admin'e yönlenir", async ({ page }) => {
		await page.goto("/cms");
		await expect(page).toHaveURL(/\/admin/);
	});

	test("eski /admin/c/{koleksiyon} biçimi kanonik adrese normalleşir", async ({ admin, page }) => {
		await admin.goto("/admin/c/blog");
		await admin.waitForShell();
		await expect(page).toHaveURL(/\/admin\/site\/content\/blog/);
	});

	test("derin bağlantı doğrudan dokümanı açar", async ({ admin, page }) => {
		await admin.goto("/admin/site/content/blog/merhaba-dunya");
		await admin.waitForShell();
		await expect(page).toHaveURL(/\/content\/blog\/merhaba-dunya/);
		await expect(page.getByText("Merhaba dünya").first()).toBeVisible({ timeout: 30_000 });
	});

	test("site ekle sihirbazı repo listesini gösterir", async ({ admin, page }) => {
		await admin.goToSite();
		// TopBar'daki site menüsünü aç, sonra "+ Add site".
		await page.getByTestId("site-menu").click();
		await page.getByRole("button", { name: /Add site/ }).first().click();
		await expect(page.getByRole("dialog")).toBeVisible();
		// Mock GitHub tek repo döndürür.
		await expect(page.getByText("mock/site").first()).toBeVisible({ timeout: 30_000 });
		await page.keyboard.press("Escape");
	});
});

test.describe("i18n", () => {
	test("kayıtlı dil Türkçe ise arayüz Türkçe açılır", async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem("wuppycms:locale", "tr"));
		await page.goto("/admin");
		await page.waitForSelector("#sidebar", { timeout: 30_000 });
		await expect(page.locator("#sidebar").getByText("Siteler")).toBeVisible();
		await expect(page.locator("#sidebar").getByText("İçerik")).toBeVisible();
	});

	test("kayıtlı dil İngilizce ise arayüz İngilizce açılır", async ({ page }) => {
		await page.addInitScript(() => localStorage.setItem("wuppycms:locale", "en"));
		await page.goto("/admin");
		await page.waitForSelector("#sidebar", { timeout: 30_000 });
		await expect(page.locator("#sidebar").getByText("Sites", { exact: true })).toBeVisible();
		await expect(page.locator("#sidebar").getByText("Content", { exact: true })).toBeVisible();
	});
});
