// Ortak E2E mock ortamı — sahte GitHub sunucusu + kendi dev sunucusu +
// .dev.vars yönetimi + raw görsel isteklerinin mock'tan servis edilmesi.
// Medyaya özel DEĞİL: her tarayıcı harness'i (nav, medya, ileride editör/
// içerik testleri) bunu kullanır. Sözleşme: docs/e2e-conventions.md.
//
// Kullanım:
//   const env = await startMockEnv({ appDir, port: 4398 });
//   env.mock.seed([...]);            // repo içeriği harness'e özel
//   installRawImageProxy(page, env.mock);
//   ... testler (BASE = env.base) ...
//   await env.stop();                // dev'i kapatır, .dev.vars'ı geri yükler

import { execSync, spawn } from "node:child_process";
import { existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createMockGitHub } from "./mock-github.mjs";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Ortak giriş — Vite'ın ilk açılışta bağımlılığı paketleyip sayfayı
 * yenilemesi (ve benzeri navigasyonlar) giriş akışını ortada kesebilir;
 * bu yüzden denemeli yazılır.
 *
 * Ürünün açılış dili İngilizce; eski suitler Türkçe arayüzü test etsin diye
 * dil varsayılan olarak "tr"ye sabitlenir (İngilizce akışı e2e-editor-layout
 * doğrular). locale="en" ile sabitlemeyi İngilizceye çevirebilirsin.
 */
export async function login(page, base, locale = "tr") {
	if (locale) {
		await page.evaluateOnNewDocument((loc) => {
			try {
				localStorage.setItem("wuppycms:locale", loc);
			} catch {
				/* storage yoksa varsayılan dille devam */
			}
		}, locale);
	}
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			await page.goto(`${base}/login`, { waitUntil: "networkidle2", timeout: 60000 });
			await page.waitForSelector('input[type="email"]', { timeout: 15000 });
			await page.type('input[type="email"]', "dev@wuppycms.local");
			await page.type('input[type="password"]', "dev-password-123");
			await page.click('button[type="submit"]');
			await page.waitForFunction(() => !location.pathname.startsWith("/login"), { timeout: 30000 });
			return true;
		} catch {
			await sleep(1500);
		}
	}
	return false;
}

/** :4321'de sunucu varsa dur (kendi dev sunucumuzu yönetiyoruz). */
export async function ensureNoDevServerConflict() {
	try {
		const r = await fetch("http://localhost:4321/api/health", { signal: AbortSignal.timeout(2000) });
		if (r.ok) {
			console.error(
				"Mock mod kendi dev sunucusunu başlatır; önce `astro dev stop` ile :4321'i kapatın " +
					"(ya da --real ile gerçek GitHub akışını kullanın).",
			);
			process.exit(2);
		}
	} catch {
		/* kapalı — beklenen */
	}
}

/**
 * login() kimliği (dev@wuppycms.local) yoksa API ile oluşturur; varsa no-op.
 * .wrangler yerel durumu sıfırdan doğduğunda (yeni database_id, yeni makine)
 * suitlerin "Invalid email or password" ile çökmesini engeller.
 */
async function ensureHarnessUser(base) {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		try {
			const res = await fetch(`${base}/api/auth/sign-up/email`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					// better-auth CSRF: origin/referer, baseURL ile eşleşmek zorunda.
					origin: base,
					referer: `${base}/login`,
				},
				body: JSON.stringify({ email: "dev@wuppycms.local", password: "dev-password-123", name: "Dev" }),
			});
			if (res.status < 500) {
				if (res.status >= 400 && res.status !== 422) console.error("UYARI: harness kullanıcı adımı:", res.status, (await res.text()).slice(0, 140));
				return; // 201 kayıt oldu; 422 "zaten var" → login() yeter
			}
		} catch {
			/* workerd henüz tam ısınmadı — tekrar dene */
		}
		await sleep(500);
	}
	console.error("UYARI: harness kullanıcısı doğrulanamadı — login() başarısız olabilir");
}

/**
 * Sahte GitHub'ı ayağa kaldırır, .dev.vars'ı geçici çevirir, dev sunucusunu
 * `port`ta başlatır ve sağlık yanıtını bekler.
 * @returns {{ mock: object, base: string, port: number, stop: () => Promise<void> }}
 */
