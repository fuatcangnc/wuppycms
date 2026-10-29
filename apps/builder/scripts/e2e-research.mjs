// Araştırma paneli dumanı (Wryte "Research" paritesi): makale başına notlar
// repo'da `.wuppycms/research/blog/<slug>.md` yaşar — ekle/sil/kaydet/yenile
// turu mock commit'lerinden doğrulanır; bağlantı önerisi tıklanınca gövdeye
// markdown bağlantısı eklenir (editör köprüsü).
// Koşum: node scripts/e2e-research.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4385).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4385 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const RESEARCH_PATH = ".wuppycms/research/blog/merhaba-dunya.md";
const SOURCE = 'textarea[aria-label="Markdown kaynağı"]';
const NOTE_ONE = "Kaynak: https://astro.build";
const NOTE_TWO = "Alıntı: kod senin reponda yaşar";

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
		logFile: "/tmp/opencode/e2e-research-dev.log",
	});
	mock = env.mock;
	seedSite(mock, {
		"src/content/blog/ikinci-yazi.mdx": `---
title: İkinci yazı
description: Bağlantı önerisi testi için ikinci içerik.
---

Bu yazı, araştırma panelindeki bağlantı önerilerinin kaynağıdır.
`,
	});
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
	page.on("dialog", (d) => void d.accept());

	const consoleErrors = [];
	page.on("pageerror", (e) => consoleErrors.push(String(e)));
	page.on("console", (m) => {
		if (m.type() === "error") consoleErrors.push(m.text());
	});

	const panelText = () =>
		page.evaluate(() => document.querySelector('[data-panel="research"]')?.innerText ?? "");
	// Panel kapalı başlar; araç çubuğundaki ikon anahtar (title "Araştırma") ile açılır.
	const openPanel = async () => {
		await page.evaluate(() => document.querySelector('[data-panel-toggle="research"]')?.click());
		await page
			.waitForFunction(() => Boolean(document.querySelector('[data-panel="research"]')), { timeout: 40000, polling: 400 })
			.catch(() => undefined);
	};
	const clickInPanel = (text) =>
		page.evaluate((label) => {
			const panel = document.querySelector('[data-panel="research"]');
			if (!panel) return false;
			const btn = [...panel.querySelectorAll("button")].find(
				(b) => (b.textContent ?? "").trim() === label,
			);
			if (btn) btn.click();
			return Boolean(btn);
		}, text);
	const panelHasButton = (text) =>
		page.evaluate((label) => {
			const panel = document.querySelector('[data-panel="research"]');
			return Boolean(
				panel &&
					[...panel.querySelectorAll("button")].some(
						(b) => (b.textContent ?? "").trim() === label,
					),
			);
		}, text);

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

	/** Mock commit'inin dosyaya yansımasını bekle (commit asenkron akar). */
	const waitMock = async (predicate, timeoutMs = 15000) => {
		const deadline = Date.now() + timeoutMs;
		while (Date.now() < deadline) {
			if (predicate()) return true;
			await sleep(300);
		}
		return false;
	};
	const mockFile = () => (MOCK ? (mock.readFile(RESEARCH_PATH)?.toString("utf8") ?? "") : "");

	// 0) Giriş + doküman açılışı
	step("0. giriş", await login(page, BASE));
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	// Panel artık KAPALI başlar — araç çubuğundaki ikon anahtarla açılır.
	await page
		.waitForFunction(() => Boolean(document.querySelector('[data-panel-toggle="research"]')), { timeout: 40000, polling: 400 })
		.catch(() => undefined);
	step("0b. panel kapalı başlar", await page.evaluate(() => !document.querySelector('[data-panel="research"]')));
	await openPanel();
	step("1. araştırma paneli görünür", (await panelText()).includes("Bağlantı"));
	step("1b. boş durum metni", (await panelText()).includes("Henüz not yok"));

	// 2) Not ekle → kaydet → mock dosyasında kanıt
	await clickInPanel("+ Araştırma ekle");
	await page
		.waitForSelector('[data-panel="research"] input[aria-label="Not, kaynak ya da alıntı…"]', { timeout: 10000 })
		.catch(() => undefined);
	await page.type('[data-panel="research"] input[aria-label="Not, kaynak ya da alıntı…"]', NOTE_ONE, { delay: 5 });
	step("2. Ekle düğmesi etkin", await panelHasButton("Ekle"));
	await clickInPanel("Ekle");
	await page
		.waitForFunction((note) => document.querySelector('[data-panel="research"]')?.innerText.includes(note), { timeout: 8000, polling: 300 }, NOTE_ONE)
		.catch(() => undefined);
	step("2b. not listede", (await panelText()).includes(NOTE_ONE));
	step("2c. Kaydet çıktı (kirli)", await panelHasButton("Kaydet"));
	await clickInPanel("Kaydet");
	if (MOCK) {
		const written = await waitMock(() => mockFile().includes(NOTE_ONE));
		step("2d. repo'ya yazıldı (.wuppycms/research)", written, RESEARCH_PATH);
	} else {
		await sleep(1500);
		step("2d. gerçek mod (dosya kanıtı atlandı)", true);
	}

	// 3) Yenile → not repodan geri yüklenir, kirli değil (panel yeniden kapalı
	// başlar; anahtarla tekrar açılır)
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await page
		.waitForFunction(() => Boolean(document.querySelector('[data-panel-toggle="research"]')), { timeout: 40000, polling: 400 })
		.catch(() => undefined);
	await openPanel();
	await page
		.waitForFunction((note) => document.querySelector('[data-panel="research"]')?.innerText.includes(note), { timeout: 30000, polling: 400 }, NOTE_ONE)
		.catch(() => undefined);
	step("3. yenileme sonrası not duruyor", (await panelText()).includes(NOTE_ONE));
	step("3b. kayıtlı durumda Kaydet yok", !(await panelHasButton("Kaydet")));

	// 4) İkinci not → ikisi birlikte kaydedilir
	await clickInPanel("+ Araştırma ekle");
	await page
		.waitForSelector('[data-panel="research"] input[aria-label="Not, kaynak ya da alıntı…"]', { timeout: 10000 })
		.catch(() => undefined);
	await page.type('[data-panel="research"] input[aria-label="Not, kaynak ya da alıntı…"]', NOTE_TWO, { delay: 5 });
	await clickInPanel("Ekle");
	await clickInPanel("Kaydet");
	if (MOCK) {
		const both = await waitMock(() => mockFile().includes(NOTE_ONE) && mockFile().includes(NOTE_TWO));
		step("4. iki not birlikte repoda", both);
	} else {
		await sleep(1500);
		step("4. gerçek mod (dosya kanıtı atlandı)", true);
	}

	// 5) Not sil → kaydet → dosyadan düşer
	await page.evaluate((note) => {
		const panel = document.querySelector('[data-panel="research"]');
		const item = [...(panel?.querySelectorAll("li") ?? [])].find((li) => li.textContent?.includes(note));
		const btn = item?.querySelector('button[title="Notu sil"]');
		if (btn) btn.click();
		return Boolean(btn);
	}, NOTE_ONE);
	await clickInPanel("Kaydet");
	if (MOCK) {
		const removed = await waitMock(() => !mockFile().includes(NOTE_ONE) && mockFile().includes(NOTE_TWO));
		step("5. silinen not dosyadan düştü", removed);
	} else {
		await sleep(1500);
		step("5. gerçek mod (dosya kanıtı atlandı)", true);
	}

	// 6) Bağlantı önerisi → tıkla → gövdeye markdown bağlantısı eklenir
	step("6. öneri listelendi (İkinci yazı)", (await panelText()).includes("İkinci yazı"));
	await clickInPanel("İkinci yazı");
	step("6b. Böl modu açıldı", await openSplit());
	await page
		.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("[İkinci yazı]"), { timeout: 10000, polling: 300 }, SOURCE)
		.catch(() => undefined);
	step("6c. gövdeye bağlantı eklendi", (await sourceText()).includes("[İkinci yazı](/blog/ikinci-yazi)"));

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
