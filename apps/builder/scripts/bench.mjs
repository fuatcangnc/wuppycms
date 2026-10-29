// Ölçüm altyapısı (Sveltia `bench/` deseni) — büyük veriyle kullanıcının
// beklediği süreleri ölçer: liste yükleme, editör açılışı, medya ızgarası.
// CI'da KOŞMAZ (makineye bağlı); aynı makinede öncesi/sonrası karşılaştırılır.
//
// Koşum:
//   node scripts/bench.mjs                 # tüm senaryolar, BENCH_RUNS kez
//   node scripts/bench.mjs entries         # tek senaryo
//   node scripts/bench.mjs compare bench-results/baseline
//
// Env: BENCH_RUNS (varsayılan 3), BENCH_ENTRIES (5000), BENCH_ASSETS (300),
//      BENCH_OUT (bench-results/latest), BENCH_PORT (4386)

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const RUNS = Number(process.env.BENCH_RUNS ?? 3);
const ENTRIES = Number(process.env.BENCH_ENTRIES ?? 5000);
const ASSETS = Number(process.env.BENCH_ASSETS ?? 300);
const OUT = fileURLToPath(new URL(`../${process.env.BENCH_OUT ?? "bench-results/latest"}/`, import.meta.url));
const PORT = Number(process.env.BENCH_PORT ?? 4386);
const BASE = `http://localhost:${PORT}`;
const REPO = "fuatcangnc/wuppycms-demo-site";
const SITE = "b17a25ca-a465-473f-ae5f-481a2f9120ba";

// --- kıyaslama modu ---------------------------------------------------------------
const args = process.argv.slice(2);
if (args[0] === "compare") {
	const baselineDir = fileURLToPath(new URL(`../${args[1] ?? "bench-results/baseline"}/`, import.meta.url));
	const latestDir = OUT;
	const scenarios = ["entries", "editor", "media"];
	let slower = 0;
	console.log("senaryo      önce(ms)   sonra(ms)   fark");
	for (const scenario of scenarios) {
		let base = null;
		let next = null;
		try {
			base = JSON.parse(readFileSync(`${baselineDir}${scenario}.json`, "utf8"));
			next = JSON.parse(readFileSync(`${latestDir}${scenario}.json`, "utf8"));
		} catch {
			console.log(`${scenario.padEnd(12)} —           —           (veri yok)`);
			continue;
		}
		const delta = next.median - base.median;
		const pct = base.median > 0 ? (delta / base.median) * 100 : 0;
		// Gürültü eşiği: %10 altı ya da 5ms altı işaretlenmez.
		const noisy = Math.abs(pct) < 10 || Math.abs(delta) < 5;
		const mark = noisy ? "~" : delta > 0 ? "YAVAŞ" : "hızlı";
		if (!noisy && delta > 0) slower += 1;
		console.log(
			`${scenario.padEnd(12)} ${String(base.median).padStart(8)}   ${String(next.median).padStart(9)}   ${delta > 0 ? "+" : ""}${delta}ms (%${pct.toFixed(0)}) ${mark}`,
		);
	}
	process.exit(slower > 0 ? 1 : 0);
}

// --- veri üretimi -----------------------------------------------------------------
function entryFile(index) {
	const n = String(index).padStart(4, "0");
	return `---\ntitle: Bench yazı ${n}\ndescription: Ölçüm için üretilmiş ${n} numaralı içerik.\ndate: 2026-10-15\n---\n\nBu gövde ölçüm verisi için üretildi — ${n}.\n`;
}

// 1×1 geçerli webp; 300 dosya aynı baytları paylaşır (kopya sayısı önemli değil).
const TINY_WEBP = Buffer.from("UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==", "base64");

