/**
 * src/pages ağacı — .astro/.md/.mdx/.html dosyaları kenar çubuğunda görünür,
 * tıklanınca kaynak editörü açılır ve kaydet gerçek commit üretir.
 */

import { test, expect } from "../fixtures";

const ABOUT = "src/pages/about.md";

test.describe("Pages", () => {
	test("pages ağacı klasörleri ve sayfa dosyalarını gösterir", async ({ admin, page }) => {
		await admin.goToSite();

		await expect(page.getByRole("button", { name: "pages", exact: true })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByRole("button", { name: "index.astro", exact: true })).toBeVisible();
		await expect(page.getByRole("button", { name: "about.md", exact: true })).toBeVisible();

		// Alt klasör kapalı başlar; açınca içindeki dinamik sayfa görünür.
		await page.getByRole("button", { name: "blog", exact: true }).click();
		await expect(page.getByRole("button", { name: "[...slug].astro", exact: true })).toBeVisible();
	});

	test("sayfa kaynağı Monaco'da açılır, düzenlenir ve commit edilir", async ({ admin, page, request, serverInfo }) => {
		const params = new URLSearchParams({ full_name: serverInfo.repoFullName, path: ABOUT, ref: "main" });
		const before = await request.get(`/api/git/file?${params}`);
		expect(before.ok()).toBe(true);
		const original = ((await before.json()) as { content: string }).content;
		expect(original).toContain("title: About");

		await admin.goToSite();
		await page.getByRole("button", { name: "about.md", exact: true }).click();

		await expect(page).toHaveURL(/\/pages\/about\.md/);
		const editor = page.locator('[data-testid="page-editor"] .monaco-editor');
		await expect(editor).toBeVisible({ timeout: 60_000 });

		const marker = `E2E_MARKER_${Date.now()}`;
		try {
			// Monaco'ya odaklan ve model üzerinden deterministik ekle (headless
			// tuş basımı autocomplete ile yarışabiliyor).
			await editor.click();
			await page.evaluate((value) => {
				const api = (window as unknown as { __wuppycmsMonaco?: { editor: { getModels(): Array<{ getValue(): string; setValue(next: string): void }> } } }).__wuppycmsMonaco;
				const model = api?.editor.getModels()[0];
				if (!model) throw new Error("Monaco model bulunamadı");
				model.setValue(`${model.getValue()}\n${value}\n`);
			}, marker);
			await expect(page.getByTestId("page-save")).toBeEnabled({ timeout: 15_000 });

			const commit = page.waitForResponse(
				(r) => r.url().includes("/api/git/commit") && r.request().method() === "POST",
			);
			await page.getByTestId("page-save").click();
			expect((await commit).ok()).toBe(true);
			await expect(page.getByTestId("page-status")).toHaveText("Saved", { timeout: 30_000 });

			// Yan etki: depoda gerçek bir commit.
			const res = await request.get(`/api/git/file?${params}`);
			expect(res.ok()).toBe(true);
			expect(((await res.json()) as { content: string }).content).toContain(marker);
		} finally {
			// Diğer testler için dosyayı geri yükle — asla boş içerikle ezme.
			if (original.includes("title: About")) {
				await request.post("/api/git/commit", {
					data: {
						full_name: serverInfo.repoFullName,
						branch: "main",
						message: "test: restore about page",
						files: [{ path: ABOUT, content: original }],
					},
				});
			}
		}
	});
});
