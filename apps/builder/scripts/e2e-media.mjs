// Medya paketi tam duman testi — her özellik gerçek tarayıcıda.
// Koşum: node scripts/e2e-media.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub sunucusu + kendi dev sunucusu
//     (:4399). Gerçek API'ye tek istek gitmez; commit kanıtları mock
//     deposundan okunur. Çalışırken :4321'de başka dev sunucusu OLMAMALI.
//   --real: eski akış — dev :4321 açık + gerçek GitHub (token .dev.vars'ta).
//
// Kaplar: yükleme(temiz ad) · klasör · gezme+URL · arama · filtre · ızgara/liste
// · detay çipleri · taşıma · alt/caption(repo manifesti) · kullanılan yer(Query cache)
// · kırpma(tembel panel+kopya) · silme · ad kilidi + Konum taşıması · değiştirme
// · lightbox · picker. Her yazma GitHub'da "(via WuppyCMS)" commit'i ile doğrulanır.
// Çalışma artıkları koşulardan önce ve sonra temizlenir.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, openSourcePane, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const MOCK_PORT = 4399;
const BASE = MOCK ? `http://localhost:${MOCK_PORT}` : "http://localhost:4321";
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const BRANCH = "main";
const SHOTS = fileURLToPath(new URL("../../../docs/evidence/", import.meta.url));
const TMP = "/tmp/opencode/e2e-media";

// --- küçük PNG üretici ----------------------------------------------------------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
function crc32(buf) {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}
function png(w, h, [r, g, b]) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	const rows = Buffer.concat(
		Array.from({ length: h }, () =>
			Buffer.concat([
				Buffer.from([0]),
				Buffer.from(Uint8Array.from({ length: w * 3 }, (_, i) => [r, g, b][i % 3])),
			]),
		),
	);
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", deflateSync(rows)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

mkdirSync(TMP, { recursive: true });
// Ad .webp → optimizeImage dosaya dokunmaz (KEEP_AS_IS): yollar ve bayt
// boyutları baştan belirlenir. Dönüşüm özelliği ayrıca 200×200 PNG ile sınanır.
const UP_NAME = "E2E Test Fotoğraf.webp"; // ı→i, ğ→g temizleme kanıtı
writeFileSync(`${TMP}/${UP_NAME}`, png(2, 2, [0, 0, 255]));
writeFileSync(`${TMP}/red-4x3.webp`, png(4, 3, [255, 0, 0]));
writeFileSync(`${TMP}/restore-2x2.webp`, png(2, 2, [0, 0, 255]));
writeFileSync(`${TMP}/Dönüşüm Testi.png`, png(200, 200, [10, 120, 220]));

// --- sonuç defteri ---------------------------------------------------------------
const results = [];
function step(name, cond, extra = "") {
	results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
	if (!cond) process.exitCode = 1;
	return Boolean(cond);
}
async function guard(name, fn) {
	try {
		await fn();
	} catch (error) {
		step(name, false, String(error).slice(0, 120));
	}
}

// --- GitHub (commit yoklaması + API temizliği) -------------------------------------
// İki mod: varsayılan mock bellek-içi sahte sunucudan okur (ağsız), --real
// gerçek GitHub API'sine gider (token .dev.vars'tan, geç tutarlılık yoklamalı).
let mock = null;
let env = null;

/** Seed görseli: geçerli WebP baytları (canvas'ta PNG'den çevrilir). */
async function makeSeedWebp(browser) {
	const scratch = await browser.newPage();
	try {
		const pngData = png(48, 32, [30, 144, 255]).toString("base64");
		const webpData = await scratch.evaluate(async (dataUrl) => {
			const img = new Image();
			img.src = dataUrl;
			await img.decode();
			const canvas = document.createElement("canvas");
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			canvas.getContext("2d").drawImage(img, 0, 0);
			return canvas.toDataURL("image/webp").split(",")[1];
		}, `data:image/png;base64,${pngData}`);
		return Buffer.from(webpData, "base64");
	} finally {
		await scratch.close();
	}
}


