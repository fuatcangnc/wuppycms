/**
 * AI: (a) içerik üretimi mock sağlayıcıyla, (b) ajan koşusu + araç çağrısı +
 * gerçek commit + Undo. Sağlayıcı global setup'ta mock uca bağlanır.
 */

import { test, expect } from "../fixtures";
import type { APIRequestContext } from "@playwright/test";

const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";

async function readDoc(request: APIRequestContext, repo: string): Promise<string> {
	const params = new URLSearchParams({ full_name: repo, path: DOC_PATH, ref: "main" });
	const res = await request.get(`/api/git/file?${params}`);
	expect(res.ok()).toBe(true);
	return ((await res.json()) as { content: string }).content;
}

test.describe("AI", () => {
	test("üret → önizle → gövdeye ekle", async ({ admin, page }) => {
		page.on("dialog", (dialog) => void dialog.accept());
		await admin.goToDoc("blog", "merhaba-dunya");

		await page.getByRole("button", { name: "Generate with AI" }).click();
		await expect(page.getByRole("dialog")).toBeVisible();

		const prompt = page.locator('textarea[aria-label="AI istemi"]');
		await prompt.fill("E2E üretim istemi");
		await page.getByRole("button", { name: "Generate", exact: true }).click();

		await expect(page.getByText(/ÜRETİLDİ/)).toBeVisible({ timeout: 30_000 });
		await page.getByRole("button", { name: "Insert into body" }).click();
		await expect(page.getByRole("dialog")).toHaveCount(0);
		await expect(page.locator('[contenteditable="true"]').first()).toContainText("ÜRETİLDİ");
	});

	test("ajan: LIST aracı, WRITE commit'i ve Undo", async ({ admin, page, request, serverInfo }) => {
		await admin.goToSite();
		await page.getByTestId("agent-launcher").click();
		await expect(page.getByTestId("agent-widget")).toBeVisible();

		const composer = page.getByPlaceholder("Ask for the next changes…");

		// 1) Araç çağrısı + akışlı yanıt.
		await composer.fill("LIST the site info");
		await page.keyboard.press("Enter");
		await expect(page.getByText(/calls completed/)).toBeVisible({ timeout: 90_000 });
		await expect(page.getByText(/İşlem tamam\. Mock agent\./)).toBeVisible({ timeout: 90_000 });
		// Seçim bloğu sohbette ham görünmemeli.
		await expect(page.getByText("[SELECTED ELEMENTS]", { exact: false })).toHaveCount(0);

		// 2) Yazma aracı gerçek commit üretir.
		const original = await readDoc(request, serverInfo.repoFullName);
		await composer.fill("WRITE the title");
		await page.keyboard.press("Enter");

		await expect(page.getByRole("button", { name: "Undo" })).toBeVisible({ timeout: 120_000 });
		await expect.poll(async () => readDoc(request, serverInfo.repoFullName), { timeout: 30_000 }).toContain(
			"Mock agent başlığı",
		);

		// 3) Undo geri commit'ler.
		await page.getByRole("button", { name: "Undo" }).click();
		await expect(page.getByText("Undone")).toBeVisible({ timeout: 30_000 });
		await expect
			.poll(async () => readDoc(request, serverInfo.repoFullName), { timeout: 30_000 })
			.toContain("title: Merhaba dünya");
		expect(original).toContain("title: Merhaba dünya");
	});
});
