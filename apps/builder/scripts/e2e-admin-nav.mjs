// Geçiş dumanı: react-router yönlendirme sözleşmesinin gerçek tarayıcıdaki
// kanıtı. Koşum: node scripts/e2e-admin-nav.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4398).
//     Çalışırken :4321'de başka dev sunucusu OLMAMALI.
//   --real: dev :4321 açık + gerçek GitHub akışı.

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4398 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const BRANCH = "main";
const SHOTS = fileURLToPath(new URL("../../../docs/evidence/", import.meta.url));

const results = [];
const ok = (name, cond, extra = "") => {
	results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
	if (!cond) process.exitCode = 1;
};
const consoleErrors = [];

let env = null;
let mock = null;
if (MOCK) {
	env = await startMockEnv({
		appDir: fileURLToPath(new URL("..", import.meta.url)),
		port: PORT,
		fullName: REPO,
		branch: BRANCH,
		logFile: "/tmp/opencode/e2e-nav-dev.log",
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
	page.on("pageerror", (e) => consoleErrors.push(String(e)));
	page.on("response", (r) => {
		if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`);
	});
	page.on("console", (m) => {
		if (m.type() === "error") consoleErrors.push(m.text());
	});

	const waitUrlIncludes = (part, timeout = 30000) =>
		page.waitForFunction((p) => location.href.includes(p), { timeout, polling: 400 }, part);
	const waitUrlExcludes = (part, timeout = 30000) =>
		page.waitForFunction((p) => !location.href.includes(p), { timeout, polling: 400 }, part);

	// 1) Giriş
	await login(page, BASE);
	ok("giriş", true);

	// 2) /admin açılışı → kanonik site adresi
	await page.goto(`${BASE}/admin`, { waitUntil: "networkidle2", timeout: 60000 });
	await waitUrlIncludes("site=");

	// 2b) kanonik biçim denetimi
	ok(
		"açılışta site yolu + kısa kimlik",
		(await page.evaluate(() => location.pathname.startsWith("/admin/wuppycms-demo-site"))) &&
			(await page.evaluate((id) => new URL(location.href).searchParams.get("site") === id, SITE)),
		await page.evaluate(() => location.pathname + location.search),
	);

	// 3) Sidebar → Medya (PUSH)
	const clicked = await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) =>
			(b.textContent ?? "").trim().startsWith("Medya"),
		);
		if (btn) btn.click();
		return Boolean(btn);
	});
	if (clicked) await waitUrlIncludes("/media?");
	ok("sidebar Medya → /media?mediaLibrary=", clicked, await page.evaluate(() => location.pathname + location.search));

	// 4) Geri / İleri (POP)
	await page.goBack({ waitUntil: "domcontentloaded" });
	await waitUrlExcludes("/media?");
	ok("geri — medya adresinden çıkar", true, await page.evaluate(() => location.pathname));
	await page.goForward({ waitUntil: "domcontentloaded" });
	await waitUrlIncludes("/media?");
	await sleep(1500);
	ok("ileri — medya adresine döner", true);

	// 5) Klasör tıklaması → yola yazılır
	await page.waitForFunction(
		() => [...document.querySelectorAll("button, a")].some((b) => (b.textContent ?? "").trim().includes("test")),
		{ timeout: 30000, polling: 400 },
	);
	const folderClicked = await page.evaluate(() => {
		const el = [...document.querySelectorAll("button, a")].find((b) =>
			(b.textContent ?? "").trim().toLowerCase().includes("test"),
		);
		if (el) el.click();
		return Boolean(el);
	});
	if (folderClicked) await waitUrlIncludes("/media/test");
	ok("klasör gezme yolda görünür", folderClicked, await page.evaluate(() => location.pathname));
	if (folderClicked) {
		await sleep(2000);
		await page.screenshot({ path: `${SHOTS}react-router-media.png` });
	}

	// 6) Derin bağlantı: doküman (tam yeniden yükleme)
	await page.goto(`${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`, {
		waitUntil: "networkidle2",
		timeout: 60000,
	});
	let stable = true;
	try {
		await waitUrlIncludes("/content/blog/merhaba-dunya", 12000);
	} catch {
		stable = false;
	}
	await sleep(2500);
	const stillDoc = await page.evaluate(() => location.pathname.endsWith("/content/blog/merhaba-dunya"));
	ok("doküman derin bağlantısı yerinde durur", stable && stillDoc, await page.evaluate(() => location.pathname));
	await page.screenshot({ path: `${SHOTS}react-router-deeplink.png` });

	// 7) Eski biçim /admin/c/{kol} → kanonik /content/{kol}
	await page.goto(`${BASE}/admin/c/blog?site=${SITE}`, { waitUntil: "domcontentloaded", timeout: 60000 });
	let normalized = true;
	try {
		await waitUrlIncludes("/admin/wuppycms-demo-site/content/blog?", 25000);
	} catch {
		normalized = false;
	}
	ok("eski /c/ adresi normalize edildi", normalized, await page.evaluate(() => location.pathname + location.search));

	// 8) Konsol hijyeni (bilinen gürültü hariç)
	const noise = /favicon|ResizeObserver|WebSocket|Download the React DevTools|404 \(Not Found\)|HTTP 404 .*wuppycms%2Fresearch/i;
	const realErrors = consoleErrors.filter((e) => !noise.test(e));
	ok("konsol hatasız", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
