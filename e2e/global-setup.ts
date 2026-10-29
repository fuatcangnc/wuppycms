/**
 * Playwright global setup — EmDash'in `e2e/global-setup.ts` mantığının
 * WuppyCMS'ye uyarlaması.
 *
 * 1. İzole ortamı kur: sahte GitHub + kendi dev sunucusu (port 4444).
 *    Mevcut `scripts/lib/e2e-env.mjs` yeniden kullanılır — .dev.vars geçici
 *    olarak çevrilir, mock GitHub bellek-içinde çalışır, iş bitince geri alınır.
 * 2. Oturum aç: better-auth e-posta/şifre ile `dev@wuppycms.local`; çerezler
 *    `.e2e/storage-state.json`a yazılır (Playwright `use.storageState`).
 * 3. Projeyi bağla: sahte depo (`mock/site`) D1'de proje satırı olur.
 * 4. Admin'i ısıt: Vite/workerd soğuk derlemesi ilk testin içine düşmesin.
 * 5. `.e2e/server-info.json`: testlerin okuduğu ortam bilgisi.
 *
 * EmDash'ten fark: içerik GitHub deposunda yaşadığı için DB izolasyonu yerine
 * kimlik izolasyonu kullanılır — sabit harness kullanıcısı + idempotent proje.
 */

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// @ts-expect-error — .mjs yardımcısı; Playwright TS'i kendi derler.
import { seedSite, startMockEnv } from "../apps/builder/scripts/lib/e2e-env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const APP_DIR = resolve(ROOT, "apps/builder");
const OUT_DIR = resolve(ROOT, ".e2e");
const PORT = 4444;
const BASE = `http://localhost:${PORT}`;
const REPO = "mock/site";
const USER = { email: "dev@wuppycms.local", password: "dev-password-123", name: "Dev" };

export const SERVER_INFO_PATH = resolve(OUT_DIR, "server-info.json");
export const STORAGE_STATE_PATH = resolve(OUT_DIR, "storage-state.json");

interface ServerInfo {
	baseUrl: string;
	repoFullName: string;
	projectId: string;
	mockToken: string;
	mockApiPort: number;
}

/** Aynı süreçteki teardown için tutulur. */
let stopEnv: (() => Promise<void>) | null = null;

function log(message: string): void {
	console.log(`[pw] ${message}`);
}

/** Local D1 şeması hazır olsun (idempotent). */
function ensureMigrations(): void {
	try {
		execSync("pnpm exec wrangler d1 migrations apply wuppycms --local", {
			cwd: APP_DIR,
			stdio: "pipe",
			timeout: 120_000,
		});
	} catch (error) {
		log(`UYARI: D1 migration uygulanamadı (${(error as Error).message.split("\n")[0]})`);
	}
}

interface Session {
	/** `better-auth.session_token=…` — fetch istekleri için. */
	cookieHeader: string;
}

/** better-auth oturumu açar; çerezleri Playwright storageState'e yazar. */
async function signIn(): Promise<Session> {
	// better-auth CSRF: origin/referer baseURL ile eşleşmeli.
	const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: BASE,
			referer: `${BASE}/login`,
		},
		body: JSON.stringify({ email: USER.email, password: USER.password }),
	});
	if (!res.ok) {
		throw new Error(`Giriş başarısız (${res.status}): ${(await res.text()).slice(0, 300)}`);
	}

	const pairs = (res.headers.getSetCookie?.() ?? [])
		.map((line) => line.split(";")[0] ?? "")
		.filter((pair) => pair.includes("="));

	if (!pairs.length) throw new Error("Giriş yanıtı oturum çerezi döndürmedi.");

	const cookies = pairs.map((pair) => {
		const index = pair.indexOf("=");
		return {
			name: pair.slice(0, index),
			value: pair.slice(index + 1),
			domain: "localhost",
			path: "/",
			httpOnly: true,
			secure: false,
			sameSite: "Lax" as const,
			expires: -1,
		};
	});

	writeFileSync(STORAGE_STATE_PATH, JSON.stringify({ cookies, origins: [] }, null, 2));
	log(`oturum kaydedildi: ${cookies.map((cookie) => cookie.name).join(", ")}`);
	return { cookieHeader: pairs.join("; ") };
}