export async function startMockEnv({
	appDir,
	port = 4399,
	fullName,
	branch = "main",
	token = "mock-token",
	logFile = "/tmp/opencode/e2e-mock-dev.log",
	// Playwright harness'i kendi portunu (4444) açıkça kullanır; 4321'deki
	// başka bir sunucu bu koşumu etkilemez. Eski .mjs suitleri varsayılanı korur.
	skipConflictCheck = false,
	// GitHub App yapılandırılmış gibi davran (sahte kimlik): Projects ekranı
	// "App'i kur" kartını gösterir; kurulum kaydı olmadığı için token çağrısı
	// yapılmaz. Gerçek anahtar gerekmez.
	githubApp = false,
}) {
	if (!skipConflictCheck) await ensureNoDevServerConflict();

	// Önceki koşudan kalmış bir sunucu (aynı proje) varsa kapat — bu ortam
	// kendi sunucusunu yönetir; "already running" yüzünden sessizce eski
	// sunucuya bağlanmak istemiyoruz.
	try {
		execSync("pnpm exec astro dev stop", { cwd: appDir, stdio: "ignore", timeout: 15_000 });
	} catch {
		/* çalışan sunucu yoksa sorun değil */
	}

	const mock = createMockGitHub({ fullName, branch, token });
	const apiPort = await mock.listen(0);
	const base = `http://localhost:${port}`;

	const devVarsPath = `${appDir}/.dev.vars`;
	// Yedek diske yazılır: süreç SIGTERM ile öldürülse bile sonraki koşum
	// kalan .bak'ı geri yükler (mock satırlar .dev.vars'ta donup kalmasın).
	const bakPath = `${devVarsPath}.bak`;
	if (existsSync(bakPath)) {
		writeFileSync(devVarsPath, readFileSync(bakPath, "utf8"));
	}
	const backup = readFileSync(devVarsPath, "utf8");
	writeFileSync(bakPath, backup);
	const lines = backup
		.split("\n")
		.filter((l) => !/^\s*(GITHUB_TOKEN|GITHUB_API_BASE|BETTER_AUTH_URL|GITHUB_APP_)\s*=/.test(l));
	lines.push(
		`GITHUB_TOKEN="${token}"`,
		`GITHUB_API_BASE="http://127.0.0.1:${apiPort}"`,
		// better-auth kök adresi kendi portumuz olmalı; yoksa origin kontrolü 403 verir.
		`BETTER_AUTH_URL="${base}"`,
	);
	if (githubApp) {
		// Yalnızca "yapılandırıldı" bayrağını açar; kurulum yoksa private key
		// hiç okunmaz (token çağrısı kurulum varsa yapılır).
		lines.push(
			`GITHUB_APP_ID="1"`,
			`GITHUB_APP_PRIVATE_KEY_B64="${Buffer.from("e2e-placeholder").toString("base64")}"`,
			`GITHUB_APP_SLUG="wuppycms"`,
			`GITHUB_APP_WEBHOOK_SECRET="e2e-webhook-secret"`,
		);
	}
	writeFileSync(devVarsPath, lines.join("\n"));

	let child = null;
	let restored = false;
	const restore = () => {
		if (!restored) {
			writeFileSync(devVarsPath, backup);
			try {
				unlinkSync(bakPath);
			} catch {
				/* yedek zaten silinmiş */
			}
			restored = true;
		}
	};
	process.on("SIGINT", () => {
		restore();
		process.exit(130);
	});
	process.on("exit", restore);

	try {
		const logFd = openSync(logFile, "w");
		child = spawn("pnpm", ["exec", "astro", "dev", "--port", String(port)], {
			cwd: appDir,
			stdio: ["ignore", logFd, logFd],
			detached: true, // süreç grubu: workerd/vite torunları da birlikte ölsün
		});
	} catch {
		/* spawn hatası sağlık beklemesinde ortaya çıkar */
	}

	const until = Date.now() + 90_000;
	while (Date.now() < until) {
		try {
			const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
			if (r.ok) {
				// Harness kimliği kendini iyileştirir: taze .wrangler durumu
				// (database_id yeniden doğuşu, yeni makine) suitleri kırmamalı.
				await ensureHarnessUser(base);
				return {
					mock,
					base,
					port,
					/** Sahte sunucunun kendi portu — ör. AI baseUrl buraya çevrilir. */
					mockPort: apiPort,
					stop: async () => {
						// astro dev sunucuyu kendi durum dosyasıyla yönetir; önce onunla kapat
						// (daemonize edilmiş olabiliyor — süreç grubunu öldürmek yetmez).
						try {
							execSync("pnpm exec astro dev stop", { cwd: appDir, stdio: "ignore", timeout: 15_000 });
						} catch {
							/* durum dosyası yoksa sorun değil */
						}
						if (child) {
							try {
								process.kill(-child.pid, "SIGTERM");
							} catch {
								try {
									child.kill("SIGTERM");
								} catch {
									/* zaten ölmüş */
								}
							}
							child = null;
						}
						restore();
						await mock.close();
					},
				};
			}
		} catch {
			/* henüz açılmadı */
		}
		await sleep(1000);
	}
	restore();
	await mock.close();
	throw new Error(`mock dev sunucusu açılmadı — günlük: ${logFile}`);
}

const RAW_MIME = {
	webp: "image/webp",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	svg: "image/svg+xml",
	avif: "image/avif",
};

/**
 * Depo önizlemeleri raw.githubusercontent'tan gelir (media-core); isteği kesip
 * baytları mock deposundan servis ederiz — ağsız kalır, ACAO ile canvas/kırpma da çalışır.
 */
