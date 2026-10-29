/**
 * Playwright global teardown — EmDash'teki gibi sunucuyu durdurur ve geçici
 * durumu temizler; kanıtı (`.e2e/report`, trace'ler) SİLMEZ.
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT_DIR = resolve(ROOT, ".e2e");
const SERVER_INFO_PATH = resolve(OUT_DIR, "server-info.json");

export default async function globalTeardown(): Promise<void> {
	// global-setup ile aynı süreçte koşuyorsa ortamı düzgün kapat.
	try {
		const mod = (await import("./global-setup.js")) as {
			getStopEnv?: () => (() => Promise<void>) | null;
		};
		const stop = mod.getStopEnv?.();
		if (stop) await stop();
	} catch {
		// Farklı süreçte koşulduysa aşağıdaki dosya tabanlı temizlik yeterli.
	}

	// Dev sunucusu hâlâ ayaktaysa Astro'nun kendi durum dosyasıyla kapat.
	try {
		const { execSync } = await import("node:child_process");
		execSync("pnpm exec astro dev stop", { cwd: resolve(ROOT, "apps/builder"), stdio: "ignore", timeout: 15_000 });
	} catch {
		// sunucu zaten kapalı
	}

	// Sunucu bilgisi koşular arasında taşınmasın.
	if (existsSync(SERVER_INFO_PATH)) rmSync(SERVER_INFO_PATH, { force: true });

	// Oturum çerezi kalıcı olmasın.
	const statePath = resolve(OUT_DIR, "storage-state.json");
	if (existsSync(statePath)) rmSync(statePath, { force: true });

	console.log("[pw] sunucu durduruldu, geçici oturum temizlendi");
}