/** BYO AI'yı mock sağlayıcıya bağla: üretim ve ajan koşusu ağsız sınanır. */
async function configureAi(session: Session, mockPort: number): Promise<void> {
	const res = await fetch(`${BASE}/api/ai/settings`, {
		method: "PUT",
		headers: {
			"content-type": "application/json",
			origin: BASE,
			cookie: session.cookieHeader,
		},
		body: JSON.stringify({
			provider: "openai",
			baseUrl: `http://127.0.0.1:${mockPort}/v1`,
			model: "mock-model",
			apiKey: "test-key",
		}),
	});
	if (!res.ok) {
		throw new Error(`AI ayarı yazılamadı (${res.status}): ${(await res.text()).slice(0, 300)}`);
	}
	log(`BYO AI mock sağlayıcıya bağlandı (port ${mockPort})`);
}

async function ensureProject(session: Session): Promise<string> {
	const res = await fetch(`${BASE}/api/projects`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			origin: BASE,
			cookie: session.cookieHeader,
		},
		body: JSON.stringify({ full_name: REPO }),
	});
	if (!res.ok) {
		throw new Error(`Proje bağlanamadı (${res.status}): ${(await res.text()).slice(0, 300)}`);
	}
	const data = (await res.json()) as { id: string };
	return data.id;
}

/**
 * Admin adasının istemci bağımlılıkları ilk tarayıcı isteğinde keşfedilir;
 * Vite yeniden optimize edip sayfayı yeniler. İki yükleme bunu testlerden
 * önce bitirir (EmDash'teki warmUpAdmin ile aynı gerekçe).
 */
async function warmUpAdmin(): Promise<void> {
	const { chromium } = await import("@playwright/test");
	const browser = await chromium.launch({
		executablePath: process.env.WUPPYCMS_CHROMIUM ?? "/usr/bin/chromium",
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});
	try {
		const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
		const page = await context.newPage();
		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				await page.goto(`${BASE}/admin`, { waitUntil: "commit", timeout: 120_000 });
				await page.waitForSelector("#sidebar", { timeout: 120_000 });
				await page.waitForLoadState("networkidle", { timeout: 60_000 });
			} catch (error) {
				log(`admin ısınma ${attempt + 1} başarısız (kritik değil): ${(error as Error).message}`);
			}
		}
	} finally {
		await browser.close();
	}
}

export default async function globalSetup(): Promise<void> {
	mkdirSync(resolve(OUT_DIR, "logs"), { recursive: true });

	ensureMigrations();

	log("mock GitHub + dev sunucusu başlatılıyor (port 4444)…");
	const env = await startMockEnv({
		appDir: APP_DIR,
		port: PORT,
		fullName: REPO,
		branch: "main",
		token: "mock-token",
		logFile: resolve(OUT_DIR, "logs/app.log"),
		skipConflictCheck: true,
		githubApp: true,
	});
	stopEnv = env.stop;

	try {
		seedSite(env.mock);
		log("sahte depo tohumlandı (.wuppycms/sites.jsonc + blog)");

		const session = await signIn();
		const projectId = await ensureProject(session);
		log(`proje bağlandı: ${REPO} (${projectId})`);
		await configureAi(session, env.mockPort);

		await warmUpAdmin();
		log("admin ısındı");

		const info: ServerInfo = {
			baseUrl: BASE,
			repoFullName: REPO,
			projectId,
			mockToken: "mock-token",
			mockApiPort: env.mockPort,
		};
		writeFileSync(SERVER_INFO_PATH, JSON.stringify(info, null, 2));
		log(`hazır: ${BASE}`);
	} catch (error) {
		await stopEnv?.();
		stopEnv = null;
		throw error;
	}
}

/** Teardown aynı süreçte koşarsa ortamı buradan kapatır. */
export function getStopEnv(): (() => Promise<void>) | null {
	return stopEnv;
}
