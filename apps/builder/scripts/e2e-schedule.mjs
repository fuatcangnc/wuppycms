// P4 dumanı: zamanlanmış yayın yürütücüsü (publishAt → ready + commit) ve
// medya alt/caption'ın repo manifestine taşınması (.wuppycms/media.json).
// Koşum: node scripts/e2e-schedule.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4392).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { clickButtonByText, installRawImageProxy, login, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4392 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const PAST = "2026-10-01T09:00";
const FUTURE = "2027-01-01T09:00";

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
		logFile: "/tmp/opencode/e2e-schedule-dev.log",
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
	const setPublishAt = (value) =>
		page.evaluate((v) => {
			const input = document.querySelector('input[aria-label="Yayın zamanı"]');
			if (!input) return false;
			const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
			set.call(input, v);
			input.dispatchEvent(new Event("input", { bubbles: true }));
			return true;
		}, value);
	const save = async () => {
		await page.evaluate(() => {
			const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Kaydet");
			if (btn && !btn.disabled) btn.click();
		});
		await page
			.waitForFunction(() => document.body.innerText.includes("Kaydedildi"), { timeout: 30000, polling: 500 })
			.catch(() => undefined);
	};
	const runSchedule = () =>
		page.evaluate(
			(repo) =>
				fetch("/api/schedule/run", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ full_name: repo }),
				}).then((r) => r.json()),
			REPO,
		);

	// Giriş + doküman
	await login(page, BASE);
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	// Frontmatter formu artık kapalı başlar (Wryte düzeni): paneli aç.
	await clickButtonByText(page, "Paneli göster");
	await page
		.waitForFunction(() => Boolean(document.querySelector('input[aria-label="Yayın zamanı"]')), { timeout: 40000, polling: 400 })
		.catch(() => undefined);
	step("0. zamanlama alanı görünür", await page.evaluate(() => Boolean(document.querySelector('input[aria-label="Yayın zamanı"]'))));

	// 1) Geçmiş tarih → "Zamanı geldi" durumu → kaydet
	await setPublishAt(PAST);
	await page
		.waitForFunction(() => document.body.innerText.includes("Zamanı geldi"), { timeout: 10000, polling: 300 })
		.catch(() => undefined);
	step("1. geçmiş tarih 'Zamanı geldi' der", await bodyHas("Zamanı geldi"));
	await save();
	if (MOCK) {
		step("1b. dosyada publishAt", (mock.readFile(DOC_PATH)?.toString("utf8") ?? "").includes(`publishAt: ${PAST}`));
	}

	// 2) Yürütücü: POST /api/schedule/run → status ready + commit
	const run1 = await runSchedule();
	step("2. yürütücü yanıtı", Array.isArray(run1?.runs) && run1.runs[0]?.published?.includes(DOC_PATH), JSON.stringify(run1?.runs?.[0]?.published ?? run1));
	if (MOCK) {
		const file = mock.readFile(DOC_PATH)?.toString("utf8") ?? "";
		step("2b. dosyada status: ready", file.includes("status: ready"));
		step("2c. commit (zamanı geldi)", mock.commitsFor(DOC_PATH, "zamanı geldi"));
	}

	// 3) İkinci tur: yayında olan yürütülmez (idempotent)
	const run2 = await runSchedule();
	step("3. idempotent", (run2?.runs?.[0]?.published ?? ["x"]).length === 0);

	// 4) Gelecek tarih + Taslak → yürütücü dokunmaz
	await clickExact("Taslak");
	await setPublishAt(FUTURE);
	await page
		.waitForFunction(() => document.body.innerText.includes("Planlandı"), { timeout: 10000, polling: 300 })
		.catch(() => undefined);
	step("4. gelecek tarih 'Planlandı' der", await bodyHas("Planlandı"));
	await save();
	const run3 = await runSchedule();
	step("4b. gelecek doküman yürütülmedi", (run3?.runs?.[0]?.published ?? ["x"]).length === 0);
	if (MOCK) {
		step("4c. dosyada durum taslak kaldı", (mock.readFile(DOC_PATH)?.toString("utf8") ?? "").includes("status: draft"));
	}

	// 5) Medya alt/caption → repo manifesti (.wuppycms/media.json)
	const putAlt = (body) =>
		page.evaluate(
			(payload) =>
				fetch("/api/media/alt", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify(payload),
				}).then((r) => r.json()),
			body,
		);
	const getAlts = () =>
		page.evaluate(
			(repo) => fetch(`/api/media/alt?full_name=${encodeURIComponent(repo)}`, { credentials: "same-origin" }).then((r) => r.json()),
			REPO,
		);

	const saved1 = await putAlt({ full_name: REPO, path: "public/test/x.webp", alt: "E2E alt metni", caption: "E2E başlık" });
	step("5. alt kaydı", saved1?.ok === true && saved1.alt === "E2E alt metni");
	if (MOCK) {
		const manifest = mock.readFile(".wuppycms/media.json")?.toString("utf8") ?? "";
		step("5b. manifest repoda", manifest.includes("E2E alt metni") && manifest.includes("public/test/x.webp"));
		step("5c. commit (medya bilgisi)", mock.commitsFor(".wuppycms/media.json", "medya bilgisi güncellendi"));
	}
	const fetched = await getAlts();
	step("5d. GET alt manifestten", fetched?.alts?.["public/test/x.webp"] === "E2E alt metni" && fetched?.captions?.["public/test/x.webp"] === "E2E başlık");

	// 6) Boşalt → kayıt silinir
	await putAlt({ full_name: REPO, path: "public/test/x.webp", alt: "", caption: "" });
	const after = await getAlts();
	step("6. boşaltınca silindi", !after?.alts?.["public/test/x.webp"] && !after?.captions?.["public/test/x.webp"]);

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
