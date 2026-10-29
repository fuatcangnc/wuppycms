/**
 * İçerik yüzeyi — tohumlanmış mock depodan liste ve doküman açma.
 * EmDash `content-crud.spec.ts`in deterministik ilk dilimi.
 */

import { test, expect } from "../fixtures";

test.describe("Content", () => {
	test("blog listesi tohumlanmış kaydı gösterir", async ({ admin, page }) => {
		await admin.goToContent("blog");
		await expect(page.getByText("Merhaba dünya").first()).toBeVisible({ timeout: 30_000 });
	});

	test("doküman açılır, frontmatter başlığı yüklenir", async ({ admin, page }) => {
		await admin.goToDoc("blog", "merhaba-dunya");

		await expect(page).toHaveURL(/\/content\/blog\/merhaba-dunya/);
		await expect(page.getByText("Merhaba dünya").first()).toBeVisible({ timeout: 30_000 });
		// Editör gövdesi (mdxeditor) çiziliyor.
		await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({ timeout: 30_000 });
	});

	test("çöp görünümü boş durumla açılır", async ({ admin, page }) => {
		await admin.goToTrash();
		await expect(page.getByTestId("settings-page")).toHaveCount(0);
		await expect(page.locator("#sidebar")).toBeVisible();
	});
});
