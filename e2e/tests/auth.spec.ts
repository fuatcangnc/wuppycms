/**
 * Auth — oturumsuz erişim login'e döner; oturumlu erişim admin'i açar.
 * EmDash `auth.spec.ts` ile aynı iki eksen.
 */

import { test, expect } from "../fixtures";

test.describe("Auth — oturumsuz", () => {
	// Bu blok storageState'i boşaltır: gerçekten anonim istemci.
	test.use({ storageState: { cookies: [], origins: [] } });

	test("korumalı /admin login'e yönlendirir", async ({ page }) => {
		await page.goto("/admin");
		await expect(page).toHaveURL(/\/login/);
		await expect(page).toHaveURL(/next=%2Fadmin|\/admin/);
	});

	test("login formu e-posta ve şifre alanlarıyla çizilir", async ({ page }) => {
		await page.goto("/login");
		await expect(page.locator('input[type="email"]')).toBeVisible();
		await expect(page.locator('input[type="password"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();
	});
});

test.describe("Auth — oturumlu", () => {
	test("kayıtlı oturum admin'i doğrudan açar", async ({ page }) => {
		await page.goto("/admin");
		await expect(page).toHaveURL(/\/admin/);
		await expect(page.locator("#sidebar")).toBeVisible();
	});
});
