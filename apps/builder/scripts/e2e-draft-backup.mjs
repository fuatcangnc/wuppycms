// Taslak yedeği dumanı (④ + P0): kaydedilmemiş düzenlemeler sayfa yenilenince
// kaybolmaz — bant çıkar, "Geri yükle" içeriği döndürür, kayıt yedeği süpürür.
// Gövde artık mdxeditor (P0): metin rich editöre yazılır, doğrulama "Böl"
// modundaki Markdown kaynağı panelinden okunur (aria-label ile sabit).
// Koşum: node scripts/e2e-draft-backup.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4397).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4397 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const MARKER = "TASLAK-YEDEGI-KANITI";
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
		logFile: "/tmp/opencode/e2e-draft-dev.log",
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
	page.on("dialog", (d) => void d.accept()); // vazgeç onayları

	const sourceText = () => page.evaluate((sel) => document.querySelector(sel)?.value ?? "", SOURCE);
	const bannerShown = () =>
		page.evaluate(() => document.body.innerText.includes("Kaydedilmemiş bir taslak yedeği var"));

	/** "Böl" moduna geç: kaynak paneli + rich editör yan yana.
	 *  İlk açılışta Vite tembel paketleyip sayfayı yenileyebilir → 3 deneme. */
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
			await sleep(2000); // paketleme sonrası sayfa yenilenmiş olabilir
		}
		return false;
	};

	/** Rich editörün sonuna metin yazar (kullanıcı gibi). */
	const typeIntoEditor = async (text) => {
		await page.click(".mdx-body-editor");
		await page.keyboard.down("Control");
		await page.keyboard.press("End");
		await page.keyboard.up("Control");
		await page.keyboard.type(text, { delay: 8 });
	};

	// Giriş
	step("0. giriş", await login(page, BASE));

	// Dokümanı aç (Böl modu), rich editöre işaretçiyi yaz (kaydetmeden)
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	step("1. Böl modu + kaynak paneli", await openSplit());
	step("1b. sunucu içeriği yüklü", (await sourceText()).includes("doküman"));
	await typeIntoEditor(`\n\n${MARKER}`);
	await page
		.waitForFunction((sel, m) => (document.querySelector(sel)?.value ?? "").includes(m), { timeout: 15000, polling: 300 }, SOURCE, MARKER)
		.catch(() => undefined);
	step("1c. rich yazım kaynağa yansıdı", (await sourceText()).includes(MARKER));
	await sleep(1800); // debounce (800ms) + IndexedDB yazımı

	// Yenile → yedek bantta görünmeli
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await openSplit();
	await page
		.waitForFunction(() => document.body.innerText.includes("taslak yedeği var"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("2. yenileme sonrası bant", await bannerShown());
	step("2b. sunucu içeriği hâlâ temiz", !(await sourceText()).includes(MARKER));

	// Geri yükle → içerik döner, bant kapanır
	const restored = await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) =>
			(b.textContent ?? "").trim().startsWith("Geri yükle"),
		);
		if (btn) btn.click();
		return Boolean(btn);
	});
	step("3. geri yükle düğmesi", restored);
	await page
		.waitForFunction((sel, m) => (document.querySelector(sel)?.value ?? "").includes(m), { timeout: 10000, polling: 200 }, SOURCE, MARKER)
		.catch(() => undefined);
	step("3b. içerik geri geldi", (await sourceText()).includes(MARKER));
	step("3c. bant kapandı", !(await bannerShown()));

	// Kaydet → yedek süpürülür; yenilemede bant çıkmaz
	const saved = await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Kaydet");
		if (btn && !btn.disabled) btn.click();
		return Boolean(btn);
	});
	step("4. kaydet düğmesi", saved);
	await page
		.waitForFunction(() => document.body.innerText.includes("Kaydedildi"), { timeout: 30000, polling: 500 })
		.catch(() => undefined);
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await openSplit();
	await sleep(1200);
	step("4b. kayıt sonrası bant yok", !(await bannerShown()));
	step("4c. içerik sunucuda", (await sourceText()).includes(MARKER));
	step("4d. commit (via WuppyCMS)", MOCK ? mock.commitsFor("src/content/blog/merhaba-dunya.mdx", "güncellendi") : true);

	// Yedeği sil yolu: yeni düzenleme → yenile → "Yedeği sil" → tekrar yenile → bant yok
	await typeIntoEditor("\nikinci-taslak");
	await sleep(1800);
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await openSplit();
	await page
		.waitForFunction(() => document.body.innerText.includes("taslak yedeği var"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("5. ikinci taslak bantta", await bannerShown());
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Yedeği sil");
		if (btn) btn.click();
	});
	await sleep(600);
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await openSplit();
	await sleep(1200);
	step("5b. silinen yedek geri gelmiyor", !(await bannerShown()));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
