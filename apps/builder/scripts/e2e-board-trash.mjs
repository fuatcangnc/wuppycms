// P3 dumanı: Pano (sürükle-bırak durum → commit), Takvim (ay ızgarası),
// Çöp (yumuşak silme → geri yükle → kalıcı sil; hepsi commit).
// Koşum: node scripts/e2e-board-trash.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4393).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4393 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";
const COLLECTION_URL = `${BASE}/admin/wuppycms-demo-site/content/blog?site=${SITE}`;

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
		logFile: "/tmp/opencode/e2e-board-dev.log",
	});
	mock = env.mock;
	seedSite(mock, {
		[`src/content/blog/merhaba-dunya.mdx`]: `---
title: Merhaba dünya
description: WuppyCMS demo yazısı — E2E mock deposunda yaşar.
date: 2026-10-15
---

Bu ilk yazı, editör medya seçicisinin (picker) test edildiği dokümandır.
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
	await page.setViewport({ width: 1600, height: 1000 });
	if (MOCK) await installRawImageProxy(page, mock);
	page.on("dialog", (d) => void d.accept()); // silme onayları
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

	// Giriş + koleksiyon
	await login(page, BASE);
	await page.goto(COLLECTION_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await page
		.waitForFunction(() => document.body.innerText.includes("Merhaba dünya"), { timeout: 30000, polling: 400 })
		.catch(() => undefined);
	step("0. koleksiyon açıldı", await bodyHas("Merhaba dünya"));

	// 1) Pano görünümü + adres
	await clickExact("Pano");
	await page.waitForFunction(() => location.href.includes("view=board"), { timeout: 10000, polling: 300 }).catch(() => undefined);
	step("1. pano adreste", await page.evaluate(() => location.href.includes("view=board")));
	step("1b. kolonlar", (await bodyHas("Taslak")) && (await bodyHas("İnceleme")) && (await bodyHas("Hazır")));
	const cardInDraft = await page.evaluate(() => {
		const column = document.querySelector('[data-board-column="draft"]');
		return Boolean(column?.textContent?.includes("Merhaba dünya"));
	});
	step("1c. kart Taslak kolonunda", cardInDraft);

	// 2) Sürükle-bırak: Taslak → Hazır (sentetik DragEvent; React handler'ları okur)
	await page.evaluate(() => {
		const card = [...document.querySelectorAll('[draggable="true"]')].find((el) =>
			(el.textContent ?? "").includes("Merhaba dünya"),
		);
		const target = document.querySelector('[data-board-column="ready"]');
		if (!card || !target) return;
		const dt = new DataTransfer();
		card.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
		target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
		target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
		card.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
	});
	await page
		.waitForFunction(
			() => Boolean(document.querySelector('[data-board-column="ready"]')?.textContent?.includes("Merhaba dünya")),
			{ timeout: 15000, polling: 400 },
		)
		.catch(() => undefined);
	step("2. kart Hazır kolonuna taşındı", await page.evaluate(() => Boolean(document.querySelector('[data-board-column="ready"]')?.textContent?.includes("Merhaba dünya"))));
	if (MOCK) {
		step("2b. commit (durumu Hazır)", mock.commitsFor(DOC_PATH, "durumu Hazır"));
		step("2c. dosyada status: ready", (mock.readFile(DOC_PATH)?.toString("utf8") ?? "").includes("status: ready"));
	} else {
		step("2b-c. gerçek mod", true);
	}

	// 3) Takvim görünümü
	await clickExact("Takvim");
	await page.waitForFunction(() => location.href.includes("view=calendar"), { timeout: 10000, polling: 300 }).catch(() => undefined);
	await page
		.waitForFunction(() => document.body.innerText.includes("Ekim 2026"), { timeout: 10000, polling: 300 })
		.catch(() => undefined);
	step("3. takvim ay başlığı", await bodyHas("Ekim 2026"));
	step("3b. günde yazı çipi", await bodyHas("Merhaba dünya"));

	// 4) Çipten doküman aç → çöpe taşı
	await page.evaluate(() => {
		const chip = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Merhaba dünya");
		if (chip) chip.click();
	});
	await page
		.waitForFunction(() => document.body.innerText.toLowerCase().includes("frontmatter"), { timeout: 30000, polling: 400 })
		.catch(() => undefined);
	step("4. doküman açıldı", await page.evaluate(() => document.body.innerText.toLowerCase().includes("frontmatter")));
	const deleted = await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) => b.title === "Dokümanı sil");
		if (btn) btn.click();
		return Boolean(btn);
	});
	step("4b. sil düğmesi", deleted);
	await page
		.waitForFunction(() => document.body.innerText.includes("Merhaba dünya") === false, { timeout: 20000, polling: 400 })
		.catch(() => undefined);
	await page.goto(COLLECTION_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await sleep(1500);
	step("4c. listeden gitti", !(await bodyHas("Merhaba dünya")));
	if (MOCK) {
		step("4d. _trash'e taşındı", mock.readFile(DOC_PATH) === null && mock.readFile(`_trash/${DOC_PATH}`) !== null);
		step("4e. commit (çöpe taşındı)", mock.commitsFor(`_trash/${DOC_PATH}`, "çöpe taşındı"));
	} else {
		step("4d-e. gerçek mod", true);
	}

	// 5) Çöp görünümü → geri yükle
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll("aside button")].find((b) => (b.textContent ?? "").trim().startsWith("Çöp"));
		if (btn) btn.click();
	});
	await page
		.waitForFunction(() => location.pathname.endsWith("/trash"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("5. çöp görünümü", await page.evaluate(() => location.pathname.endsWith("/trash")));
	await page
		.waitForFunction(() => document.body.innerText.includes("_trash/"), { timeout: 15000, polling: 400 })
		.catch(() => undefined);
	step("5b. dosya çöpte listelendi", await bodyHas("_trash/"));
	await clickExact("Geri yükle");
	await page
		.waitForFunction(() => !document.body.innerText.includes("_trash/"), { timeout: 15000, polling: 400 })
		.catch(() => undefined);
	if (MOCK) {
		step("5c. dosya geri geldi", mock.readFile(DOC_PATH) !== null && mock.readFile(`_trash/${DOC_PATH}`) === null);
		step("5d. commit (geri yüklendi)", mock.commitsFor(DOC_PATH, "çöpten geri yüklendi"));
	} else {
		step("5c-d. gerçek mod", true);
	}

	// 6) Tekrar çöpe → kalıcı sil
	await page.goto(`${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`, {
		waitUntil: "networkidle2",
		timeout: 60000,
	});
	await page
		.waitForFunction(() => document.body.innerText.toLowerCase().includes("frontmatter"), { timeout: 30000, polling: 400 })
		.catch(() => undefined);
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) => b.title === "Dokümanı sil");
		if (btn) btn.click();
	});
	await sleep(2500);
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll("aside button")].find((b) => (b.textContent ?? "").trim().startsWith("Çöp"));
		if (btn) btn.click();
	});
	await page
		.waitForFunction(() => document.body.innerText.includes("_trash/"), { timeout: 15000, polling: 400 })
		.catch(() => undefined);
	await clickExact("Kalıcı sil");
	await page
		.waitForFunction(() => !document.body.innerText.includes("_trash/"), { timeout: 15000, polling: 400 })
		.catch(() => undefined);
	if (MOCK) {
		step("6. kalıcı silindi", mock.readFile(DOC_PATH) === null && mock.readFile(`_trash/${DOC_PATH}`) === null);
		step("6b. commit (kalıcı silindi)", mock.commitsFor(`_trash/${DOC_PATH}`, "kalıcı silindi"));
	} else {
		step("6. gerçek mod", true);
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
