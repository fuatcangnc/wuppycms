/**
 * Medya yöneticisi — klasör, yükleme, alt metin, silme.
 * Mock depo + mock raw görsel proxy'si sayesinde ağsız çalışır.
 */

import { test, expect } from "../fixtures";

/** 1×1 saydam PNG. */
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
	"base64",
);

test.describe("Media", () => {
	test("klasör açar, dosya yükler, alt metin yazar ve siler", async ({ admin, page }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToMedia();

		// Klasör (benzersiz ad → koşular arası çakışma yok).
		const folder = `e2e-${Date.now()}`;
		await page.getByRole("button", { name: "+ Klasör" }).click();
		await page.getByPlaceholder("folder name…").fill(folder);
		await page.getByRole("button", { name: "Oluştur" }).click();
		const folderButton = page.getByRole("button", { name: `${folder}/` });
		await expect(folderButton).toBeVisible({ timeout: 30_000 });

		// Klasiğe gir ve yükle.
		await folderButton.click();
		const filename = `e2e-${Date.now()}.png`;
		await page.locator('input[type="file"]').setInputFiles({
			name: filename,
			mimeType: "image/png",
			buffer: PNG,
		});
		const card = page.locator(`[data-testid="media-card"][data-path$="${filename}"]`);
		await expect(card).toBeVisible({ timeout: 30_000 });

		// Detay → alt metin → kaydet.
		await card.getByRole("button", { name: filename }).click();
		await expect(page.getByRole("dialog")).toBeVisible();
		await page.getByLabel("Alt text").fill("E2E alt metni");
		await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
		await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 30_000 });

		await card.getByRole("button", { name: filename }).click();
		await expect(page.getByLabel("Alt text")).toHaveValue("E2E alt metni");
		await page.keyboard.press("Escape");

		// Sil (dosya baytı mock depodan gider).
		await card.hover();
		await card.getByTestId("media-delete").click();
		await expect(card).toHaveCount(0, { timeout: 30_000 });
	});

	test("arama ve görünüm anahtarları çalışır", async ({ admin, page }) => {
		await admin.goToMedia();

		const search = page.getByPlaceholder("search by filename…");
		await expect(search).toBeVisible();
		await search.fill("olmayan-dosya-xyz");
		await expect(page.getByTestId("media-card")).toHaveCount(0);
		await search.fill("");

		const list = page.getByTitle("List view");
		await list.click();
		await expect(list).toHaveAttribute("aria-pressed", "true");
		await page.getByTitle("Grid view").click();
	});
});
