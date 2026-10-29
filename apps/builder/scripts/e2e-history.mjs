// P2 geçmiş dumanı: sürüm listesi, "Anlık görüntü" commit'i, sürüm ↔ şu anki
// diff'i ve "Bu sürümü yükle" ile geri dönüş (kaydet = normal commit).
// Koşum: node scripts/e2e-history.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4394).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { clickButtonByText, installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4394 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const SOURCE = 'textarea[aria-label="Markdown kaynağı"]';
const MARKER = "SURUM-KANITI";

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
		logFile: "/tmp/opencode/e2e-history-dev.log",
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
	const sourceText = () => page.evaluate((sel) => document.querySelector(sel)?.value ?? "", SOURCE);
	const clickExact = (text) =>
		page.evaluate((t) => {
			const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === t);
			if (btn) btn.click();
			return Boolean(btn);
		}, text);
	const clickContaining = (selector, part) =>
		page.evaluate(
			(sel, p) => {
				const el = [...document.querySelectorAll(sel)].find((b) => (b.textContent ?? "").includes(p));
				if (el) el.click();
				return Boolean(el);
			},
			selector,
			part,
		);
	/** "Böl" moduna geç (ilk açılış Vite paketleme yenilemesi → denemeli). */
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

	// Giriş + doküman (Böl modu: kaynak paneli doğrulamalar için)
	await login(page, BASE);
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	step("0. doküman + Böl modu", await openSplit());

	// Frontmatter formu artık kapalı başlar (Wryte düzeni) → Geçmiş sekmesi için aç.
	await clickButtonByText(page, "Paneli göster");

	// 1) Geçmiş sekmesi: seed sürümü listede
	await clickExact("Geçmiş");
	await page
		.waitForFunction(() => document.body.innerText.includes("mock deposu kuruldu"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("1. seed sürümü listede", await bodyHas("mock deposu kuruldu"));

	// 2) Düzenle → Anlık görüntü
	await page.click(".mdx-body-editor");
	await page.keyboard.down("Control");
	await page.keyboard.press("End");
	await page.keyboard.up("Control");
	await page.keyboard.type(`\n\n${MARKER}`, { delay: 8 });
	await sleep(1200);
	await clickExact("Anlık görüntü");
	await page
		.waitForFunction(() => document.body.innerText.includes("Anlık görüntü alındı"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("2. anlık görüntü alındı", await bodyHas("Anlık görüntü alındı"));
	step("2b. commit (via WuppyCMS)", MOCK ? mock.commitsFor(DOC_PATH, "anlık görüntü") : true);

	// 3) Liste tazelendi: snapshot commit görünür
	await page
		.waitForFunction(() => document.body.innerText.includes("anlık görüntü (via WuppyCMS)"), { timeout: 15000, polling: 400 })
		.catch(() => undefined);
	step("3. snapshot listede", await bodyHas("anlık görüntü (via WuppyCMS)"));

	// 4) Seed sürümüne tıkla → diff diyaloğu
	await clickContaining("button", "mock deposu kuruldu");
	await page
		.waitForFunction(() => document.body.innerText.includes("Sürüm karşılaştırması"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("4. diff diyaloğu açıldı", await bodyHas("Sürüm karşılaştırması"));
	// Sürüm içeriği asenkron gelir; satırlar dolana dek bekle.
	await page
		.waitForFunction(
			() => document.querySelectorAll('[data-slot="dialog-content"] pre > div').length > 0,
			{ timeout: 15000, polling: 300 },
		)
		.catch(() => undefined);
	const diffInfo = await page.evaluate(() => {
		const rows = [...document.querySelectorAll('[data-slot="dialog-content"] pre > div')];
		return {
			total: rows.length,
			added: rows.filter((r) => r.className.includes("bg-emerald-500/10")).length,
			hasMarker: rows.some((r) => r.textContent?.includes("SURUM-KANITI")),
		};
	});
	step("4b. eklenen satırlar işaretli", diffInfo.added >= 1, `+${diffInfo.added}/${diffInfo.total}`);
	step("4c. işaretçi diff'te", diffInfo.hasMarker);

	// 5) "Bu sürümü yükle" → gövde eski hâle döner (kaydedilmedi)
	await clickExact("Bu sürümü yükle");
	await page
		.waitForFunction((sel) => !(document.querySelector(sel)?.value ?? "").includes("SURUM-KANITI"), { timeout: 10000, polling: 300 }, SOURCE)
		.catch(() => undefined);
	step("5. sürüm forma yüklendi (işaretçi gitti)", !(await sourceText()).includes(MARKER));
	step("5b. diyalog kapandı", !(await bodyHas("Sürüm karşılaştırması")));

	// 6) Kaydet → dosya seed hâline döndü + yeni commit
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
		step("6a. dosya eski içerikte", !file.includes(MARKER) && file.includes("dokümandır"));
		step("6b. geri dönüş commit'i", mock.commitsFor(DOC_PATH, "güncellendi"));
	} else {
		step("6a-b. gerçek mod (dosya kanıtı atlandı)", true);
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
