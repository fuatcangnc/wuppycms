import { defineConfig, devices } from "@playwright/test";

/**
 * WuppyCMS E2E — EmDash'in Playwright düzeninin WuppyCMS'ye uyarlanmış hâli.
 *
 * Mantık (emdash-main/playwright.config.ts ile aynı):
 *  - Testler izole bir fixture ortamına koşar, geliştiricinin 4321'deki
 *    sunucusuna değil. `global-setup.ts` sahte GitHub'ı + kendi dev sunucusunu
 *    (4444) başlatır, oturumu ve proje kaydını hazırlar, admin'i ısıtır.
 *  - `global-teardown.ts` sunucuyu durdurur, geçici durumu temizler.
 *  - Paylaşılan D1 durumu yüzünden paralellik kapalı (workers: 1).
 *  - Hata ayıklama: `trace: on-first-retry`, `screenshot: only-on-failure`.
 */
export default defineConfig({
	testDir: "./e2e/tests",
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["line"], ["github"], ["html"]] : "html",
	// workerd (Cloudflare dev) soğuk derlemede yavaş; EmDash de bu yüzden
	// zaman aşımını yükseltiyor.
	timeout: 90_000,

	globalSetup: "./e2e/global-setup.ts",
	globalTeardown: "./e2e/global-teardown.ts",

	use: {
		baseURL: "http://localhost:4444",
		// global-setup bu dosyayı yazar (dev@wuppycms.local oturumu).
		storageState: ".e2e/storage-state.json",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "off",
		launchOptions: {
			// Sistemde kurulu Chromium'u kullan: ayrı tarayıcı indirmeye gerek yok.
			executablePath: process.env.WUPPYCMS_CHROMIUM ?? "/usr/bin/chromium",
			args: ["--no-sandbox", "--disable-dev-shm-usage"],
		},
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// webServer YOK — sunucu yaşam döngüsü global-setup/teardown'da.
});
