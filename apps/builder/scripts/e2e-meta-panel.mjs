// P1 meta paneli dumanı: durum çipi (frontmatter `status`), Görsel/YAML/MD
// görünümleri, hazırlık skoru, arama + OG önizlemesi ve kayıt kanıtı.
// Koşum: node scripts/e2e-meta-panel.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4396).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { clickButtonByText, installRawImageProxy, login, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4396 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const YAML_SEL = 'textarea[aria-label="Frontmatter YAML"]';
const MD_SEL = 'textarea[aria-label="Tam dosya"]';

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
		logFile: "/tmp/opencode/e2e-meta-dev.log",
	});
	mock = env.mock;
}

const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
	// OG akışı için `cover` alanlı şema + kapaklı doküman tohumla.
	if (MOCK) {
		const scratch = await browser.newPage();
		const pngData = Buffer.from(
			await scratch.evaluate(async () => {
				const canvas = document.createElement("canvas");
				canvas.width = 48;
				canvas.height = 32;
				const ctx = canvas.getContext("2d");
				ctx.fillStyle = "#1e90ff";
				ctx.fillRect(0, 0, 48, 32);
				return canvas.toDataURL("image/webp").split(",")[1];
			}),
			"base64",
		);
		await scratch.close();
		seedSite(mock, {
			"public/test/screenshot-20261015-121107.webp": pngData,
			"src/content.config.ts": `import { defineCollection, z } from "astro:content";

const blog = defineCollection({
	base: "src/content/blog",
	pattern: "**/*.mdx",
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		date: z.date().optional(),
		cover: z.string().optional(),
	}),
});

export const collections = { blog };
`,
			[`src/content/blog/merhaba-dunya.mdx`]: `---
title: Merhaba dünya
description: WuppyCMS demo yazısı — E2E mock deposunda yaşar.
cover: ""
---

Bu ilk yazı, editör medya seçicisinin (picker) test edildiği dokümandır.
`,
		});
	}

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
	const val = (sel) => page.evaluate((s) => document.querySelector(s)?.value ?? "", sel);
	const clickExact = (text, last = false) =>
		page.evaluate(
			(t, isLast) => {
				const list = [...document.querySelectorAll("button")].filter((b) => (b.textContent ?? "").trim() === t);
				const btn = isLast ? list.at(-1) : list[0];
				if (btn) btn.click();
				return Boolean(btn);
			},
			text,
			last,
		);
	const waitVal = (sel, part, timeout = 15000) =>
		page
			.waitForFunction((s, p) => (document.querySelector(s)?.value ?? "").includes(p), { timeout, polling: 300 }, sel, part)
			.then(() => true)
			.catch(() => false);

	// Giriş + doküman
	await login(page, BASE);
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await page
		.waitForFunction(() => document.body.innerText.toLowerCase().includes("frontmatter"), { timeout: 40000, polling: 400 })
		.catch(() => undefined);
	// Frontmatter formu artık kapalı başlar (Wryte düzeni): paneli aç.
	await clickButtonByText(page, "Paneli göster");
	step("0. doküman açıldı", await bodyHas("Merhaba dünya"));

	// 1) Durum çipi: varsayılan Taslak → Hazır'a çek
	step("1a. varsayılan çip Taslak", await bodyHas("Taslak"));
	const setReady = await clickExact("Hazır");
	step("1b. Hazır düğmesi", setReady);
	await page
		.waitForFunction(() => document.body.innerText.includes("Durum: Hazır"), { timeout: 8000, polling: 200 })
		.catch(() => undefined);
	// Hazırlık listesi "Durum: Hazır" satırını işaretler
	step("1c. hazırlık durumu işaretledi", await bodyHas("Durum: Hazır"));

	// 2) YAML görünümü çipin yazdığını yansıtır
	await clickExact("YAML");
	step("2. YAML sekmesi", await waitVal(YAML_SEL, "status: ready"));

	// 3) YAML'dan yeni anahtar ekle → Uygula → forma düşer
	await page.evaluate((sel) => {
		const ta = document.querySelector(sel);
		const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
		set.call(ta, `${ta.value}\nözelNot: deneme`);
		ta.dispatchEvent(new Event("input", { bubbles: true }));
	}, YAML_SEL);
	await clickExact("Uygula");
	await sleep(800);
	await clickExact("Görsel");
	step("3a. yeni anahtar forma düştü", await bodyHas("özelNot"));

	// 4) MD görünümü: tam dosya (frontmatter + gövde)
	await clickExact("MD");
	step("4. MD tam dosya", (await waitVal(MD_SEL, "title: Merhaba dünya")) && (await val(MD_SEL)).includes("dokümandır"));

	// 5) OG: kapak alanına medya seçiciden görsel
	await clickExact("Medyadan seç", true); // OG bölümündeki (son) düğme
	await page
		.waitForFunction(() => Boolean(document.querySelector('[data-slot="dialog-content"] img')), { timeout: 20000 })
		.catch(() => undefined);
	const picked = await page.evaluate(() => {
		const el = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find((b) =>
			(b.textContent ?? "").includes("screenshot"),
		);
		if (el) el.click();
		return Boolean(el);
	});
	step("5a. seçici kartı", picked);
	await sleep(1500);
	step("5b. cover değeri doldu", await bodyHas("screenshot-20261015"));
	const ogImg = await page.evaluate(() =>
		Boolean([...document.querySelectorAll("img")].find((i) => i.src.includes("raw.githubusercontent") && i.src.includes("screenshot"))),
	);
	step("5c. OG önizleme görseli", ogImg);

	// 6) Kaydet → dosyaya yazıldı (mock'tan bayt kanıtı)
	const saved = await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Kaydet");
		if (btn && !btn.disabled) btn.click();
		return Boolean(btn);
	});
	step("6. kaydet", saved);
	await page
		.waitForFunction(() => document.body.innerText.includes("Kaydedildi"), { timeout: 30000, polling: 500 })
		.catch(() => undefined);
	if (MOCK) {
		const file = mock.readFile(DOC_PATH)?.toString("utf8") ?? "";
		step("6a. status: ready yazıldı", file.includes("status: ready"), file.replace(/\n/g, "⏎").slice(0, 200));
		step("6b. özelNot yazıldı", file.includes("özelNot: deneme"));
		step("6c. cover bağı yazıldı", file.includes("screenshot-20261015"));
	} else {
		step("6a-c. gerçek mod (dosya kanıtı atlandı)", true);
	}

	// 7) Konsol hijyeni
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("7. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