async function gh(path, init = {}, retry = 3) {
	for (let i = 0; i < retry; i += 1) {
		try {
			const r = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
				...init,
				headers: {
					"User-Agent": "wuppycms-e2e",
					...(GH_TOKEN ? { Authorization: `Bearer ${GH_TOKEN}` } : {}),
					...(init.headers ?? {}),
				},
			});
			if (r.ok) return r.json();
			if (r.status === 404) return null;
		} catch {
			/* ağ gürültüsü */
		}
		await sleep(2000);
	}
	return null;
}
/** GitHub listeleri geç tutarlıdır — bulunana dek dene. Mock modda durum
 *  eşzamanlı görünse de UI commit'i arka planda atar; kısa yoklama gerekir. */
async function commitFor(path, needle, timeoutMs = 45000) {
	if (MOCK) {
		const until = Date.now() + timeoutMs;
		while (Date.now() < until) {
			if (mock.commitsFor(path, needle)) return true;
			await sleep(250);
		}
		return false;
	}
	const until = Date.now() + timeoutMs;
	while (Date.now() < until) {
		const data = await gh(`commits?per_page=6&path=${encodeURIComponent(path)}`, {}, 1);
		if (data?.some?.((c) => c.commit.message.includes(needle) && c.commit.message.includes("via WuppyCMS")))
			return true;
		await sleep(3000);
	}
	return false;
}
const devVars = readFileSync(fileURLToPath(new URL("../.dev.vars", import.meta.url)), "utf8");
const GH_TOKEN = /GITHUB_TOKEN="?([^"\n]+)"?/.exec(devVars)?.[1] ?? "";
async function ghDelete(path) {
	if (MOCK) return mock.deleteFile(path, "chore: e2e medya temizliği (via WuppyCMS)");
	const meta = await gh(`contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${BRANCH}`, {
		headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json" },
	});
	if (!meta?.sha) return false;
	const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
		method: "DELETE",
		headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "wuppycms-e2e" },
		body: JSON.stringify({ message: "chore: e2e medya temizliği (via WuppyCMS)", sha: meta.sha, branch: BRANCH }),
	});
	return res.ok;
}

// --- tarayıcı ---------------------------------------------------------------------
if (MOCK) {
	env = await startMockEnv({
		appDir: fileURLToPath(new URL("..", import.meta.url)),
		port: MOCK_PORT,
		fullName: REPO,
		branch: BRANCH,
		logFile: `${TMP}/mock-dev.log`,
	});
	mock = env.mock;
}
const consoleErrors = [];
let usageRequests = 0;
const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
if (MOCK) {
	const webp = await makeSeedWebp(browser);
	seedSite(mock, { "public/test/screenshot-20261015-121107.webp": webp });
}
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
// Mock modda depo önizlemeleri raw.githubusercontent'tan gelir (media-core);
// istek kesilip baytlar mock deposundan servis edilir — ağsız kalır.
if (MOCK) await installRawImageProxy(page, mock);
page.on("dialog", (d) => void d.accept());
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("console", (m) => {
	if (m.type() === "error") consoleErrors.push(m.text());
});
page.on("request", (r) => {
	if (r.url().includes("/api/media/usage")) usageRequests += 1;
});

const waitText = (text, timeout = 30000) =>
	page.waitForFunction((t) => document.body.innerText.includes(t), { timeout, polling: 500 }, text);
const waitUrl = (part, timeout = 25000) =>
	page.waitForFunction((p) => location.href.includes(p), { timeout, polling: 400 }, part);
const mediaUrl = (folder = "") =>
	`${BASE}/admin/wuppycms-demo-site/media${folder ? `/${folder}` : ""}?site=${SITE}&mediaLibrary=repo_media`;
const gotoMedia = async (folder = "") => {
	await page.goto(mediaUrl(folder), { waitUntil: "networkidle2", timeout: 60000 });
	await waitText("public/");
	// Ağaç gerçekten indirilene dek "+ Yükle" butonu "Yükleniyor…" kalır.
	await page.waitForFunction(
		() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "+ Yükle"),
		{ timeout: 40000, polling: 400 },
	);
	if (!folder) await waitText("Klasörler");
};
const dialogGone = () =>
	page.waitForFunction(() => !document.querySelector('[data-slot="dialog-content"]'), { timeout: 30000 });
const bodyHas = (part) => page.evaluate((p) => document.body.innerText.includes(p), part);
const clickWhere = (selector, predicate) =>
	page.evaluate(
		(sel, pred) => {
			const el = [...document.querySelectorAll(sel)].find((b) => new Function("b", `return (${pred})`)(b));
			if (el) el.click();
			return Boolean(el);
		},
		selector,
		predicate,
	);
