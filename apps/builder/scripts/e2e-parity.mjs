// Parity dumanı (P2+): media:// bağı + "Bağı çöz", gösterim genişliği (%),
// odak noktası (manifest), genişlik-farkında seçici ekleme, MD/HTML kopyala.
// Koşum: node scripts/e2e-parity.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4390).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4390 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const SHOT = "public/test/screenshot-20261015-121107.webp";
const SOURCE = 'textarea[aria-label="Markdown kaynağı"]';
const MEDIA_URL = `${BASE}/admin/wuppycms-demo-site/media/test?site=${SITE}&mediaLibrary=repo_media`;
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;

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
		logFile: "/tmp/opencode/e2e-parity-dev.log",
	});
	mock = env.mock;
}

const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
	// media-uri bağ biçimli site + gerçek webp tohumu
	if (MOCK) {
		const scratch = await browser.newPage();
		const webp = Buffer.from(
			await scratch.evaluate(async () => {
				const canvas = document.createElement("canvas");
				canvas.width = 64;
				canvas.height = 40;
				const ctx = canvas.getContext("2d");
				ctx.fillStyle = "#2288dd";
				ctx.fillRect(0, 0, 64, 40);
				return canvas.toDataURL("image/webp").split(",")[1];
			}),
			"base64",
		);
		await scratch.close();
		seedSite(mock, {
			[SHOT]: webp,
			".wuppycms/sites.jsonc": `{
  "version": 1,
  "sites": [
    {
      "key": "root",
      "name": "wuppycms-demo-site",
      "url": "https://demo.wuppycms.dev",
      "media": "public",
      "mediaLink": "media-uri",
      "publishing": "immediate"
    }
  ]
}
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
	const clickExact = (text, inDialog = false) =>
		page.evaluate(
			(t, dialogOnly) => {
				const scope = dialogOnly ? document.querySelector('[data-slot="dialog-content"]') ?? document : document;
				const btn = [...scope.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === t);
				if (btn) btn.click();
				return Boolean(btn);
			},
			text,
			inDialog,
		);
	const openDetails = () =>
		page.evaluate(() => {
			const btn = [...document.querySelectorAll("button[aria-label]")].find((b) =>
				(b.getAttribute("aria-label") ?? "").includes("screenshot"),
			);
			if (btn) btn.click();
			return Boolean(btn);
		});

	// Giriş
	step("0. giriş", await login(page, BASE));

	// 1) media:// bağı görünür + "Bağı çöz" çözümü gösterir
	await page.goto(MEDIA_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await page
		.waitForFunction(() => document.body.innerText.includes("screenshot-20261015"), { timeout: 30000, polling: 400 })
		.catch(() => undefined);
	await openDetails();
	await page
		.waitForFunction(() => document.body.innerText.includes("Medya detayları"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("1. media:// bağı", await bodyHas(`media://${SHOT}`));
	await clickExact("Bağı çöz");
	await page
		.waitForFunction(() => document.body.innerText.includes("bağı çözüldü"), { timeout: 8000, polling: 200 })
		.catch(() => undefined);
	step("1b. Bağı çöz çözümü gösterdi", await bodyHas("bağı çözüldü: /test/screenshot-20261015"));

	// 2) Gösterim genişliği %60 → manifest
	await page.evaluate(() => {
		const input = document.querySelector('[data-slot="dialog-content"] input[type="number"]');
		if (!input) return;
		const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
		set.call(input, "60");
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await clickExact("Kaydet", true);
	await page
		.waitForFunction(() => !document.querySelector('[data-slot="dialog-content"]'), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	if (MOCK) {
		const manifest = mock.readFile(".wuppycms/media.json")?.toString("utf8") ?? "";
		step("2. genişlik manifeste yazıldı", manifest.includes(`"${SHOT}"`) && manifest.includes('"width": 60'));
	} else {
		step("2. gerçek mod", true);
	}

	// 3) Odak noktası: düzenle sekmesi → mini önizleme → kaydet
	await openDetails();
	await page
		.waitForFunction(() => document.body.innerText.includes("Medya detayları"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	await clickExact("Görseli düzenle");
	let focalReady = false;
	for (let attempt = 0; attempt < 3 && !focalReady; attempt += 1) {
		focalReady = await page
			.waitForSelector('[aria-label="Odak noktası seç"]', { timeout: 12000 })
			.then(() => true)
			.catch(() => false);
		if (!focalReady) {
			await sleep(2500);
			await clickExact("Görseli düzenle");
		}
	}
	step("3. odak paneli açıldı", focalReady);
	if (focalReady) {
		await page.click('[aria-label="Odak noktası seç"]');
		await sleep(300);
		await clickExact("Odak noktasını kaydet");
		await page
			.waitForFunction(() => document.body.innerText.includes("Odak noktası kaydedildi"), { timeout: 15000, polling: 300 })
			.catch(() => undefined);
		step("3b. odak kaydedildi", await bodyHas("Odak noktası kaydedildi"));
		if (MOCK) {
			const manifest = mock.readFile(".wuppycms/media.json")?.toString("utf8") ?? "";
			step("3c. odak manifestte", manifest.includes('"focal"'));
		}
	}
	await clickExact("Kapat");
	await sleep(600);

	// 4) Seçici: genişlik ayarlıysa HTML img ile ekler (media:// bağı korunur)
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
	step("4. doküman + Böl", splitReady);
	await clickExact("Medyadan ekle");
	await page
		.waitForFunction(() => Boolean(document.querySelector('[data-slot="dialog-content"] img')), { timeout: 20000 })
		.catch(() => undefined);
	await page.evaluate(() => {
		const el = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find((b) =>
			(b.textContent ?? "").includes("screenshot"),
		);
		if (el) el.click();
	});
	await page
		.waitForFunction(
			(sel) => (document.querySelector(sel)?.value ?? "").includes("width="),
			{ timeout: 15000, polling: 300 },
			SOURCE,
		)
		.catch(() => undefined);
	const source = await page.evaluate((sel) => document.querySelector(sel)?.value ?? "", SOURCE);
	step("4b. HTML img + media:// bağı", source.includes(`src="media://${SHOT}"`));
	step("4c. genişlik % olarak korundu", source.includes('style="width: 60%"'));

	// 5) MD/HTML kopyala düğmeleri + h1-h6 (BlockTypeSelect) varlığı
	await clickExact("MD kopyala");
	await page
		.waitForFunction(() => document.body.innerText.includes("MD ✓"), { timeout: 8000, polling: 200 })
		.catch(() => undefined);
	step("5. MD kopyala geri bildirimi", await bodyHas("MD ✓"));
	await clickExact("HTML kopyala");
	await page
		.waitForFunction(() => document.body.innerText.includes("HTML ✓"), { timeout: 8000, polling: 200 })
		.catch(() => undefined);
	step("5b. HTML kopyala geri bildirimi", await bodyHas("HTML ✓"));
	const hasBlockType = await page.evaluate(() =>
		[...document.querySelectorAll("button")].some((b) => (b.getAttribute("aria-label") ?? "") === "Block type"),
	);
	step("5c. h1-h6 / paragraf (Block type) araç çubuğunda", hasBlockType);

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
