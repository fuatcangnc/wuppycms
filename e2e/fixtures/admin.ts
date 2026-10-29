/**
 * WuppyCMS Admin page object — EmDash `e2e/fixtures/admin.ts` deseninin
 * uyarlaması. Testler ham seçici yazmaz; bu API'yi kullanır.
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export interface ServerInfo {
	baseUrl: string;
	repoFullName: string;
	projectId: string;
	mockToken: string;
	mockApiPort: number;
}

/** `mock/site` → URL'deki site kısa adı. */
export const siteSlug = "site";

export class AdminPage {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	/** Astro adasının hidrasyonunu bekle. */
	async waitForHydration(timeout = 30_000): Promise<void> {
		await this.page.waitForSelector("astro-island:not([ssr])", { timeout }).catch(() => undefined);
	}

	/** Vite hata katmanı sayfayı kapatıyorsa kaldır (EmDash ile aynı). */
	async dismissViteOverlay(): Promise<void> {
		await this.page
			.evaluate(() => {
				document.querySelectorAll("vite-error-overlay").forEach((element) => element.remove());
			})
			.catch(() => undefined);
	}

	/** Admin kabuğu kullanılabilir mi: sidebar + AI launcher. */
	async waitForShell(): Promise<void> {
		await this.dismissViteOverlay();
		await this.page.waitForSelector("#sidebar", { timeout: 30_000 });
		await this.page.waitForSelector('[data-testid="agent-launcher"]', { timeout: 30_000 });
		await this.waitForHydration();
		await this.dismissViteOverlay();
	}

	async goto(path = "/admin"): Promise<void> {
		await this.page.goto(path, { waitUntil: "domcontentloaded" });
	}

	/** Site görünümü: `/admin/{slug}` (URL kanonikleşir, `?site=` eklenir). */
	async goToSite(): Promise<void> {
		await this.goto(`/admin/${siteSlug}`);
		await this.waitForShell();
	}

	async goToContent(collection = "blog"): Promise<void> {
		await this.goto(`/admin/${siteSlug}/content/${collection}`);
		await this.waitForShell();
	}

	async goToDoc(collection: string, slug: string): Promise<void> {
		await this.goto(`/admin/${siteSlug}/content/${collection}/${slug}`);
		await this.waitForShell();
	}

	async goToMedia(): Promise<void> {
		await this.goto(`/admin/${siteSlug}/media`);
		await this.waitForShell();
	}

	async goToTrash(): Promise<void> {
		await this.goto(`/admin/${siteSlug}/trash`);
		await this.waitForShell();
	}

	async goToReviews(): Promise<void> {
		await this.goto(`/admin/${siteSlug}/reviews`);
		await this.waitForShell();
	}

	/** Site ayarları — SAYFA (modal değil). */
	async goToSettings(): Promise<void> {
		await this.goto(`/admin/${siteSlug}/settings`);
		await this.waitForShell();
	}

	/** FRONTMATTER meta panelini açar (varsayılan kapalı). */
	async openMetaPanel(): Promise<void> {
		const toggle = this.page.locator('[data-panel-toggle="meta"]');
		await toggle.click();
		await this.page.getByRole("tab", { name: "YAML" }).waitFor({ state: "visible", timeout: 15_000 });
	}

	/** Sol menüden site seç. */
	async selectSite(name = "site"): Promise<void> {
		await this.page.locator("#sidebar").getByRole("button", { name, exact: false }).first().click();
		await this.waitForShell();
	}

	/** Kenar çubuğundaki site ayarları düğmesi. */
	async openSettingsFromSidebar(): Promise<void> {
		await this.page.locator("#sidebar").getByRole("button", { name: "Site settings" }).click();
		await this.waitForShell();
	}

	/** Liste görünümünde metni bekle. */
	async expectText(text: string | RegExp): Promise<void> {
		await expect(this.page.getByText(text).first()).toBeVisible();
	}

	/** Kenar çubuğu görünür ve doğru site seçili. */
	async expectShellForSite(name = "site"): Promise<void> {
		await expect(this.page.locator("#sidebar")).toBeVisible();
		await expect(this.page.locator("#sidebar").getByText(name, { exact: false }).first()).toBeVisible();
	}
}