const clickText = (selector, text) =>
	clickWhere(selector, `(b.textContent ?? "").trim().startsWith(${JSON.stringify(text)})`);
const dialogButton = (text) =>
	clickWhere(`[data-slot="dialog-content"] button`, `(b.textContent ?? "").trim().includes(${JSON.stringify(text)})`);
/** Izgarada açma düğmesi aria-label taşır; listede ad <p>'tır, açma görsel düğmesidir. */
const openDetails = (namePart) =>
	page.evaluate((part) => {
		const grid = [...document.querySelectorAll("button[aria-label]")].find((b) =>
			(b.getAttribute("aria-label") ?? "").includes(part),
		);
		if (grid) return grid.click(), true;
		const row = [...document.querySelectorAll("tr")].find((r) => r.textContent?.includes(part));
		const thumb = row?.querySelector("button");
		if (thumb) return thumb.click(), true;
		return false;
	}, namePart);
const setNativeValue = (el, value) => {
	const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
	Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
	el.dispatchEvent(new Event("change", { bubbles: true }));
};
const setInputValue = (selector, value) =>
	page.evaluate(
		(sel, v) => {
			const el = document.querySelector(sel);
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
			setter.call(el, v);
			el.dispatchEvent(new Event("input", { bubbles: true }));
		},
		selector,
		value,
	);
const trashRow = (namePart) =>
	page.evaluate((part) => {
		const row = [...document.querySelectorAll("tr")].find((r) => r.textContent?.includes(part));
		const btn = row?.querySelector('button[title="Sil"]');
		if (btn) btn.click();
		return Boolean(btn);
	}, namePart);

const mediaInput = 'input[placeholder="dosya adına göre ara…"]';

const cardExists = (namePart) =>
	page.evaluate(
		(p) => [...document.querySelectorAll("button[aria-label]")].some((b) => (b.getAttribute("aria-label") ?? "").includes(p)),
		namePart,
	);
const rowExists = (namePart) =>
	page.evaluate((part) => [...document.querySelectorAll("tr")].some((r) => r.textContent?.includes(part)), namePart);

/** Bildirim metni kart basımıyla karışabilir — kartın DOM'a gelişini bekle. */
const waitCard = (namePart, timeout = 40000) =>
	page.waitForFunction(
		(p) => [...document.querySelectorAll("button[aria-label]")].some((b) => (b.getAttribute("aria-label") ?? "").includes(p)),
		{ timeout, polling: 500 },
		namePart,
	);

/** Yükleme/değiştirme POST'ları — dosya seçiminin gerçekten işlendiğinin kanıtı. */
let mediaPosts = 0;
page.on("request", (r) => {
	if (r.method() === "POST" && /\/api\/git\/(upload|file)/.test(r.url())) mediaPosts += 1;
});

/** Uygulama tek eşzamanlı yazım oturumuna izin verir (klasör oluşturma dahil). */
const waitUploadSlotFree = () =>
	page
		.waitForFunction(
			() =>
				!document.body.innerText.includes("oluşturuluyor…") &&
				!document.body.innerText.includes("Başka bir yükleme sürüyor"),
			{ timeout: 25000, polling: 700 },
		)
		.catch(() => undefined);

/**
 * Canlı girdiyi yeniden bulup yükler. Ana kanıt bildirim metnidir; dosya
 * girişi handler tarafından hemen temizlenebilir, POST ise optimizeImage
 * yüzünden 2-3 sn gecikebilir — ikisi yalnız hızlandırıcı ipucudur.
 */
async function uploadTo(selector, filePath, marker, markerWait = 45000) {
	let seen = "";
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await waitUploadSlotFree();
		const input = await page.$(selector);
		if (!input) throw new Error(`girdi yok: ${selector}`);
		const before = mediaPosts;
		await input.uploadFile(filePath);
		await sleep(2500);
		const gotFile = await page.evaluate((sel) => (document.querySelector(sel)?.files?.length ?? 0) > 0, selector);
		const posted = mediaPosts > before;
		seen = `dosya=${gotFile} POST=${posted}`;
		try {
			await waitText(marker, posted || gotFile ? markerWait : 15000);
			return true;
		} catch {
			if (posted) throw new Error(`yükleme başladı ama sonuç görünmedi: ${marker}`);
		}
	}
	throw new Error(seen);
}