export function installRawImageProxy(page, mock) {
	return page.setRequestInterception(true).then(() => {
		page.on("request", (request) => {
			const match = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/([^?]+)/.exec(request.url());
			if (!match) return void request.continue();
			const path = decodeURIComponent(match[1]);
			const buf = mock.readFile(path);
			if (!buf) return void request.respond({ status: 404, contentType: "text/plain", body: "not found" });
			const ext = (path.split(".").pop() ?? "").toLowerCase();
			request.respond({
				status: 200,
				contentType: RAW_MIME[ext] ?? "application/octet-stream",
				headers: { "access-control-allow-origin": "*" },
				body: buf,
			});
		});
	});
}

/** Her harness'in paylaştığı asgari site iskeleti (mock repo içeriği). */
export function baseSiteFiles() {
	return {
		".wuppycms/sites.jsonc": `{
  // WuppyCMS site kaydı (E2E mock deposu)
  "version": 1,
  "sites": [
    {
      "key": "root",
      "name": "wuppycms-demo-site",
      "url": "https://demo.wuppycms.dev",
      "media": "public",
      "mediaLink": "relative",
      "publishing": "immediate"
    }
  ]
}
`,
		"package.json": `{
  "name": "wuppycms-demo-site",
  "type": "module",
  "dependencies": { "astro": "^5.0.0" }
}
`,
		"README.md": "# WuppyCMS demo sitesi (E2E mock)\n\nBu depo tarayıcı testleri için bellek-içi sahte GitHub sunucusunda yaşar.\n",
		"src/content.config.ts": `import { defineCollection, z } from "astro:content";

const blog = defineCollection({
	base: "src/content/blog",
	pattern: "**/*.mdx",
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		date: z.date().optional(),
	}),
});

export const collections = { blog };
`,
		"src/content/blog/merhaba-dunya.mdx": `---
title: Merhaba dünya
description: WuppyCMS demo yazısı — E2E mock deposunda yaşar.
---

Bu ilk yazı, editör medya seçicisinin (picker) test edildiği dokümandır.
`,
		"src/pages/index.astro": `---
const title = "WuppyCMS demo";
---
<html>
	<head><title>{title}</title></head>
	<body><h1>{title}</h1></body>
</html>
`,
		"src/pages/about.md": `---
title: About
---
# About

Static Markdown page.
`,
		"src/pages/blog/[...slug].astro": `---
const { slug } = Astro.params;
---
<h1>{slug}</h1>
`,
		"public/test/.gitkeep": Buffer.from(""),
	};
}

/** Ortak iskelet + ek dosyalarla mock deposunu tek commit'te kurar. */
export function seedSite(mock, extraFiles = {}, message = "chore: e2e mock deposu kuruldu (via WuppyCMS)") {
	const files = { ...baseSiteFiles(), ...extraFiles };
	return mock.seed(
		Object.entries(files).map(([path, content]) => ({ path, content })),
		message,
	);
}

/** Metni tam eşleşen bir düğmeyi bekler ve tıklar (ör. "Paneli göster", "Kaynak").
 *  Label dizisi verilirse herhangi biri eşleşir (dil bağımsız seçimler için).
 *  Idempotent olmayan (toggle) düğmelerde çağıran taraf dikkatli olmalı. */
export async function clickButtonByText(page, label, timeout = 20000) {
	const labels = Array.isArray(label) ? label : [label];
	// Eşleşme: düğme metni ya da title/aria-label (Wryte araç çubuğunun ikon
	// anahtarları metinsizdir; etiketleri title/aria'da yaşar).
	const finder = `(texts) => {
		const has = (b, ts) =>
			ts.includes((b.textContent ?? "").trim()) ||
			ts.includes((b.getAttribute("title") ?? "").trim()) ||
			ts.includes((b.getAttribute("aria-label") ?? "").trim());
			return [...document.querySelectorAll("button")].some((b) => has(b, texts));
	}`;
	await page
		.waitForFunction(new Function("return " + finder)(), { timeout, polling: 300 }, labels)
		.catch(() => undefined);
	return page.evaluate((texts) => {
		const has = (b, ts) =>
			ts.includes((b.textContent ?? "").trim()) ||
			ts.includes((b.getAttribute("title") ?? "").trim()) ||
			ts.includes((b.getAttribute("aria-label") ?? "").trim());
		const btn = [...document.querySelectorAll("button")].find((b) => has(b, texts));
		if (btn) btn.click();
		return Boolean(btn);
	}, labels);
}

/** Böl modunun sağ bölmesini ham Markdown kaynağına çevirir. TR/EN etiket ikisi
 *  de denenir; dil sabitlemesi olmayan suitler İngilizce varsayılanla çalışır. */
export const openSourcePane = (page, timeout = 15000) => clickButtonByText(page, ["Kaynak", "Source"], timeout);
