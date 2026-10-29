/**
 * Site ayarları — SAYFA olmalı, modal değil (kullanıcı isteği).
 *
 * Kanıt eksenleri:
 *  1. `/admin/site/settings` adresi doğrudan açılır (derin bağlantı).
 *  2. Sayfa render edilirken hiçbir `role="dialog"` yoktur.
 *  3. Alanlar gerçek form kontrolleridir; yazarken odak korunur.
 *  4. Kaydet gerçek bir commit üretir ve genel bakışa döner.
 *  5. Kenar çubuğundaki "Site settings" aynı sayfaya gider (modal açmaz).
 */

import { test, expect } from "../fixtures";

/** Mock depodaki `.wuppycms/sites.jsonc` yazımını geri alır. */
async function saveUrl(admin: import("../fixtures/admin").AdminPage, url: string): Promise<void> {
	await admin.goToSettings();
	await admin.page.getByLabel("Website URL").fill(url);
	await admin.page.getByTestId("settings-save").click();
	await expect(admin.page).toHaveURL(/\/admin\/site(\?|$)/, { timeout: 30_000 });
}

test.describe("Site settings sayfası", () => {
	test("derin bağlantı sayfayı açar, modal açmaz", async ({ admin, page }) => {
		await admin.goToSettings();

		await expect(page).toHaveURL(/\/admin\/site\/settings/);
		await expect(page.getByTestId("settings-page")).toBeVisible();
		// Regresyon: eski sürüm burada DialogShell açıyordu.
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "Configure site" })).toBeVisible();
	});

	test("alanlar erişilebilir; yazarken odak kaybolmaz", async ({ admin, page }) => {
		await admin.goToSettings();

		const url = page.getByLabel("Website URL");
		await expect(url).toBeVisible();
		await expect(page.getByLabel("Media folder")).toBeVisible();
		await expect(page.getByText("Link format")).toBeVisible();
		await expect(page.getByText("Publishing mode")).toBeVisible();
		await expect(page.getByText("Members")).toBeVisible();

		const original = await url.inputValue();
		await url.click();
		await page.keyboard.press("End");
		await page.keyboard.type("-focus-check");
		await expect(url).toHaveValue(`${original}-focus-check`);
		await expect(url).toBeFocused();

		// Değişikliği commit'lemeden bırak.
		await page.getByTestId("settings-discard").click();
		await expect(page).toHaveURL(/\/admin\/site(\?|$)/);
	});

	test("kenar çubuğu 'Site settings' modal değil aynı sayfaya gider", async ({ admin, page }) => {
		await admin.goToSite();
		await admin.openSettingsFromSidebar();

		await expect(page).toHaveURL(/\/admin\/site\/settings/);
		await expect(page.getByTestId("settings-page")).toBeVisible();
		await expect(page.getByRole("dialog")).toHaveCount(0);
	});

	test("kaydet: sites.jsonc commit'i üretir ve genel bakışa döner", async ({ admin, page, request, serverInfo }) => {
		await admin.goToSettings();
		const original = await page.getByLabel("Website URL").inputValue();
		const next = "https://settings-e2e.example.com";

		try {
			await page.getByLabel("Website URL").fill(next);
			await page.getByTestId("settings-save").click();

			await expect(page).toHaveURL(/\/admin\/site(\?|$)/, { timeout: 30_000 });
			await expect(page.getByText(next).first()).toBeVisible({ timeout: 30_000 });

			// Yan etki: depoda gerçek bir commit (ADR 0006 — durum repoda).
			const params = new URLSearchParams({
				full_name: serverInfo.repoFullName,
				path: ".wuppycms/sites.jsonc",
				per_page: "5",
			});
			const res = await request.get(`/api/git/commits?${params}`);
			expect(res.ok()).toBe(true);
			const data = (await res.json()) as { commits: Array<{ message: string }> };
			expect(data.commits[0]?.message).toContain("site config");
		} finally {
			// Diğer testler için başlangıç durumuna dön.
			await saveUrl(admin, original);
		}
	});
});
