/**
 * Ekip — sahip tarafı: davet üret, listele, bağlantı notunu gör, iptal et.
 */

import { test, expect } from "../fixtures";

test.describe("Team", () => {
	test("davet oluşturur, listeler ve iptal eder", async ({ admin, page }) => {
		await admin.goToSettings();

		const email = `e2e-${Date.now()}@example.com`;
		await page.getByLabel("Davet e-postası").fill(email);
		await page.getByRole("button", { name: "Invite" }).click();

		await expect(page.getByText(email)).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(/Invite link \(copied\)/)).toBeVisible({ timeout: 30_000 });

		await page.getByRole("button", { name: "revoke" }).click();
		await expect(page.getByText(email)).toHaveCount(0, { timeout: 30_000 });
	});
});
