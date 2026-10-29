// Editör CRUD dumanı: yazma/biçimlendirme (başlık, kalın, liste, alıntı, bağ,
// kod bloğu, tablo), medyadan görsel ekleme (önizleme + repo-only bağ kanıtı),
// embed, bul-değiştir, geri al/yinele, tümünü sil, kaydet + yeniden yükleme
// turu. İngilizice arayüzle koşar (pin'siz login).
// Koşum: node scripts/e2e-editor-crud.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4382).

import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import {
	baseSiteFiles,
	clickButtonByText,
	installRawImageProxy,
	login,
	openSourcePane,
	sleep,
	startMockEnv,
} from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4382 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_PATH = "src/content/blog/merhaba-dunya.mdx";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const SOURCE = 'textarea[aria-label="Markdown source"]';
const EDITOR = ".mdxeditor-root-contenteditable";
const IMG_PATH = "public/img/kirmizi.png";

const results = [];
const step = (name, cond, extra = "") => {
	results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
	if (!cond) process.exitCode = 1;
};

// --- küçük PNG üretici (media kartı + gerçek bayt yanıtı için) ------------------
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

let env = null;
let mock = null;
if (MOCK) {
	env = await startMockEnv({
		appDir: fileURLToPath(new URL("..", import.meta.url)),
		port: PORT,
		fullName: REPO,
		branch: "main",
		logFile: "/tmp/opencode/e2e-editor-crud-dev.log",
	});
	mock = env.mock;
	// seedSite yerine elle seed: ikili medya dosyası (base64) gerekiyor.
	mock.seed([
		...Object.entries(baseSiteFiles()).map(([path, content]) => ({ path, content })),
		{ path: IMG_PATH, contentBase64: png(8, 6, [220, 40, 40]).toString("base64") },
	], "chore: e2e crud mock deposu");
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
	const editorText = () => page.evaluate((sel) => document.querySelector(sel)?.innerText ?? "", EDITOR);
	const clickExact = (text) =>
		page.evaluate((t) => {
			const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === t);
			if (btn) btn.click();
			return Boolean(btn);
		}, text);
	const setInput = (label, value) =>
		page.evaluate(
			(l, v) => {
				const el = document.querySelector(`input[aria-label="${l}"]`);
				if (!el) return false;
				const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
				set.call(el, v);
				el.dispatchEvent(new Event("input", { bubbles: true }));
				return true;
			},
			label,
			value,
		);
	/** Son metin bloğunun sağ-alt köşesine tıklayarak imleci doküman sonuna
	 *  taşır. Görsel içeren paragraflar atlanır: dekore düğüme denk gelen tık
	 *  seçime dönüşür ve sonraki yazım görselin yerini alır. */
	const clickEditorEnd = async () => {
		const rect = await page.evaluate(
			(sel) => {
				const els = [...document.querySelectorAll(`${sel} p, ${sel} h1, ${sel} h2, ${sel} h3, ${sel} blockquote, ${sel} li`)].filter(
					(el) => !el.querySelector("img"),
				);
				const el = els[els.length - 1];
				if (!el) return null;
				const r = el.getBoundingClientRect();
				return { x: r.right - 6, y: r.bottom - 6 };
			},
			EDITOR,
		);
		if (!rect) return false;
		await page.mouse.click(rect.x, rect.y);
		return true;
	};
	/** Verilen metni içeren bloğun sağ kenarına tıklayarak imleci oraya taşır. */
	const clickEditorText = async (part) => {
		const rect = await page.evaluate(
			(sel, p) => {
				const el = [...document.querySelectorAll(`${sel} p, ${sel} h1, ${sel} h2, ${sel} h3, ${sel} blockquote, ${sel} li`)].find(
					(n) => (n.textContent ?? "").includes(p) && !n.querySelector("img"),
				);
				if (!el) return null;
				const r = el.getBoundingClientRect();
				return { x: r.right - 6, y: r.bottom - 6 };
			},
			EDITOR,
			part,
		);
		if (!rect) return false;
		await page.mouse.click(rect.x, rect.y);
		return true;
	};
	const ariaClick = (aria) =>
		page.evaluate((a) => {
			const btn = document.querySelector(`button[aria-label="${a}"]`);
			if (btn) btn.click();
			return Boolean(btn);
		}, aria);

	// 0) Giriş + doküman + Böl/Source (markdown doğrulamaları kaynak panelinden)
	await login(page, BASE, null);
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await page
		.waitForFunction(
			() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "Split"),
			{ timeout: 30000, polling: 400 },
		)
		.catch(() => undefined);
	await clickExact("Split");
	await openSourcePane(page);
	const sourceReady = await page
		.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("doküman"), { timeout: 15000, polling: 300 }, SOURCE)
		.then(() => true)
		.catch(() => false);
	step(
		"0. doküman + Source paneli + araç çubuğu",
		sourceReady && (await bodyHas("Insert from media")),
	);

	// 1) Başlık + paragraf yazma (markdown kısayolları)
	if (!(await clickEditorEnd())) await page.click(EDITOR);
	await page.keyboard.type("\n\n## CRUD-ISARET basligi\n\nornek paragraf.", { delay: 12 });
	await sleep(600);
	const headingOk = await page.evaluate(
		(sel) => [...document.querySelectorAll(`${sel} h2`)].some((h) => (h.textContent ?? "").includes("CRUD-ISARET")),
		EDITOR,
	);
	step("1. başlık + paragraf yazıldı", headingOk && (await editorText()).includes("ornek paragraf"));

	// 2) Kalın + liste (kısayollar)
	await page.keyboard.press("Enter");
	await page.keyboard.type("**kalin-sozcuk**", { delay: 12 });
	await page.keyboard.press("Enter");
	await page.keyboard.type("- liste-maddesi", { delay: 12 });
	await sleep(600);
	const fmt = await page.evaluate((sel) => {
		const root = document.querySelector(sel);
		return {
			strong: [...root.querySelectorAll("strong")].some((n) => (n.textContent ?? "").includes("kalin-sozcuk")),
			li: [...root.querySelectorAll("li")].some((n) => (n.textContent ?? "").includes("liste-maddesi")),
		};
	}, EDITOR);
	step("2. kalın + liste", fmt.strong && fmt.li, JSON.stringify(fmt));

	// 2b) Alıntı: boş li → Enter ile çık → "> " kısayolu (düz paragraf bağlamında)
	await page.keyboard.press("Enter");
	await sleep(250);
	await page.keyboard.press("Enter");
	await sleep(250);
	await page.keyboard.type("> alinti-satiri", { delay: 12 });
	await sleep(600);
	step(
		"2b. alıntı bloğu oluştu",
		await page.evaluate(
			(sel) => [...document.querySelectorAll(`${sel} blockquote`)].some((n) => (n.textContent ?? "").includes("alinti-satiri")),
			EDITOR,
		),
	);

	// 3) Bağ ekleme: kelime yaz → Create link → açılan alana URL yaz → Enter
	await page.keyboard.press("Enter");
	await sleep(250);
	await page.keyboard.press("Enter");
	await sleep(250);
	await page.keyboard.type("ornek-bag-meti", { delay: 12 });
	await sleep(300);
	step("3a. Create link düğmesi", await ariaClick("Create link"));
	await sleep(600);
	await page.keyboard.type("https://example.com", { delay: 10 });
	await page.keyboard.press("Enter");
	await sleep(600);
	step(
		"3b. bağ düğümü oluştu",
		await page.evaluate(
			(sel) => [...document.querySelectorAll(`${sel} a`)].some((a) => a.getAttribute("href") === "https://example.com"),
			EDITOR,
		),
	);
	await page.keyboard.press("Escape"); // Link editör artığı

	// 4) Satır içi kod: kelime yaz → seç → toolbar "Inline code format"
	// (Not: kod BLOĞU oluşturmanın editör yolu bu sürümde yok — "```" kısayolu
	// dönüşmüyor, yapıştırma sentetik olayla test edilemiyor; bu yüzden satır
	// içi kod kod düğümü kanıtı olarak kullanılıyor.)
	await page.keyboard.press("Enter");
	await page.keyboard.type("satir-ici-kod", { delay: 12 });
	await sleep(250);
	await page.keyboard.down("Shift");
	await page.keyboard.press("Home");
	await page.keyboard.up("Shift");
	step("4a. Inline code düğmesi", await ariaClick("Inline code format"));
	await sleep(500);
	step(
		"4b. satır içi kod düğümü oluştu",
		(await page.evaluate((sel) => [...document.querySelectorAll(`${sel} code`)].some((n) => (n.textContent ?? "").includes("satir-ici-kod")), EDITOR)) &&
			(await sourceText()).includes("`satir-ici-kod`"),
	);

	// 5) Tablo (araç çubuğu düğmesi doğrudan ekler)
	step("5a. Insert Table düğmesi", await ariaClick("Insert Table"));
	await sleep(700);
	step("5b. tablo eklendi", await page.evaluate((sel) => Boolean(document.querySelector(`${sel} table`)), EDITOR));

	// 6) Kaynak paneli: tüm yapılar ham markdown'da
	await sleep(600);
	const src1 = await sourceText();
	const missing = ["## CRUD-ISARET", "**kalin-sozcuk**", "liste-maddesi", "> alinti-satiri", "](https://example.com)", "`satir-ici-kod`", "| - |"]
		.filter((frag) => !src1.includes(frag));
	step("6. kaynak paneli tüm yapıları içeriyor", missing.length === 0, missing.join(" | "));

	// 7) Medyadan görsel ekle: kart seç → markdown + düzgün önizleme
	await clickEditorEnd();
	await clickButtonByText(page, "Insert from media");
	await page
		.waitForFunction(() => document.body.innerText.includes("Select from media"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	const cardReady = await page
		.waitForFunction(
			(p) => [...document.querySelectorAll('[data-slot="dialog-content"] button')].some((b) => (b.getAttribute("title") ?? "").startsWith(p)),
			{ timeout: 12000, polling: 300 },
			IMG_PATH,
		)
		.then(() => true)
		.catch(() => false);
	const cardClicked =
		cardReady &&
		(await page.evaluate((p) => {
			const card = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find((b) =>
				(b.getAttribute("title") ?? "").startsWith(p),
			);
			if (card) card.click();
			return Boolean(card);
		}, IMG_PATH));
	await sleep(600);
	const src2 = await sourceText();
	step(
		"7. medya görseli markdown'a eklendi (repo bağı)",
		cardClicked && src2.includes("![görsel](/img/kirmizi.png)") && !src2.includes("raw.githubusercontent"),
		`card=${cardClicked} tail=${src2.slice(-60).replace(/\n/g, "¶")}`,
	);
	// Hata kanıtı düzeltmesi: <img> artık önizleme adresiyle yükleniyor.
	const imgLoaded = await page
		.waitForFunction(
			(sel) => {
				const img = [...document.querySelectorAll(`${sel} img`)].find((i) => i.src.includes("raw.githubusercontent"));
				return Boolean(img && img.complete && img.naturalWidth > 0);
			},
			{ timeout: 15000, polling: 400 },
			EDITOR,
		)
		.then(() => true)
		.catch(() => false);
	step("7b. editörde görsel hatasız görünüyor", imgLoaded);
	if (imgLoaded) {
		await page.screenshot({ path: fileURLToPath(new URL("../../../docs/evidence/editor-media-preview.png", import.meta.url)) });
	}

	// 8) Embed: YouTube tanınır → Add → kaynakta iframe
	await clickExact("Embed");
	await page
		.waitForFunction(() => document.body.innerText.includes("Add embed"), { timeout: 10000, polling: 300 })
		.catch(() => undefined);
	await setInput("Embed bağlantısı", "https://youtu.be/dQw4w9WgXcQ");
	await page
		.waitForFunction(() => document.body.innerText.includes("Detected: YouTube"), { timeout: 10000, polling: 300 })
		.catch(() => undefined);
	await clickExact("Add");
	await page
		.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("youtube.com/embed/dQw4w9WgXcQ"), { timeout: 15000, polling: 300 }, SOURCE)
		.catch(() => undefined);
	const src3 = await sourceText();
	step("8. embed eklendi", src3.includes("youtube.com/embed/dQw4w9WgXcQ") && src3.includes("<iframe"));

	// 9) Bul & Değiştir (tümü) — girişlere gerçek fare+tuşla yazılır
	await clickButtonByText(page, "Find");
	await page
		.waitForFunction(() => Boolean(document.querySelector('input[aria-label="Find"]')), { timeout: 10000, polling: 300 })
		.catch(() => undefined);
	const bandInput = async (aria, text) => {
		const rect = await page.evaluate((a) => {
			const el = document.querySelector(`input[aria-label="${a}"]`);
			if (!el) return null;
			const r = el.getBoundingClientRect();
			return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
		}, aria);
		if (!rect) return false;
		await page.mouse.click(rect.x, rect.y);
		await page.keyboard.down("Control");
		await page.keyboard.press("a");
		await page.keyboard.up("Control");
		await page.keyboard.type(text, { delay: 8 });
		await sleep(250);
		return true;
	};
	const findTyped = await bandInput("Find", "CRUD-ISARET");
	const replTyped = await bandInput("Replace with", "CRUD-ISARET-2");
	const allClicked = await clickExact("All");
	await sleep(900);
	const src4 = await sourceText();
	step(
		"9. bul-değiştir (tümü) çalıştı",
		src4.includes("CRUD-ISARET-2") && (await editorText()).includes("CRUD-ISARET-2"),
		`find=${findTyped} repl=${replTyped} all=${allClicked} matches=${await page.evaluate(() => document.body.innerText.match(/\d+ match\w*/)?.[0] ?? "?")} q=${await page.evaluate(() => (document.querySelector('input[aria-label="Find"]')?.value ?? "?").slice(0, 20))} r=${await page.evaluate(() => (document.querySelector('input[aria-label="Replace with"]')?.value ?? "?").slice(0, 20))} ed=${(await editorText()).includes("CRUD-ISARET")}`,
	);
	await page.evaluate(() => document.querySelector('input[aria-label="Find"]')?.focus());
	await page.keyboard.press("Escape");

	// 10) Geri al / yinele (Lexical girdileri birleştirir; tek tıklma çoğu kez yeter).
	// Çapa: başlık metni — tablo hücreleri/HTML widget'ları son bloğa tıklamayı bozar.
	if (!(await clickEditorText("CRUD-ISARET"))) throw new Error("CRUD-ISARET başlığı bulunamadı");
	await page.keyboard.type("\n\nUNDO-SATIRI", { delay: 12 });
	await sleep(1200);
	const dbgPre = {
		markerInSrc: (await sourceText()).includes("UNDO-SATIRI"),
		markerInDom: (await editorText()).includes("UNDO-SATIRI"),
		undoD: await page.evaluate(() => document.querySelector('button[aria-label="Undo Ctrl+Z"]')?.disabled),
		redoD: await page.evaluate(() => document.querySelector('button[aria-label="Redo Ctrl+Y"]')?.disabled),
	};
	let undoOk = false;
	for (let i = 0; i < 10 && !undoOk; i += 1) {
		if (!(await ariaClick("Undo Ctrl+Z"))) break;
		await sleep(450); // kaynak paneli senkronu debounce'ludur
		undoOk = !(await sourceText()).includes("UNDO-SATIRI");
	}
	let redoOk = false;
	for (let i = 0; i < 10 && !redoOk; i += 1) {
		if (!(await ariaClick("Redo Ctrl+Y"))) break;
		await sleep(450);
		redoOk = (await sourceText()).includes("UNDO-SATIRI");
	}
	const redoFlag = await page.evaluate(() => document.querySelector('button[aria-label="Redo Ctrl+Y"]')?.disabled);
	step("10. geri al", undoOk, `pre=${JSON.stringify(dbgPre)}`);
	step("10b. yinele", redoOk, `redoDisabled=${redoFlag}`);

	// 11) Tümünü sil + yeni içerik yaz (kaynak paneli gövde-only'dir).
	// Ctrl+A üzerine yazmak seçim-üzerine-yazma CRUD'unun kendisidir; Backspace
	// korumalı blokta (HTML gömme) takılabiliyor.
	if (!(await clickEditorText("CRUD-ISARET"))) await page.click(EDITOR);
	await page.keyboard.down("Control");
	await page.keyboard.press("a");
	await page.keyboard.up("Control");
	await sleep(200);
	await page.keyboard.type("SON-ICERIK satiri", { delay: 12 });
	await sleep(700);
	const clearedSrc = await sourceText();
	const stale = ["CRUD-ISARET", "<iframe", "liste-maddesi", "satir-ici-kod", "dokümandır"].filter((f) => clearedSrc.includes(f));
	// Görsel bağı silinen gövdenin yerine yeniden ekle (kaydet testi ikisini de doğrular)
	await clickButtonByText(page, "Insert from media");
	await page
		.waitForFunction(
			(p) => [...document.querySelectorAll('[data-slot="dialog-content"] button')].some((b) => (b.getAttribute("title") ?? "").startsWith(p)),
			{ timeout: 12000, polling: 300 },
			IMG_PATH,
		)
		.catch(() => undefined);
	const recardClicked = await page.evaluate((p) => {
		const card = [...document.querySelectorAll('[data-slot="dialog-content"] button')].find((b) =>
			(b.getAttribute("title") ?? "").startsWith(p),
		);
		if (card) card.click();
		return Boolean(card);
	}, IMG_PATH);
	await sleep(700);
	const src5 = await sourceText();
	step(
		"11. tümü silindi + yeni satır + görsel yeniden eklendi",
		stale.length === 0 && src5.includes("SON-ICERIK satiri") && src5.includes("![görsel](/img/kirmizi.png)"),
		`stale=${stale.join(",")} recard=${recardClicked} residue=${clearedSrc.trim().slice(0, 60).replace(/\n/g, "¶")}`,
	);

	// 12) Kaydet → mock commit + dosya içeriği (repo-only bağ korunur)
	const saveClicked = await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === "Save");
		if (btn && !btn.disabled) btn.click();
		return Boolean(btn && !btn.disabled);
	});
	await page
		.waitForFunction(() => document.body.innerText.includes("Saved"), { timeout: 30000, polling: 500 })
		.catch(() => undefined);
	if (MOCK) {
		const file = mock.readFile(DOC_PATH)?.toString("utf8") ?? "";
		step("12. kaydet commit'i (via WuppyCMS)", saveClicked && mock.commitsFor(DOC_PATH, "via WuppyCMS"));
		step(
			"12b. dosyada SON-ICERIK + site bağı, ham URL yok",
			file.includes("SON-ICERIK satiri") && file.includes("](/img/kirmizi.png)") && !file.includes("raw.githubusercontent"),
		);
	} else {
		step("12. kaydet (gerçek mod)", saveClicked);
	}

	// 13) Yeniden yükle: içerik ve görsel önizlemesi depodan döner
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	await page
		.waitForFunction(
			() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "Split"),
			{ timeout: 30000, polling: 400 },
		)
		.catch(() => undefined);
	await page.keyboard.press("Escape"); // odak modu/bant artıkları varsa temizle
	await sleep(400);
	const reloaded = await page.evaluate((sel) => (document.querySelector(sel)?.innerText ?? "").includes("SON-ICERIK"), EDITOR);
	const imgReloaded = await page
		.waitForFunction(
			(sel) => {
				const img = [...document.querySelectorAll(`${sel} img`)].find((i) => i.src.includes("raw.githubusercontent"));
				return Boolean(img && img.complete && img.naturalWidth > 0);
			},
			{ timeout: 15000, polling: 400 },
			EDITOR,
		)
		.then(() => true)
		.catch(() => false);
	step("13. yeniden yükleme sonrası içerik + görsel", reloaded && imgReloaded);

	// 14) Konsol hijyeni
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED|Failed to load resource/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("14. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
