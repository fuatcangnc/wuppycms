/**
 * AI widget yüzeyi — deterministik kısım (model çağrısı YOK).
 * Launcher, çekmece, boş durum, canvas ve köprü durumu doğrulanır.
 * Agent adımları (agent.act) bu suite'in kapsamı dışındadır.
 */

import { test, expect } from "../fixtures";

test.describe("AI widget", () => {
	test("launcher widget'ı açar ve boş durumu çizer", async ({ admin, page }) => {
		await admin.goToSite();

		await page.getByTestId("agent-launcher").click();
		await expect(page.getByTestId("agent-widget")).toBeVisible();
		await expect(page.getByText("WuppyCMS Agent")).toBeVisible();
		await expect(page.getByText("Ask for the next change")).toBeVisible();
	});

	test("önizleme köprüsü yokken seçici devre dışı", async ({ admin, page }) => {
		await admin.goToSite();
		await page.getByTestId("agent-launcher").click();
		await expect(page.getByTestId("agent-widget")).toBeVisible();

		// Mock sitenin URL'i erişilemez (demo.wuppycms.dev); köprü betiği yüklenmez.
		await expect(page.getByText("no bridge")).toBeVisible({ timeout: 30_000 });
		await expect(page.getByTestId("agent-pick")).toBeDisabled();
	});

	test("Esc widget'ı kapatır", async ({ admin, page }) => {
		await admin.goToSite();
		await page.getByTestId("agent-launcher").click();
		await expect(page.getByTestId("agent-widget")).toBeVisible();

		await page.keyboard.press("Escape");
		await expect(page.getByTestId("agent-widget")).toHaveCount(0);
		await expect(page.getByTestId("agent-launcher")).toBeVisible();
	});

	test("sohbet geçmişi rayı varsayılan açık; düğmeyle kapanıp açılır", async ({ admin, page }) => {
		await admin.goToSite();
		await page.getByTestId("agent-launcher").click();
		await expect(page.getByTestId("agent-widget")).toBeVisible();

		// Varsayılan genişlik (460) ray eşiğinin (430) üstünde: ray açık doğar.
		const rail = page.getByRole("navigation", { name: "Chat history" });
		const newChat = rail.getByRole("button", { name: "New chat" });
		await expect(newChat).toBeVisible();

		const toggle = page.getByRole("button", { name: /chat history/i }).first();
		await toggle.click();
		await expect(rail).toHaveCount(0);

		await toggle.click();
		await expect(rail.getByRole("button", { name: "New chat" })).toBeVisible();
	});
});
