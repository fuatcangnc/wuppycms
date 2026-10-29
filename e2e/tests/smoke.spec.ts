/**
 * Smoke (Doctor) — EmDash'in "admin shell is worth driving" kontrolü.
 * Config yükleniyor mu, sunucu ayakta mı, oturum geri geliyor mu, kabuk çiziliyor mu.
 */

import { test, expect } from "../fixtures";

test.describe("Smoke", () => {
	test("API sağlık yanıtı veriyor", async ({ request }) => {
		const res = await request.get("/api/health");
		expect(res.status()).toBe(200);
		expect(await res.json()).toMatchObject({ ok: true, service: "wuppycms-builder" });
	});

	test("oturum açık: admin kabuğu iskeletsiz çiziliyor", async ({ admin, page }) => {
		await admin.goto("/admin");
		await admin.waitForShell();

		await expect(page.locator("#sidebar")).toBeVisible();
		await expect(page.locator("#sidebar").getByText("Sites")).toBeVisible();
		await expect(page.locator("#sidebar").getByText("site", { exact: false }).first()).toBeVisible();
		await expect(page.getByTestId("agent-launcher")).toBeVisible();
	});

	test("site görünümü kanonik adrese oturuyor", async ({ admin, page }) => {
		await admin.goToSite();
		await expect(page).toHaveURL(/\/admin\/site/);
		await expect(page).toHaveURL(/site=/);
		await admin.expectShellForSite();
	});
});
