/**
 * Editör yüzeyi — meta panel (YAML/MD), sürüm geçmişi, bul-değiştir,
 * araştırma, taslak sekmeleri ve IndexedDB yedeği.
 */

import { test, expect } from "../fixtures";

test.describe("Editor", () => {
	test("YAML ve MD sekmeleri gerçek frontmatter'ı gösterir", async ({ admin, page }) => {
		await admin.goToDoc("blog", "merhaba-dunya");
		await admin.openMetaPanel();

		await page.getByRole("tab", { name: "YAML" }).click();
		const yaml = page.locator('textarea[aria-label="Frontmatter YAML"]');
		await expect(yaml).toBeVisible();
		await expect(yaml).toHaveValue(/title: Merhaba dünya/);

		await yaml.fill(`${await yaml.inputValue()}\ncustomE2E: yes`);
		await page.getByRole("button", { name: "Apply" }).click();
		await expect(yaml).toHaveValue(/customE2E: "?yes"?/);

		await page.getByRole("tab", { name: "MD" }).click();
		const md = page.locator('textarea[aria-label="Tam dosya"]');
		await expect(md).toBeVisible();
		await expect(md).toHaveAttribute("readonly", "");
		await expect(md).toHaveValue(/^---\ntitle: Merhaba dünya/);
	});

	test("geçmiş: anlık görüntü, diff ve sürüm yükleme", async ({ admin, page }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToDoc("blog", "merhaba-dunya");

		// Diff'in anlamlı olması için önce bir değişiklik yap.
		const body = page.locator('[contenteditable="true"]').first();
		await body.click();
		await page.keyboard.type(" E2E-HISTORY");

		await admin.openMetaPanel();
		await page.getByRole("tab", { name: "History" }).click();
		await page.getByRole("button", { name: "Snapshot" }).click();
		await expect(page.getByText("Snapshot taken.")).toBeVisible({ timeout: 30_000 });

		const commits = page.locator("ul li button");
		await expect(commits.first()).toBeVisible({ timeout: 30_000 });
		await commits.first().click();

		await expect(page.getByText("Version comparison")).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole("button", { name: "Load this version" })).toBeVisible();
		await page.getByRole("button", { name: "Load this version" }).click();
		await expect(page.getByText("Version comparison")).toHaveCount(0);
	});

	test("bul-değiştir ve araştırma paneli", async ({ admin, page }) => {
		await admin.goToDoc("blog", "merhaba-dunya");

		// Bul: eşleşme sayısı görünür.
		await page.getByRole("button", { name: "Find", exact: true }).click();
		const find = page.getByLabel("Find", { exact: true });
		await find.fill("Merhaba");
		await expect(page.getByText(/\d+ matches/)).toBeVisible();

		// Araştırma: not ekle + kaydet.
		await page.locator('[data-panel-toggle="research"]').click();
		await expect(page.locator('[data-panel="research"]')).toBeVisible();
		await page.getByRole("button", { name: "+ Add research" }).click();
		const note = `E2E not ${Date.now()}`;
		await page.getByLabel("Note, source, or quote…").fill(note);
		await page.getByRole("button", { name: "Add", exact: true }).click();
		await expect(page.getByText(note)).toBeVisible();
		await page.getByTestId("research-save").click();
		// Kaydet başarılı olunca kirli durum biter ve düğme kaybolur.
		await expect(page.getByTestId("research-save")).toHaveCount(0, { timeout: 30_000 });
	});

	test("taslak sekmesi: oluştur, geçiş yap, yenilemede koru", async ({ admin, page }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToDoc("blog", "merhaba-dunya");

		await page.getByRole("button", { name: "+ Draft" }).click();
		await page.getByRole("button", { name: "Blank draft" }).click();
		const draftTab = page.getByRole("button", { name: /Draft 1|Draft 2/ }).first();
		await expect(draftTab).toBeVisible();

		const body = page.locator('[contenteditable="true"]').first();
		await body.click();
		await page.keyboard.type("E2E-TASLAK");
		await expect(body).toContainText("E2E-TASLAK");

		// Main'e geç, sonra taslağa dön: içerik korunur.
		await page.getByRole("button", { name: "Main", exact: true }).click();
		await draftTab.click();
		await expect(page.locator('[contenteditable="true"]').first()).toContainText("E2E-TASLAK");

		// Yenileme sonrası taslak IndexedDB'den geri gelir.
		await page.reload({ waitUntil: "domcontentloaded" });
		await admin.waitForShell();
		await expect(page.getByRole("button", { name: /Draft 1|Draft 2/ }).first()).toBeVisible({ timeout: 30_000 });
	});

	test("kaydedilmemiş değişiklik yedeği geri yüklenir", async ({ admin, page }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToDoc("blog", "merhaba-dunya");

		const body = page.locator('[contenteditable="true"]').first();
		await body.click();
		const marker = ` E2E-BACKUP-${Date.now()}`;
		await page.keyboard.type(marker);
		await page.waitForTimeout(900); // IndexedDB yedeği 600 ms debounce

		await page.reload({ waitUntil: "domcontentloaded" });
		await admin.waitForShell();
		await expect(page.getByText(/unsaved draft backup exists/)).toBeVisible({ timeout: 30_000 });
		await page.getByRole("button", { name: "Restore" }).click();
		await expect(page.locator('[contenteditable="true"]').first()).toContainText(marker.trim());
	});
});