/** Çalışma artıklarını süpür: UI'dan listelenen e2e dosyaları, API'den .gitkeep'ler. */
async function cleanLeftovers() {
	for (const folder of ["", "test", "e2e-test"]) {
		await gotoMedia(folder).catch(() => undefined);
		for (const name of ["e2e-test-fotograf", "e2e-yeniden", "e2e-test-fotograf-crop", "donusum-testi"]) {
			if (await bodyHas(name)) {
				await page.evaluate(() => document.querySelector('button[title="Liste görünümü"]')?.click());
				await sleep(400);
				await trashRow(name);
				await sleep(2500);
			}
		}
	}
	await page.evaluate(() => document.querySelector('button[title="Izgara görünümü"]')?.click());
	for (const p of ["public/e2e-test/.gitkeep", "public/test/e2e-test/.gitkeep"]) await ghDelete(p);
}

/** Değiştirilen dosyanın baytlarını doğrula (IHDR genişlik/yükseklik). */
async function ghDims(path, w, h, timeoutMs = 45000) {
	if (MOCK) {
		const until = Date.now() + Math.min(timeoutMs, 10000);
		while (Date.now() < until) {
			const b = mock.readFile(path);
			if (b && b.length > 24 && b.readUInt32BE(16) === w && b.readUInt32BE(20) === h) return true;
			await sleep(300);
		}
		return false;
	}
	const until = Date.now() + timeoutMs;
	while (Date.now() < until) {
		const d = await gh(`contents/${path}?ref=${BRANCH}`, {}, 1);
		if (d?.content) {
			const b = Buffer.from(d.content, "base64");
			if (b.length > 24 && b.readUInt32BE(16) === w && b.readUInt32BE(20) === h) return true;
		}
		await sleep(3000);
	}
	return false;
}

