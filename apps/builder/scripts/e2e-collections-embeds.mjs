// Parity turu 2 dumanı: Add Collection sihirbazı (content.config.ts'e commit)
// ve Embed desteği (12 sağlayıcı — YouTube yolu uçtan uca).
// Koşum: node scripts/e2e-collections-embeds.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4389).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4389 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const CONFIG_PATH = "src/content.config.ts";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const SOURCE = 'textarea[aria-label="Markdown kaynağı"]';

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
		logFile: "/tmp/opencode/e2e-coll-dev.log",
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
	await page.setViewport({ width: 1600, height: 1000 });
	if (MOCK) await installRawImageProxy(page, mock);
	page.on("dialog", (d) => void d.accept());
	const consoleErrors = [];
	page.on("pageerror", (e) => consoleErrors.push(String(e)));
	page.on("console", (m) => {
		if (m.type() === "error") consoleErrors.push(m.text());
	});

	const bodyHas = (part) => page.evaluate((p) => document.body.innerText.includes(p), part);
	const clickExact = (text) =>
		page.evaluate((t) => {
			const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === t);
			if (btn) btn.click();
			return Boolean(btn);
		}, text);
	const setInput = (label, value) =>
		page.evaluate(
			(l, v) => {
				const el = document.querySelector(`input[aria-label="${l}"]`);
				if (!el) return false;
				const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
				set.call(el, v);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				return true;
			},
			label,
			value,
		);

	step("0. giriş", await login(page, BASE));
	await page.goto(`${BASE}/admin`, { waitUntil: "networkidle2", timeout: 60000 });

	// 1) Add Collection: sidebar "+" → diyalog → ekle → config commit'i
	await page
		.waitForFunction(() => document.body.innerText.includes("Blog"), { timeout: 30000, polling: 400 })
		.catch(() => undefined);
	await page.evaluate(() => {
		const btn = document.querySelector('button[title="Koleksiyon ekle"]');
		if (btn) btn.click();
	});
	await page
		.waitForSelector('input[aria-label="Koleksiyon anahtarı"]', { timeout: 15000 })
		.catch(() => undefined);
	step("1. koleksiyon diyaloğu", await page.evaluate(() => Boolean(document.querySelector('input[aria-label="Koleksiyon anahtarı"]'))));
	await setInput("Koleksiyon anahtarı", "urunler");
	await clickExact("Koleksiyonu ekle");
	await page
		.waitForFunction(() => !document.querySelector('input[aria-label="Koleksiyon anahtarı"]'), { timeout: 20000, polling: 300 })
		.catch(() => undefined);
	step("1b. diyalog kapandı", !(await page.evaluate(() => Boolean(document.querySelector('input[aria-label="Koleksiyon anahtarı"]')))));
	if (MOCK) {
		const config = mock.readFile(CONFIG_PATH)?.toString("utf8") ?? "";
		step("1c. defineCollection yazıldı", config.includes("const urunler = defineCollection({") && config.includes('base: "src/content/urunler"'));
		step("1d. exports güncellendi", config.includes("export const collections = { blog, urunler };"));
		step("1e. commit (koleksiyon)", mock.commitsFor(CONFIG_PATH, "koleksiyonu eklendi"));
	}
	await page
		.waitForFunction(() => document.body.innerText.includes("Urunler"), { timeout: 20000, polling: 400 })
		.catch(() => undefined);
	step("1f. kenar çubuğunda göründü", await bodyHas("Urunler"));

	// 2) Yeni koleksiyonu aç — boş liste
	await clickExact("Urunler");
	await page
		.waitForFunction(() => location.pathname.includes("/content/urunler"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("2. koleksiyon açıldı", await page.evaluate(() => location.pathname.includes("/content/urunler")));
	await page
		.waitForFunction(() => document.body.innerText.includes("Doküman yok"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("2b. boş liste", await bodyHas("Doküman yok"));

	// 3) Embed: bilinmeyen bağlantı tanınmaz → Ekle kapalı
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	let splitReady = false;
	for (let attempt = 0; attempt < 3 && !splitReady; attempt += 1) {
		await page
			.waitForFunction(
				() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "Böl"),
				{ timeout: 30000, polling: 400 },
			)
			.catch(() => undefined);
		await clickExact("Böl");
		await openSourcePane(page, 8000);
		splitReady = await page
			.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("doküman"), { timeout: 10000, polling: 300 }, SOURCE)
			.then(() => true)
			.catch(() => false);
		if (!splitReady) await sleep(2500);
	}
	step("3. doküman + Böl", splitReady);
	await clickExact("Embed");
	await page
		.waitForSelector('input[aria-label="Embed bağlantısı"]', { timeout: 15000 })
		.catch(() => undefined);
	await setInput("Embed bağlantısı", "https://example.com/yazi");
	await sleep(400);
	step("3b. bilinmeyen bağlantı tanınmadı", (await bodyHas("Tanınmadı")) && !(await bodyHas("Tanındı")));
	const addDisabled = await page.evaluate(() => {
		const btn = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find(
			(b) => (b.textContent ?? "").trim() === "Ekle",
		);
		return btn ? btn.disabled : null;
	});
	step("3c. Ekle kapalı", addDisabled === true);

	// 4) YouTube tanınır → Ekle → kaynak panelinde gömme
	await setInput("Embed bağlantısı", "https://youtu.be/dQw4w9WgXcQ");
	await page
		.waitForFunction(() => document.body.innerText.includes("Tanındı: YouTube"), { timeout: 10000, polling: 300 })
		.catch(() => undefined);
	step("4. YouTube tanındı", await bodyHas("Tanındı: YouTube"));
	await clickExact("Ekle");
	await page
		.waitForFunction(
			(sel) => (document.querySelector(sel)?.value ?? "").includes("youtube.com/embed/dQw4w9WgXcQ"),
			{ timeout: 15000, polling: 300 },
			SOURCE,
		)
		.catch(() => undefined);
	const source = await page.evaluate((sel) => document.querySelector(sel)?.value ?? "", SOURCE);
	step("4b. gömme gövdeye eklendi", source.includes("youtube.com/embed/dQw4w9WgXcQ") && source.includes("<iframe"));
	// Bütünlük: embed ekimi eski gövdeyi SİLMEMELİ (mdxeditor kurtarma yolu
	// ayrıştıramadığında tüm belgeyi ham string ile değiştiriyordu — regresyon).
	step("4c. gömme sonrası gövde bütünlüğü korundu", source.includes("doküman"));

	// 5) Konsol hijyeni
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED|Failed to load resource/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("5. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
