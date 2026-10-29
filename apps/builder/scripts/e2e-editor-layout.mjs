// Wryte editör yerleşimi dumanı: başlık + durum üst bardaki yuvalarda,
// araç çubuğu tek satır (sağda panel ikonları), Split'in sağ bölmesi canlı
// önizleme (varsayılan) + kaynak ikonuyla ham markdown; Outline/Research
// kolonları yan yana; frontmatter formu kapalı başlar.
// Dil sabitlenmez: uygulamanın AÇILIŞ dili (İngilizce) doğrulanır.
// Koşum: node scripts/e2e-editor-layout.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4383).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { clickButtonByText, installRawImageProxy, login, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4383 : 4321;
const BASE = `http://localhost:${PORT}`;
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";
const REPO = "fuatcangnc/wuppycms-demo-site";
const DOC_URL = `${BASE}/admin/wuppycms-demo-site/content/blog/merhaba-dunya?site=${SITE}`;
const SOURCE = 'textarea[aria-label="Markdown source"]';

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
		logFile: "/tmp/opencode/e2e-editor-layout-dev.log",
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
	page.on("dialog", (d) => void d.accept());

	const consoleErrors = [];
	page.on("pageerror", (e) => consoleErrors.push(String(e)));
	page.on("console", (m) => {
		if (m.type() === "error") consoleErrors.push(m.text());
	});

	/** "Split" moduna geç (ilk açılış Vite paketleme yenilemesi → denemeli). */
	const openSplit = async () => {
		for (let attempt = 0; attempt < 3; attempt += 1) {
			await page
				.waitForFunction(
					() => [...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "Split"),
					{ timeout: 30000, polling: 400 },
				)
				.catch(() => undefined);
			await clickButtonByText(page, "Split");
			const ready = await page
				.waitForFunction(
					() => Boolean(document.querySelector('[data-pane="preview"]')),
					{ timeout: 10000, polling: 300 },
				)
				.then(() => true)
				.catch(() => false);
			if (ready) return true;
			await sleep(2000);
		}
		return false;
	};

	// 0-1) Giriş + doküman + Split: dil sabit DEĞİL → açılış dili İngilizce olmalı
	step("0. giriş", await login(page, BASE, null));
	await page.goto(DOC_URL, { waitUntil: "networkidle2", timeout: 60000 });
	step("1. Split modu + önizleme bölmesi", await openSplit());
	const previewText = await page.evaluate(
		() => document.querySelector('[data-pane="preview"]')?.innerText ?? "",
	);
	step("1b. önizleme render edildi", previewText.includes("doküman"));
	step(
		"1c. kaynak textarea varsayılan kapalı",
		await page.evaluate((sel) => !document.querySelector(sel), SOURCE),
	);

	// 2) Source sekmesi → ham markdown
	await clickButtonByText(page, "Source");
	await page
		.waitForFunction((sel) => (document.querySelector(sel)?.value ?? "").includes("doküman"), { timeout: 10000, polling: 300 }, SOURCE)
		.catch(() => undefined);
	step("2. Source sekmesi ham markdown gösteriyor", await page.evaluate((sel) => (document.querySelector(sel)?.value ?? "").includes("doküman"), SOURCE));
	step("2b. önizleme bölmesi kapandı", await page.evaluate(() => !document.querySelector('[data-pane="preview"]')));

	// 3) Preview sekmesi → geri
	await clickButtonByText(page, "Preview");
	step(
		"3. Preview sekmesi geri getirdi",
		await page
			.waitForFunction(() => Boolean(document.querySelector('[data-pane="preview"]')), { timeout: 8000, polling: 300 })
			.then(() => true)
			.catch(() => false),
	);

	// 3b) Canlı önizleme: yazarken sağ bölme ~350 ms debounce ile güncellenir
	await page.click(".mdx-body-editor");
	await page.keyboard.down("Control");
	await page.keyboard.press("End");
	await page.keyboard.up("Control");
	await page.keyboard.type("\n\nCANLI-ONIZLEME-KANITI", { delay: 8 });
	step(
		"3b. canlı önizleme güncellendi",
		await page
			.waitForFunction(
				() => (document.querySelector('[data-pane="preview"]')?.innerText ?? "").includes("CANLI-ONIZLEME-KANITI"),
				{ timeout: 10000, polling: 300 },
			)
			.then(() => true)
			.catch(() => false),
	);

	// 4a) Wryte: paneller KAPALI başlar — yalnız araç çubuğu anahtarlarıyla açılır.
	const closedByDefault = await page.evaluate(
		() => !document.querySelector('[data-panel="outline"]') && !document.querySelector('[data-panel="research"]'),
	);
	step("4a. paneller kapalı başlar", closedByDefault);

	// 4) Outline + Araştırma anahtarlarla açılır; editör solda
	await clickButtonByText(page, "Outline");
	await clickButtonByText(page, "Research");
	await page.waitForFunction(
		() => Boolean(document.querySelector('[data-panel="outline"]') && document.querySelector('[data-panel="research"]')),
		{ timeout: 8000, polling: 300 },
	).catch(() => undefined);
	const layout = await page.evaluate(() => {
		const outline = document.querySelector('[data-panel="outline"]')?.getBoundingClientRect();
		const research = document.querySelector('[data-panel="research"]')?.getBoundingClientRect();
		const editor = document.querySelector(".mdx-body-editor")?.getBoundingClientRect();
		if (!outline || !research || !editor) return null;
		return {
			outlineLeft: outline.left,
			outlineRight: outline.right,
			outlineTop: outline.top,
			researchLeft: research.left,
			researchTop: research.top,
			editorRight: editor.right,
		};
	});
	step("4. Outline paneli görünür", Boolean(layout));
	step(
		"4b. Outline ve Araştırma yan yana",
		Boolean(layout) && layout.researchLeft >= layout.outlineRight - 8 && Math.abs(layout.outlineTop - layout.researchTop) < 60,
		layout ? `outline.right=${Math.round(layout.outlineRight)} research.left=${Math.round(layout.researchLeft)}` : "",
	);
	step(
		"4c. editör panellerin solunda",
		Boolean(layout) && layout.editorRight <= layout.outlineLeft + 4,
		layout ? `editor.right=${Math.round(layout.editorRight)} outline.left=${Math.round(layout.outlineLeft)}` : "",
	);

	// 4d) Tam genişlik şerit: yan kolon şeridi sıkıştırmaz — şeridin ALTINDAN
	// açılır ve şerit kolonun sol kenarının ötesine uzanır (%100 genişlik).
	const underBar = await page.evaluate(() => {
		const bar = document.querySelector("[data-editor-toolbar]")?.getBoundingClientRect();
		const outline = document.querySelector('[data-panel="outline"]')?.getBoundingClientRect();
		if (!bar || !outline) return false;
		return outline.top >= bar.bottom - 4 && bar.right > outline.left + 4;
	});
	step("4d. panel şeridin altında açılır (şerit tam genişlik)", underBar);

	// 5) Outline ✕ kapatır; bar anahtarı geri açar (✕ title = common.close "Close")
	await page.evaluate(() => {
		const panel = document.querySelector('[data-panel="outline"]');
		const btn = panel?.querySelector('button[title="Close"]');
		if (btn) btn.click();
		return Boolean(btn);
	});
	await sleep(400);
	step("5. Outline ✕ ile kapandı", await page.evaluate(() => !document.querySelector('[data-panel="outline"]')));
	await clickButtonByText(page, "Outline");
	step(
		"5b. bar anahtarı Outline'ı geri açtı",
		await page
			.waitForFunction(() => Boolean(document.querySelector('[data-panel="outline"]')), { timeout: 8000, polling: 300 })
			.then(() => true)
			.catch(() => false),
	);

	// 6) Frontmatter formu kapalı başlar; bar anahtarı açıp kapatır
	step("6. meta panel varsayılan kapalı", await page.evaluate(() => !document.querySelector('[data-panel="meta"]')));
	await clickButtonByText(page, "Show panel");
	step(
		"6b. Show panel → form açıldı",
		await page
			.waitForFunction(() => Boolean(document.querySelector('[data-panel="meta"]')), { timeout: 8000, polling: 300 })
			.then(() => true)
			.catch(() => false),
	);
	await clickButtonByText(page, "Hide panel");
	step(
		"6c. Hide panel → form kapandı",
		await page
			.waitForFunction(() => !document.querySelector('[data-panel="meta"]'), { timeout: 8000, polling: 300 })
			.then(() => true)
			.catch(() => false),
	);

	// 7) Araştırma: "+ Add research" kompozörü açar
	await clickButtonByText(page, "+ Add research");
	step(
		"7. kompozör açıldı",
		await page
			.waitForFunction(
				() => Boolean(document.querySelector('[data-panel="research"] input[aria-label="Note, source, or quote…"]')),
				{ timeout: 8000, polling: 300 },
			)
			.then(() => true)
			.catch(() => false),
	);

	// 8) Wryte düzeni: araç çubuğu üstte tam genişlik satır (sekme satırının üstünde)
	const barInfo = await page.evaluate(() => {
		const slot = document.querySelector("[data-editor-toolbar]");
		const tabs = document.querySelector('[data-panel="draft-tabs"]')?.getBoundingClientRect();
		const bold = [...(slot?.querySelectorAll("button") ?? [])].some((b) => (b.textContent ?? "").trim() === "Split");
		if (!slot || !tabs) return null;
		return { above: slot.getBoundingClientRect().bottom <= tabs.top + 4, bold, width: slot.getBoundingClientRect().width };
	});
	step("8. araç çubuğu sekme satırının üstünde", Boolean(barInfo?.above));
	step("8b. araç çubuğu yuvada (Split burada)", Boolean(barInfo?.bold));

	// 8c) Wryte şapkası: başlık breadcrumb yuvasında, durum kümesi aksiyon
	// yuvasında; içeride dev başlık bloğu yok.
	step(
		"8c. başlık üst barda (breadcrumb yuvası)",
		await page.evaluate(
			() => Boolean(document.querySelector('[data-doc-title-slot] input[placeholder="Title"]')),
		),
	);
	step(
		"8d. durum düğmeleri üst barda",
		await page.evaluate(() => [...document.querySelectorAll("[data-doc-actions-slot] button")].length >= 4),
	);

	// 8e) Araç çubuğu tek satır: yuvadaki tüm düğmeler aynı dikey bantta.
	const singleRow = await page.evaluate(() => {
		const slot = document.querySelector("[data-editor-toolbar]");
		if (!slot) return false;
		const tops = [...slot.querySelectorAll("button")].map((b) => b.getBoundingClientRect().top);
		return tops.length > 5 && Math.max(...tops) - Math.min(...tops) < 8;
	});
	step("8e. araç çubuğu tek satır", singleRow);

	// 8f) Sağ uç sabit: böl ikonları + sütun anahtarları küme kırpılmaz —
	// yuva dışa taşmaz ve ikonlar yuvanın görünür kutusunda kalır.
	const pinnedVisible = await page.evaluate(() => {
		const slot = document.querySelector("[data-editor-toolbar]");
		if (!slot) return false;
		const sr = slot.getBoundingClientRect();
		if (slot.scrollWidth > slot.clientWidth + 1 || slot.scrollHeight > slot.clientHeight + 1) return false;
		const picks = [...slot.querySelectorAll("[data-split-pane], [data-panel-toggle]")].filter(
			(b) => b.getAttribute("data-panel-toggle") !== "meta",
		);
		if (picks.length < 3) return false;
		const tops = picks.map((b) => b.getBoundingClientRect().top);
		if (!tops.length || Math.max(...tops) - Math.min(...tops) >= 8) return false;
		return picks.every((b) => {
			const r = b.getBoundingClientRect();
			return r.width > 0 && r.x >= sr.x && r.x + r.width <= sr.x + sr.width + 1;
		});
	});
	step("8f. sabit sağ uç görünür (kırpılma yok)", pinnedVisible);

	// 8g) Odak modu: katmanda tam genişlik çubuk, sağ uç görünür, panel
	// anahtarları gizli; çıkışta çubuk üst şerit yuvasına döner.
	await page.click('[title^="Focus mode"]').catch(() => undefined);
	await sleep(1200);
	const fz = await page.evaluate(() => {
		const tb = document.querySelector(".mdx-focus-mode .mdxeditor-toolbar");
		if (!tb) return { found: false };
		const r = tb.getBoundingClientRect();
		const exit = [...tb.querySelectorAll("button")].find((b) =>
			(b.textContent ?? "").includes("Exit focus"),
		);
		const er = exit?.getBoundingClientRect();
		return {
			found: true,
			full: r.width >= window.innerWidth - 2,
			inside: Boolean(er && er.right <= r.right + 1 && er.left >= r.left - 1),
			toggles: tb.querySelectorAll("[data-panel-toggle]").length,
			exitShown: Boolean(exit),
		};
	});
	step("8g. odak: katmanda çubuk", Boolean(fz.found));
	step("8h. odak: çubuk tam genişlik", Boolean(fz.full));
	step("8i. odak: sağ uç görünür", Boolean(fz.inside && fz.exitShown));
	step("8j. odak: panel anahtarları gizli", fz.toggles === 0, `toggles=${fz.toggles}`);
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll("button")].find((b) =>
			(b.textContent ?? "").includes("Exit focus"),
		);
		btn?.click();
	});
	await sleep(1000);
	const unfocus = await page.evaluate(() => ({
		inSlot: Boolean(document.querySelector("[data-editor-toolbar] [data-toolbar-scroll]")),
		overlay: Boolean(document.querySelector(".mdx-focus-mode")),
	}));
	step("8k. odak: çıkışta çubuk yuvada", unfocus.inSlot && !unfocus.overlay, JSON.stringify(unfocus));

	// 8l) Escape de odaktan çıkarır (düğmeye ek olarak).
	await page.click('[title^="Focus mode"]').catch(() => undefined);
	await sleep(1000);
	await page.keyboard.press("Escape");
	await sleep(900);
	const escBack = await page.evaluate(() => ({
		inSlot: Boolean(document.querySelector("[data-editor-toolbar] [data-toolbar-scroll]")),
		overlay: Boolean(document.querySelector(".mdx-focus-mode")),
	}));
	step("8l. odak: escape ile çıkış", escBack.inSlot && !escBack.overlay, JSON.stringify(escBack));

	// 9) Konsol hijyeni
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("9. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