try {
	await guard("0. giriş", () => login(page, BASE));
	await guard("0b. artık temizliği", cleanLeftovers);

	// 1) Medya görünümü — kök: klasörler + URL kitaplık imi
	await guard("1. medya görünümü", async () => {
		await gotoMedia();
		step("1a. depo imi", await bodyHas("depo"));
		step("1b. test klasörü kartı", await bodyHas("test/"));
		step("1c. URL repo_media", await page.evaluate(() => location.href.includes("mediaLibrary=repo_media")));
	});

	// 2) Kitaplık değiştirici — site mediaR2 tanımlıysa anlamlı
	await guard("2. kitaplık değiştirici", async () => {
		const has = await clickText("button", "R2");
		if (!has) {
			step("2. R2 anahtarı", true, "N/A — sitede mediaR2 yok, anahtar bilinçli gizli");
			return;
		}
		const okR2 = await waitUrl("mediaLibrary=platform_r2", 15000).then(() => true).catch(() => false);
		await clickText("button", "Depo");
		await waitUrl("mediaLibrary=repo_media");
		step("2. R2 ↔ Depo", okR2);
	});

	// 3) Klasör gezme + breadcrumb + alt klasördeki görsel
	await guard("3. klasör gezme", async () => {
		await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "test/"), { timeout: 30000 });
		await clickText("button", "test/");
		await waitUrl("/media/test");
		await waitText("screenshot-20261015");
		step("3a. klasör URL'i + içerik", await page.evaluate(() => location.pathname.endsWith("/media/test")));
		step("3b. webp önizlemesi", await page.evaluate(() =>
			Boolean([...document.querySelectorAll("img")].find((i) => i.src.includes("screenshot-20261015"))),
		));
		await page.evaluate(() => {
			const el = [...document.querySelectorAll("main button")].find((b) => (b.textContent ?? "").trim() === "Medya");
			el?.click();
		});
		await waitText("Klasörler");
		step("3c. breadcrumb ile köke dönüş", await page.evaluate(() => !location.pathname.endsWith("/test")));
	});

	// 4) Arama (test klasörü içinde)
	await guard("4. arama", async () => {
		await gotoMedia("test");
		await setInputValue(mediaInput, "screenshot");
		await sleep(600);
		step("4a. eşleşen kart", await bodyHas("screenshot-20261015"));
		await setInputValue(mediaInput, "zzz-yok");
		await sleep(600);
		step("4b. boş sonuç", !(await bodyHas("screenshot-20261015")));
		await setInputValue(mediaInput, "");
		await waitText("screenshot-20261015");
	});

	// 5) Tür filtresi
	await guard("5. tür filtresi", async () => {
		const changed = await page.evaluate(() => {
			const sel = [...document.querySelectorAll("select")].find((s) =>
				[...s.options].some((o) => o.text.includes("Görseller")),
			);
			const video = sel && [...sel.options].find((o) => o.value === "video");
			if (!sel || !video) return false;
			Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, "video");
			sel.dispatchEvent(new Event("change", { bubbles: true }));
			return true;
		});
		await sleep(600);
		step("5a. videoda webp elemeli", changed && !(await bodyHas("screenshot-20261015")));
		await page.evaluate(() => {
			const sel = [...document.querySelectorAll("select")].find((s) =>
				[...s.options].some((o) => o.text.includes("Görseller")),
			);
			const all = [...sel.options].find((o) => o.text.includes("Tüm"));
			Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, all.value);
			sel.dispatchEvent(new Event("change", { bubbles: true }));
		});
		await waitText("screenshot-20261015");
		step("5b. filtreden dönüş", true);
	});

	// 6) Liste görünümü + kalıcılık (sonra ızgaraya dön)
	await guard("6. liste görünümü", async () => {
		await page.evaluate(() => document.querySelector('button[title="Liste görünümü"]')?.click());
		await sleep(800);
		step("6a. satırda ad", await bodyHas("screenshot-20261015"));
		await gotoMedia("test");
		step("6b. tercih tazelemede kalır", await page.evaluate(() => Boolean(document.querySelector("table"))));
		await page.screenshot({ path: `${SHOTS}media-02-list.png` });
		await page.evaluate(() => document.querySelector('button[title="Izgara görünümü"]')?.click());
		await sleep(400);
	});

	// 7) Klasör oluştur (kökte)
	await guard("7. klasör oluştur", async () => {
		await gotoMedia();
		await clickText("button", "+ Klasör");
		await page.type('input[placeholder="klasör adı…"]', "e2e-test");
		await page.keyboard.press("Enter");
		await waitText("e2e-test/");
		step("7a. klasör kartı", true);
		step("7b. commit (.gitkeep eklendi)", await commitFor("public/e2e-test/.gitkeep", "eklendi"));
	});

	// 8) Yükleme — Türkçe ad temizliği (ı→i, ğ→g)
	await guard("8. yükleme", async () => {
		await uploadTo('input[type="file"]', `${TMP}/${UP_NAME}`, "e2e-test-fotograf");
		await waitCard("e2e-test-fotograf");
		step("8a. temizlenmiş ad (ı→i, ğ→g)", true);
		step("8b. yükleme bildirimi", await bodyHas("yüklendi"));
		step("8c. commit (yüklendi)", await commitFor("public/e2e-test-fotograf.webp", "yüklendi"));
	});

	// 8d) WebP'ye çevirim — optimizeImage dönüşümü + onay + ad değişimi
	await guard("8d. PNG→WebP çevrimi", async () => {
		await uploadTo('input[type="file"]', `${TMP}/Dönüşüm Testi.png`, "donusum-testi");
		await waitCard("donusum-testi");
		step("8e. çevrilen ad .webp oldu", await cardExists("donusum-testi.webp") || await cardExists("donusum-testi"));
		await page.evaluate(() => document.querySelector('button[title="Liste görünümü"]')?.click());
		await sleep(500);
		step("8f. çevrilen silindi", await trashRow("donusum-testi"));
		await sleep(3000);
		await page.evaluate(() => document.querySelector('button[title="Izgara görünümü"]')?.click());
		await sleep(400);
	});

	// 9) Detay diyaloğu: çipler + klasöre taşıma
	await guard("9. detay + taşıma", async () => {
		step("9a. diyalog açıldı", await openDetails("e2e-test-fotograf"));
		await waitText("Medya detayları");
		await waitText("2 × 2", 25000);
		step("9b. boyutlar çipi", true);
		step("9c. biçim çipi WEBP", await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").includes("Biçim: WEBP")));
		await page.evaluate(() => {
			const sel = document.querySelector('[data-slot="dialog-content"] select');
			Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, "e2e-test");
			sel.dispatchEvent(new Event("change", { bubbles: true }));
		});
		await sleep(300);
		await dialogButton("Kaydet");
		await dialogGone();
		step("9d. taşıma commit", await commitFor("public/e2e-test/e2e-test-fotograf.webp", "cms:"));
		await gotoMedia("e2e-test");
		step("9e. dosya yeni klasörde", await cardExists("e2e-test-fotograf"));
	});

	// 10) Alt + caption — D1 turu (sayfa tazelemesi sonrası kalıcı)
	await guard("10. alt + caption", async () => {
		await openDetails("e2e-test-fotograf");
		await waitText("Medya detayları");
		await page.waitForFunction(() => document.querySelectorAll('[data-slot="dialog-content"] textarea').length >= 2, { timeout: 15000 });
		await page.evaluate(() => {
			const tas = [...document.querySelectorAll('[data-slot="dialog-content"] textarea')];
			const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
			set.call(tas[0], "E2E alt metni");
			tas[0].dispatchEvent(new Event("input", { bubbles: true }));
			set.call(tas[1], "E2E başlığı");
			tas[1].dispatchEvent(new Event("input", { bubbles: true }));
		});
		await sleep(300);
		await dialogButton("Kaydet");
		await sleep(1500);
		await gotoMedia("e2e-test");
		await openDetails("e2e-test-fotograf");
		await waitText("Medya detayları");
		await page
			.waitForFunction(() => [...document.querySelectorAll('[data-slot="dialog-content"] textarea')].some((t) => t.value === "E2E alt metni"), {
				timeout: 15000,
				polling: 400,
			})
			.catch(() => undefined);
		step("10a. alt kalıcı (repo manifesti)", await page.evaluate(() =>
			[...document.querySelectorAll('[data-slot="dialog-content"] textarea')].some((t) => t.value === "E2E alt metni"),
		));
		step("10b. caption kalıcı", await page.evaluate(() =>
			[...document.querySelectorAll('[data-slot="dialog-content"] textarea')].some((t) => t.value === "E2E başlığı"),
		));
	});

	// 11) Kullanılan yer — tarama tek istek (Query önbelleği)
	await guard("11. kullanılan yer", async () => {
		usageRequests = 0;
		await dialogButton("Kullanılan yer");
		await waitText("kullanıldığı içerikler", 25000);
		await sleep(7000);
		const first = usageRequests;
		await dialogButton("Detaylar");
		await dialogButton("Kullanılan yer");
		await sleep(1500);
		step("11a. yeniden tarama yok (cache)", first === 1 && usageRequests === 1, `${first}→${usageRequests}`);
		await page
			.waitForFunction(() => document.body.innerText.includes("hiçbir içerikte"), { timeout: 30000, polling: 1000 })
			.catch(() => undefined);
		step("11b. boş kullanım mesajı", await bodyHas("hiçbir içerikte"));
		await page.screenshot({ path: `${SHOTS}media-03-usage.png` });
	});

	// 12) Kırpma — tembel panel, kopya oluştur, sil
	await guard("12. kırpma", async () => {
		let cropReady = false;
		for (let t = 0; t < 3 && !cropReady; t += 1) {
			await dialogButton("Görseli düzenle");
			cropReady = await page
				.waitForSelector(".reactEasyCrop_Container", { timeout: 15000 })
				.then(() => true)
				.catch(() => false);
			if (!cropReady) {
				// Vite ilk açılışta tembel bağımlılığı paketleyip sayfayı yeniden yükleyebilir
				await sleep(2500);
				await openDetails("e2e-test-fotograf");
				await waitText("Medya detayları", 15000).catch(() => undefined);
			}
		}
		step("12a. kırpma paneli tembel yüklendi", cropReady);
		if (!cropReady) throw new Error("kırpma paneli üç denemede açılmadı");
		await page.screenshot({ path: `${SHOTS}media-04-crop.png` });
		await dialogButton("Kırpılmış kopya oluştur");
		await waitCard("e2e-test-fotograf-crop");
		step("12b. kopya oluştu", true);
		step("12c. kopya commit", await commitFor("public/e2e-test/e2e-test-fotograf-crop.webp", "yüklendi"));
		await dialogButton("Kapat");
		await sleep(600);
		await page.evaluate(() => document.querySelector('button[title="Liste görünümü"]')?.click());
		await sleep(500);
		step("12d. silme", await trashRow("e2e-test-fotograf-crop"));
		await page
			.waitForFunction((p) => ![...document.querySelectorAll("tr")].some((r) => r.textContent?.includes(p)), { timeout: 30000, polling: 1000 }, "e2e-test-fotograf-crop")
			.catch(() => undefined);
		step("12e. kopya gitti", !(await rowExists("e2e-test-fotograf-crop")));
		step("12f. silme commit", await commitFor("public/e2e-test/e2e-test-fotograf-crop.webp", "silindi"));
	});

	// 13) Lightbox — diyalog önizlemesinden
	await guard("13. lightbox", async () => {
		await page.evaluate(() => document.querySelector('button[title="Izgara görünümü"]')?.click());
		await sleep(400);
		await openDetails("e2e-test-fotograf");
		await waitText("Medya detayları");
		const before = await page.evaluate(() => document.querySelectorAll("img[src*='raw.githubusercontent']").length);
		await page.evaluate(() => document.querySelector('[data-slot="dialog-content"] img')?.click());
		await sleep(1400);
		const after = await page.evaluate(() => document.querySelectorAll("img[src*='raw.githubusercontent']").length);
		step("13a. lightbox açıldı", after > before, `${before}→${after}`);
		await page.keyboard.press("Escape"); // önce en üst katman (lightbox) kapanır
		await sleep(500);
		step("13b. Escape lightbox'u kapattı", await page.evaluate((n) => document.querySelectorAll("img[src*='raw.githubusercontent']").length <= n, before));
		await page.keyboard.press("Escape"); // sonra diyalog
		await sleep(700);
		step("13c. Escape diyalogu kapattı", await page.evaluate(() => !document.querySelector('[data-slot="dialog-content"]')));
	});

	// 14) Yeniden adlandırma
	// 14) Ad kilidi (kullanıcı kararı): File name salt okunur; yalnız Konum ile taşıma
	await guard("14. ad kilidi + taşıma", async () => {
		await gotoMedia("e2e-test");
		await openDetails("e2e-test-fotograf");
		await waitText("Medya detayları");
		await page.waitForFunction(
			(p) =>
				[...document.querySelectorAll('[data-slot="dialog-content"] input')].some(
					(i) => i.readOnly && i.value.includes(p),
				),
			{ timeout: 15000, polling: 300 },
			"e2e-test-fotograf",
		);
		step("14a. File name alanı salt okunur", true);
		const nameInput = await page
			.evaluateHandle(
				(p) =>
					[...document.querySelectorAll('[data-slot="dialog-content"] input')].find(
						(i) => i.readOnly && i.value.includes(p),
					),
				"e2e-test-fotograf",
			)
			.then((h) => h.asElement());
		if (!nameInput) throw new Error("ad alanı bulunamadı");
		await nameInput.click();
		await page.keyboard.type("-degismis");
		await sleep(300);
		step(
			"14b. ad değişmedi",
			await page.evaluate(
				(p) =>
					[...document.querySelectorAll('[data-slot="dialog-content"] input')].some(
						(i) => i.readOnly && i.value === p,
					),
				"e2e-test-fotograf.webp",
			),
		);
		// Yalnız Konum: kitaplık köküne taşı (onay native kutusu otomatik kabul edilir).
		await page.evaluate(() => {
			const sel = document.querySelector('[data-slot="dialog-content"] select');
			const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
			set.call(sel, "");
			sel.dispatchEvent(new Event("change", { bubbles: true }));
		});
		await sleep(300);
		await dialogButton("Kaydet");
		await sleep(600);
		await dialogGone();
		await gotoMedia("");
		step("14c. dosya kökte", await cardExists("e2e-test-fotograf"));
		step("14d. taşınma commit", await commitFor("public/e2e-test-fotograf.webp", "cms:"));
	});

	// 15) Görseli değiştir (aynı yola yeni bayt) + geri yükleme
	await guard("15. görseli değiştir", async () => {
		await gotoMedia("");
		await openDetails("e2e-test-fotograf");
		await waitText("Medya detayları");
		await uploadTo('[data-slot="dialog-content"] input[accept*="image"]', `${TMP}/red-4x3.webp`, "değiştirildi");
		step("15a. değiştirme bildirimi", true);
		step("15b. baytlar değişti (4×3 GH içeriği)", await ghDims("public/e2e-test-fotograf.webp", 4, 3));
		step("15c. güncelleme commit", await commitFor("public/e2e-test-fotograf.webp", "güncellendi"));
		await uploadTo('[data-slot="dialog-content"] input[accept*="image"]', `${TMP}/restore-2x2.webp`, "değiştirildi");
		step("15d. orijinal baytlar geri yüklendi (2×2)", await ghDims("public/e2e-test-fotograf.webp", 2, 2));
		await dialogButton("Kapat");
	});

	// 16) Silme (satır çöpü)
	await guard("16. silme", async () => {
		await page.evaluate(() => document.querySelector('button[title="Liste görünümü"]')?.click());
		await sleep(500);
		step("16a. çöp bulundu", await trashRow("e2e-test-fotograf"));
		await page
			.waitForFunction((p) => ![...document.querySelectorAll("tr")].some((r) => r.textContent?.includes(p)), { timeout: 30000, polling: 1000 }, "e2e-test-fotograf")
			.catch(() => undefined);
		step("16b. dosya gitti", !(await rowExists("e2e-test-fotograf")));
		step("16c. silme commit", await commitFor("public/e2e-test-fotograf.webp", "silindi"));
	});

	// 17) e2e-test klasörünü (.gitkeep) API ile temizle
	await guard("17. klasör temizliği", async () => {
		const del = await ghDelete("public/e2e-test/.gitkeep");
		let gone = false;
		for (let t = 0; t < 6 && !gone; t += 1) {
			await gotoMedia();
			gone = !(await bodyHas("e2e-test/"));
			if (!gone) await sleep(6000); // GH ağaç yanıtı 60 sn önbellekli olabilir
		}
		step("17a. klasör kartı gitti", gone, del ? "API silme" : "zaten yoktu");
	});

	// 18) Editör medya seçicisi (picker) — P0: gövde mdxeditor; bağın düştüğü
	// yer "Böl" modundaki Markdown kaynağı (ilk açılış Vite'ı paketleyip
	// sayfayı yenileyebilir → denemeli).
	await guard("18. picker", async () => {
		await gotoMedia("test"); // seçici o anki klasörü gösterir → bağlam test/ olsun
		await clickText("aside button", "Blog");
		await waitText("Merhaba dünya", 20000);
		await page.evaluate(() => {
			const el = [...document.querySelectorAll("main button, main a")].find((b) =>
				(b.textContent ?? "").includes("Merhaba dünya"),
			);
			el?.click();
		});
		const SOURCE = 'textarea[aria-label="Markdown kaynağı"]';
		let splitReady = false;
		for (let attempt = 0; attempt < 3 && !splitReady; attempt += 1) {
			await waitText("Medyadan ekle", 20000).catch(() => undefined);
			await page.evaluate(() => {
				const btn = [...document.querySelectorAll("main button")].find(
					(b) => (b.textContent ?? "").trim() === "Böl",
				);
				if (btn) btn.click();
			});
			await openSourcePane(page);
			splitReady = await page
				.waitForSelector(SOURCE, { timeout: 10000 })
				.then(() => true)
				.catch(() => false);
			if (!splitReady) await sleep(2500);
		}
		await clickText("main button", "Medyadan ekle");
		await page.waitForFunction(
			() => Boolean(document.querySelector('[data-slot="dialog-content"] img')),
			{ timeout: 20000 },
		);
		await page.evaluate(() => {
			const el = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find((b) =>
				(b.textContent ?? "").includes("screenshot"),
			);
			el?.click();
		});
		await sleep(1500);
		step(
			"18a. bağ gövdeye eklendi",
			await page.evaluate(
				(sel) => (document.querySelector(sel)?.value ?? "").includes("screenshot-20261015"),
				SOURCE,
			),
		);
	});

	// 19) Konsol hijyeni
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("19. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await cleanLeftovers().catch(() => undefined);
	await page.screenshot({ path: `${SHOTS}media-99-final.png` }).catch(() => undefined);
	await browser.close();
	if (MOCK && mock) {
		// Depo temiz kaldı mı? (e2e artıkları süpürüldükten sonra kontrol)
		const leftovers = mock.files().filter((f) => /e2e|donusum-testi/i.test(f.path));
		step("20. mock depo temiz", leftovers.length === 0, leftovers.map((f) => f.path).join(", "));
	}
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