function seedBenchRepo(mock) {
	const files = {
		".wuppycms/sites.jsonc": `{
  "version": 1,
  "sites": [{ "key": "root", "name": "wuppycms-demo-site", "url": "https://demo.wuppycms.dev", "media": "public", "mediaLink": "relative", "publishing": "immediate" }]
}
`,
		"package.json": `{ "name": "wuppycms-demo-site", "type": "module" }`,
		"README.md": "# Bench\n",
		"src/content.config.ts": `import { defineCollection, z } from "astro:content";

const blog = defineCollection({
	base: "src/content/blog",
	pattern: "**/*.mdx",
	schema: z.object({ title: z.string(), description: z.string().optional(), date: z.date().optional() }),
});

export const collections = { blog };
`,
		"src/content/blog/post-0000.mdx": entryFile(0),
	};
	for (let i = 1; i < ENTRIES; i += 1) {
		files[`src/content/blog/post-${String(i).padStart(4, "0")}.mdx`] = entryFile(i);
	}
	for (let i = 0; i < ASSETS; i += 1) {
		files[`public/test/img-${String(i).padStart(3, "0")}.webp`] = TINY_WEBP;
	}
	mock.seed(
		Object.entries(files).map(([path, content]) => ({ path, content })),
		"chore: bench verisi (via WuppyCMS)",
	);
}

// --- senaryolar -------------------------------------------------------------------
/** Her senaryo: taze sayfa → hazır sinyaline kadar süre. */
const SCENARIOS = {
	async entries(page) {
		const started = Date.now();
		await page.goto(`${BASE}/admin/wuppycms-demo-site/content/blog?site=${SITE}`, {
			waitUntil: "domcontentloaded",
			timeout: 120000,
		});
		// Liste 80 kayıtla sınırlıdır (MAX_ENTRIES) — hazır sinyali ilk kart.
		await page.waitForFunction(() => document.body.innerText.includes("post-0000"), {
			timeout: 120000,
			polling: 100,
		});
		return Date.now() - started;
	},
	async editor(page) {
		const started = Date.now();
		await page.goto(`${BASE}/admin/wuppycms-demo-site/content/blog/post-0000?site=${SITE}`, {
			waitUntil: "domcontentloaded",
			timeout: 120000,
		});
		await page.waitForFunction(
			() => (document.querySelector(".mdx-body-editor")?.textContent ?? "").includes("ölçüm verisi"),
			{ timeout: 120000, polling: 100 },
		);
		return Date.now() - started;
	},
	async media(page) {
		const started = Date.now();
		await page.goto(`${BASE}/admin/wuppycms-demo-site/media/test?site=${SITE}&mediaLibrary=repo_media`, {
			waitUntil: "domcontentloaded",
			timeout: 120000,
		});
		await page.waitForFunction(() => document.body.innerText.includes("img-000.webp"), {
			timeout: 120000,
			polling: 100,
		});
		return Date.now() - started;
	},
};

const only = args[0] && SCENARIOS[args[0]] ? args[0] : null;
const names = only ? [only] : Object.keys(SCENARIOS);

mkdirSync(OUT, { recursive: true });

const env = await startMockEnv({
	appDir: fileURLToPath(new URL("..", import.meta.url)),
	port: PORT,
	fullName: REPO,
	branch: "main",
	logFile: "/tmp/opencode/bench-dev.log",
});
seedBenchRepo(env.mock);

const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
	// Oturum bir kez açılır; her koşu taze sayfa (bellek/uygulama durumu sıfır).
	const warm = await browser.newPage();
	await installRawImageProxy(warm, env.mock);
	await login(warm, BASE);
	await warm.close();

	for (const name of names) {
		const runs = [];
		for (let i = 0; i < RUNS; i += 1) {
			const page = await browser.newPage();
			await page.setViewport({ width: 1440, height: 900 });
			await installRawImageProxy(page, env.mock);
			await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60000 });
			// Oturum çerezi tarayıcı bağlamında paylaşılır; login sayfası anında /projects'e döner.
			await sleep(300);
			try {
				runs.push(await SCENARIOS[name](page));
			} catch (error) {
				console.error(`${name} koşu ${i + 1} başarısız:`, error instanceof Error ? error.message : error);
			}
			await page.close();
		}
		if (runs.length === 0) continue;
		const sorted = [...runs].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		writeFileSync(
			`${OUT}${name}.json`,
			`${JSON.stringify({ scenario: name, entries: ENTRIES, assets: ASSETS, runs, median }, null, 2)}\n`,
		);
		console.log(`${name.padEnd(10)} koşular: ${runs.join(", ")} ms · medyan: ${median} ms`);
	}
} finally {
	await browser.close();
	await env.stop();
}
