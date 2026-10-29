// Taslak sekmeleri dumanı (Wryte "Main / + Draft" paritesi): makale başına
// yerel çalışma kopyaları. Main'den kopyala/boş oluştur, sekmeler arası geçiş,
// yenileme sonrası IndexedDB kalıcılığı ve silme doğrulanır.
// Koşum: node scripts/e2e-draft-tabs.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4384).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4384 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const SOURCE = 'textarea[aria-label="Markdown kaynağı"]';
const MARKER = "TASLAK-SEKME-KANITI";

const results = [];
const step = (name, cond, extra = "") => {
	results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
	if (!cond) process.exitCode = 1;
};

let env = null;
let mock = null;
if (MOCK) {
	env = await startMockEnv({
		appDir: fileURLToPath(new URL("..", import.meta.url)),
		port: PORT,
		fullName: REPO,
		branch: "main",
		logFile: "/tmp/opencode/e2e-draft-tabs-dev.log",
	});
	mock = env.mock;
	seedSite(mock);
}

const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
	const page = await browser.newPage();
	await page.setViewport({ width: 1440, height: 900 });
	if (MOCK) await installRawImageProxy(page, mock);
	page.on("dialog", (d) => void d.accept()); // silme onayları

	const consoleErrors = [];
	page.on("pageerror", (e) => consoleErrors.push(String(e)));
	page.on("console", (m) => {
		if (m.type() === "error") consoleErrors.push(m.text());
	});

	const panelText = () =>
		page.evaluate(() => document.querySelector('[data-panel="draft-tabs"]')?.innerText ?? "");
	const clickInPanel = (text) =>
		page.evaluate((label) => {
			const panel = document.querySelector('[data-panel="draft-tabs"]');
			if (!panel) return false;
			const btn = [...panel.querySelectorAll("button")].find(
				(b) => (b.textContent ?? "").trim() === label,
			);
			if (btn) btn.click();
			return Boolean(btn);
		}, text);
	const waitPanel = (text, timeout = 15000) =>
		page
			.waitForFunction(
				(label) => (document.querySelector('[data-panel="draft-tabs"]')?.innerText ?? "").includes(label),
				{ timeout, polling: 300 },
				text,
			)
			.then(() => true)
			.catch(() => false);

	/** "Böl" moduna geç: kaynak paneli + rich editör yan yana. */
	const openSplit = async () => {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await page
				.waitForFunction(
					() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "Böl"),
					{ timeout: 30000, polling: 400 },
				)
				.catch(() => undefined);
			const clicked = await page.evaluate(() => {
				const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Böl");
				if (btn) btn.click();
				return Boolean(btn);
			});
			if (clicked) {
				await openSourcePane(page, 8000);
				const ready = await page
					.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("doküman"), { timeout: 10000, polling: 300 }, SOURCE)
					.then(() => true)
					.catch(() => false);
				if (ready) return true;
			}
			await sleep(2000);
		}
		return false;
	};
	const sourceText = () => page.evaluate((sel) => document.querySelector(sel)?.value ?? "", SOURCE);

	/** Rich editörün sonuna metin yazar (kullanıcı gibi). */
	const typeIntoEditor = async (text) => {
		await page.click(".mdx-body-editor");
		await page.keyboard.down("Control");
		await page.keyboard.press("End");
		await page.keyboard.up("Control");
		await page.keyboard.type(text, { delay: 8 });
	};

	// 0) Giriş + doküman (Böl modu)
	step("0. giriş", await login(page, BASE));
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	step("1. Böl modu + kaynak paneli", await openSplit());
	step("1b. sekme çubuğu görünür (Main)", (await panelText()).includes("Main"));

	// 2) + Taslak → menü
	await clickInPanel("+ Taslak");
	await sleep(400);
	step("2. menü açıldı", (await panelText()).includes("Boş taslak") && (await panelText()).includes("Main'den kopyala"));

	// 3) Main'den kopyala → Taslak 1
	await clickInPanel("Main'den kopyala");
	step("3. Taslak 1 sekmesi açıldı", await waitPanel("Taslak 1"));
	step("3b. kopya Main içeriğiyle aynı", (await sourceText()).includes("doküman"));

	// 4) Taslakta yaz → kaynakta görünür
	await typeIntoEditor(`\n\n${MARKER}`);
	await page
		.waitForFunction((sel, m) => (document.querySelector(sel)?.value ?? "").includes(m), { timeout: 15000, polling: 300 }, SOURCE, MARKER)
		.catch(() => undefined);
	step("4. taslağa yazıldı", (await sourceText()).includes(MARKER));

	// 5) Main'e dön → taslak yazısı görünmez
	await clickInPanel("Main");
	await sleep(600);
	step("5. Main içeriği korunuyor (işaret yok)", !(await sourceText()).includes(MARKER));

	// 6) Taslağa dön → işaret geri gelir
	await clickInPanel("Taslak 1");
	await page
		.waitForFunction((sel, m) => (document.querySelector(sel)?.value ?? "").includes(m), { timeout: 10000, polling: 300 }, SOURCE, MARKER)
		.catch(() => undefined);
	step("6. taslak içeriği geri geldi", (await sourceText()).includes(MARKER));

	// 7) Boş taslak → gövde boş
	await clickInPanel("+ Taslak");
	await sleep(400);
	await clickInPanel("Boş taslak");
	step("7. Taslak 2 sekmesi açıldı", await waitPanel("Taslak 2"));
	await sleep(600);
	step("7b. boş taslakta gövde boş", (await sourceText()).trim() === "");

	// 8) Yenile → sekmeler IndexedDB'den geri gelir; aktif Main, içerik repo
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	step("8. Böl modu (yenileme sonrası)", await openSplit());
	step("8b. sekmeler kalıcı", (await waitPanel("Taslak 1")) && (await panelText()).includes("Taslak 2"));
	step("8c. aktif Main (repo içeriği)", !(await sourceText()).includes(MARKER) && (await sourceText()).includes("doküman"));

	// 9) Taslak 1'e geç → işaret IndexedDB'den gelir
	await clickInPanel("Taslak 1");
	await page
		.waitForFunction((sel, m) => (document.querySelector(sel)?.value ?? "").includes(m), { timeout: 10000, polling: 300 }, SOURCE, MARKER)
		.catch(() => undefined);
	step("9. yenileme sonrası taslak içeriği duruyor", (await sourceText()).includes(MARKER));

	// 10) Taslak 2'yi sil
	await page.evaluate(() => {
		const panel = document.querySelector('[data-panel="draft-tabs"]');
		const span = [...(panel?.querySelectorAll("span") ?? [])].find((s) => s.textContent?.includes("Taslak 2"));
		const btn = span?.querySelector('button[title="Taslağı sil"]');
		if (btn) btn.click();
		return Boolean(btn);
	});
	await sleep(800);
	const afterDelete = await panelText();
	step("10. silinen sekme çubuktan düştü", !afterDelete.includes("Taslak 2") && afterDelete.includes("Taslak 1"));

	// 11) Konsol hijyeni
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("11. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
