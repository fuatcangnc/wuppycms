// P5 dumanı: BYO AI — sağlayıcı ayarı (D1, şifreli anahtar) ve içerik üretimi.
// Sağlayıcı çağrısı worker'dan gider; E2E'de sahte sunucunun OpenAI-uyumlu
// ucuna çevrilir (mockPort) — ağsız.
// Koşum: node scripts/e2e-ai.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub/AI + kendi dev sunucusu (:4391).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4391 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";
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
		logFile: "/tmp/opencode/e2e-ai-dev.log",
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
		// Metin ya da title/aria-label (AI anahtarı artık ikon düğme).
		page.evaluate((t) => {
			const has = (b) =>
				(b.textContent ?? "").trim() === t ||
				(b.getAttribute("title") ?? "").trim() === t ||
				(b.getAttribute("aria-label") ?? "").trim() === t;
			const btn = [...document.querySelectorAll("button")].find(has);
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
	const setSelect = (label, value) =>
		page.evaluate(
			(l, v) => {
				const el = document.querySelector(`select[aria-label="${l}"]`);
				if (!el) return false;
				const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
				set.call(el, v);
				el.dispatchEvent(new Event("change", { bubbles: true }));
				return true;
			},
			label,
			value,
		);
	const openSplit = async () => {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await page
				.waitForFunction(
					() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "Böl"),
					{ timeout: 30000, polling: 400 },
				)
				.catch(() => undefined);
			await clickExact("Böl");
			await openSourcePane(page, 8000);
			const ready = await page
				.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("doküman"), { timeout: 10000, polling: 300 }, SOURCE)
				.then(() => true)
				.catch(() => false);
			if (ready) return true;
			await sleep(2000);
		}
		return false;
	};

	// Giriş + doküman
	step("0. giriş", await login(page, BASE));

	// Önceki koşudan kalan ayarı sıfırla (deterministik başlangıç).
	await page.evaluate(
		(repo) =>
			fetch("/api/ai/settings", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({ provider: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", apiKey: "" }),
			}).then((r) => r.ok),
		REPO,
	);

	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	step("0b. doküman + Böl modu", await openSplit());

	// 1) Ayarsız üretim → anlamlı hata
	await clickExact("AI ile üret");
	await page.waitForSelector('textarea[aria-label="AI istemi"]', { timeout: 15000 }).catch(() => undefined);
	await page.evaluate(() => {
		const ta = document.querySelector('textarea[aria-label="AI istemi"]');
		const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
		set.call(ta, "E2E üretim istemi");
		ta.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await clickExact("Üret");
	await page
		.waitForFunction(() => document.body.innerText.includes("ayarlı değil"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("1. ayarsız üretim uyarısı", await bodyHas("ayarlı değil"));
	await clickExact("Kapat");
	await sleep(500);

	// 2) Sağlayıcı ayarı (Ajan ile kullan → Sağlayıcı) — baseUrl sahte sunucuya
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll("aside button")].find((b) => (b.textContent ?? "").includes("Ajan ile kullan"));
		if (btn) btn.click();
	});
	await page.waitForSelector('button[aria-label="AI sağlayıcı"], select[aria-label="AI sağlayıcı"]', { timeout: 15000 }).catch(() => undefined);
	await clickExact("Sağlayıcı");
	await sleep(600);
	const aiBase = `http://127.0.0.1:${env?.mockPort ?? 0}/v1`;
	await setSelect("AI sağlayıcı", "openai");
	await setInput("AI sunucu adresi", aiBase);
	await setInput("AI modeli", "mock-model");
	await setInput("AI anahtarı", "test-key");
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find(
			(b) => (b.textContent ?? "").trim() === "Kaydet",
		);
		if (btn) btn.click();
	});
	await page
		.waitForFunction(() => document.body.innerText.includes("Kaydedildi"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("2. sağlayıcı kaydedildi", await bodyHas("Kaydedildi"));
	const settings = await page.evaluate(() =>
		fetch("/api/ai/settings", { credentials: "same-origin" }).then((r) => r.json()),
	);
	step("2b. hasKey (şifreli saklandı)", settings?.hasKey === true && settings?.model === "mock-model");
	await clickExact("Kapat");
	await sleep(500);

	// 3) Üretim: istem + ton/uzunluk/dil/anahtar sözcük → sahte sağlayıcı
	await clickExact("AI ile üret");
	await page.waitForSelector('textarea[aria-label="AI istemi"]', { timeout: 15000 }).catch(() => undefined);
	await page.evaluate(() => {
		const ta = document.querySelector('textarea[aria-label="AI istemi"]');
		const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
		set.call(ta, "E2E üretim istemi");
		ta.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await setSelect("Ton", "friendly");
	await setSelect("Uzunluk", "short");
	await setSelect("Dil", "tr");
	await setInput("Anahtar sözcük", "wuppycms");
	await clickExact("Üret");
	await page
		.waitForFunction(() => document.body.innerText.includes("ÜRETİLDİ"), { timeout: 20000, polling: 300 })
		.catch(() => undefined);
	step("3. önizleme üretildi", (await bodyHas("ÜRETİLDİ")) && (await bodyHas("E2E üretim istemi")));
	step("3b. ton sistem istemine geçti", await bodyHas("Ton: samimi ve sıcak"));

	// 4) Gövdeye ekle → kaydet
	await clickExact("Gövdeye ekle");
	await page
		.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("ÜRETİLDİ"), { timeout: 10000, polling: 300 }, SOURCE)
		.catch(() => undefined);
	step("4. gövdeye eklendi", await page.evaluate((sel) => (document.querySelector(sel)?.value ?? "").includes("ÜRETİLDİ"), SOURCE));
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Kaydet");
		if (btn && !btn.disabled) btn.click();
	});
	await page
		.waitForFunction(() => document.body.innerText.includes("Kaydedildi"), { timeout: 30000, polling: 500 })
		.catch(() => undefined);
	if (MOCK) {
		// Kaydın mock'a ulaşması dev'de (workerd ilk derleme gecikmesi) uzayabilir:
		// mock'a ikinci commit düşünceye kadar sesli yokla (40 s hava payı).
		let landed = false;
		for (let i = 0; i < 20 && !landed; i += 1) {
			if (mock.commits().length > 1) landed = true;
			else await sleep(2000);
		}
		step("4b. dosyaya yazıldı", landed && (mock.readFile(DOC_PATH)?.toString("utf8") ?? "").includes("ÜRETİLDİ"));
	}

	// 5) Sağlayıcı hatası: ölü adres → anlamlı hata (önizleme yok)
	await page.evaluate(() =>
		fetch("/api/ai/settings", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			credentials: "same-origin",
			body: JSON.stringify({ provider: "openai", baseUrl: "http://127.0.0.1:9/v1", model: "mock-model" }),
		}).then((r) => r.ok),
	);
	await clickExact("AI ile üret");
	await page.waitForSelector('textarea[aria-label="AI istemi"]', { timeout: 15000 }).catch(() => undefined);
	await page.evaluate(() => {
		const ta = document.querySelector('textarea[aria-label="AI istemi"]');
		const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
		set.call(ta, "ölü sunucu denemesi");
		ta.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await clickExact("Üret");
	await page
		.waitForFunction(() => document.body.innerText.includes("Hata:"), { timeout: 20000, polling: 300 })
		.catch(() => undefined);
	step("5. sağlayıcı hatası anlamlı", await bodyHas("Hata:"));

	// 6) Konsol hijyeni
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED|Failed to load resource/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("6. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
