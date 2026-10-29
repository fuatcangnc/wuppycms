// Parity 2b-ii dumanı: inceleme akışı — "İncelemeye gönder" review dalı + PR
// açar (ana dal değişmez), diff görüntülenir, değişiklik istenir, onaylanır,
// birleştirilir (yayın) ve dosya ana dala geçer.
// Koşum: node scripts/e2e-review.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub (PR uçlarıyla) + dev sunucusu (:4387).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4387 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const SOURCE = 'textarea[aria-label="Markdown kaynağı"]';
const MARKER = "INCELEME-KANITI";

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
		logFile: "/tmp/opencode/e2e-review-dev.log",
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

	step("0. giriş", await login(page, BASE));

	// 1) Doküman: Böl modu + gövdeye işaretçi (kaydetmeden)
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
	step("1. doküman + Böl", splitReady);
	await page.click(".mdx-body-editor");
	await page.keyboard.down("Control");
	await page.keyboard.press("End");
	await page.keyboard.up("Control");
	await page.keyboard.type(`\n\n${MARKER}`, { delay: 8 });
	await sleep(800);

	// 2) İncelemeye gönder → İncelemeler görünümü
	await clickExact("İncelemeye gönder");
	await page
		.waitForFunction(() => location.pathname.endsWith("/reviews"), { timeout: 20000, polling: 300 })
		.catch(() => undefined);
	step("2. incelemeler görünümü", await page.evaluate(() => location.pathname.endsWith("/reviews")));
	await page
		.waitForFunction(() => document.body.innerText.includes("İnceleme: merhaba-dunya"), { timeout: 15000, polling: 400 })
		.catch(() => undefined);
	step("2b. PR listede", await bodyHas("İnceleme: merhaba-dunya"));
	step("2c. karar bekliyor çipi", await bodyHas("İnceleme bekliyor"));
	if (MOCK) {
		const pr = mock.pulls()[0];
		step("2d. PR açık ve dal doğru", Boolean(pr) && pr.state === "open" && pr.head.startsWith("review/merhaba-dunya"), pr?.head ?? "yok");
		step("2e. ana dal değişmedi", !(mock.readFile(DOC_PATH)?.toString("utf8") ?? "").includes(MARKER));
		step("2f. dal içeriği işaretçili", (mock.readFile(DOC_PATH, pr?.head)?.toString("utf8") ?? "").includes(MARKER));
	}

	// 3) Diff: dosya çipi → satır diff'i işaretçiyi gösterir
	await clickExact("Diff");
	await page
		.waitForFunction(() => document.body.innerText.includes("İnceleme diff'i"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("3. diff diyaloğu", await bodyHas("İnceleme diff'i"));
	await page
		.waitForFunction(
			() =>
				[...document.querySelectorAll('[data-slot="dialog-content"] button')].some((b) =>
					(b.textContent ?? "").includes("merhaba-dunya.mdx"),
				),
			{ timeout: 15000, polling: 300 },
		)
		.catch(() => undefined);
	await page.evaluate(() => {
		const chip = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find((b) =>
			(b.textContent ?? "").includes("merhaba-dunya.mdx"),
		);
		if (chip) chip.click();
	});
	await page
		.waitForFunction(
			() => document.querySelector('[data-slot="dialog-content"] pre')?.textContent?.includes("INCELEME-KANITI"),
			{ timeout: 15000, polling: 300 },
		)
		.catch(() => undefined);
	const diffText = await page.evaluate(() => document.querySelector('[data-slot="dialog-content"] pre')?.textContent ?? "");
	step("3b. diff işaretçiyi eklenen satır olarak gösterdi", diffText.includes(`+`) && diffText.includes(MARKER));
	// Diyalogdaki "Kapat" — satırdaki PR "Kapat"ına DEĞİL (kapsam şart).
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find(
			(b) => (b.textContent ?? "").trim() === "Kapat",
		);
		if (btn) btn.click();
	});
	await sleep(500);

	// 4) Değişiklik iste → Onayla
	await clickExact("Değişiklik iste");
	await page
		.waitForFunction(() => document.body.innerText.includes("Değişiklik istendi"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("4. değişiklik istendi", await bodyHas("Değişiklik istendi"));
	if (MOCK) {
		step("4b. inceleme kaydı", mock.reviews(1)[0]?.state === "CHANGES_REQUESTED", mock.reviews(1)[0]?.state ?? "yok");
	}
	await clickExact("Onayla");
	await page
		.waitForFunction(() => document.body.innerText.includes("Onaylandı"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("4c. onaylandı", await bodyHas("Onaylandı"));

	// 5) Birleştir → ana dala geçer (yayın) + açık listeden düşer
	await clickExact("Birleştir");
	await page
		.waitForFunction(() => document.body.innerText.includes("Açık inceleme yok"), { timeout: 20000, polling: 400 })
		.catch(() => undefined);
	step("5. açık listeden düştü", await bodyHas("Açık inceleme yok"));
	if (MOCK) {
		step("5b. PR birleşti", mock.pull(1)?.merged === true && mock.pull(1)?.state === "closed");
		step("5c. içerik ana dala geçti", (mock.readFile(DOC_PATH)?.toString("utf8") ?? "").includes(MARKER));
	}

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
