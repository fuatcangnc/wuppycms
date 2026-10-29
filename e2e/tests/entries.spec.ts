/**
 * Kayıt listesi görünümleri (liste/pano/takvim) ve çöp döngüsü.
 */

import { test, expect } from "../fixtures";

test.describe("Entries & Trash", () => {
	test("liste / pano / takvim anahtarları adreste taşınır", async ({ admin, page }) => {
		await admin.goToContent("blog");
		await expect(page.getByText("Merhaba dünya").first()).toBeVisible({ timeout: 30_000 });

		await page.getByRole("button", { name: "Board" }).click();
		await expect(page).toHaveURL(/view=board/);
		await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();

		await page.getByRole("button", { name: "Calendar" }).click();
		await expect(page).toHaveURL(/view=calendar/);
		await expect(page.getByText("Mo", { exact: true }).first()).toBeVisible();

		await page.getByRole("button", { name: "List" }).click();
		await expect(page).not.toHaveURL(/view=/);
	});

	test("çöp: sil, geri yükle, listede tekrar gör", async ({ admin, page }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToDoc("blog", "merhaba-dunya");
		await expect(page.getByTitle("Delete document")).toBeEnabled({ timeout: 30_000 });

		await page.getByTitle("Delete document").click();
		await expect(page).toHaveURL(/\/content\/blog(\?|$)/, { timeout: 30_000 });
		await expect(page.getByText("Merhaba dünya")).toHaveCount(0);

		await admin.goToTrash();
		await expect(page.getByText("_trash/", { exact: false }).first()).toBeVisible({ timeout: 30_000 });
		await page.getByRole("button", { name: "Restore" }).first().click();
		// Geri yükleme commit'i bitmeden gezinme → istek iptal olur.
		await expect(page.getByText("Trash is empty.")).toBeVisible({ timeout: 30_000 });

		await admin.goToContent("blog");
		await expect(page.getByText("Merhaba dünya").first()).toBeVisible({ timeout: 30_000 });
	});
});
