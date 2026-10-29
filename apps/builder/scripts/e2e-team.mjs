// Parity 2b dumanı: ekip davetleri — sahip davet üretir (bağlantı), ikinci
// hesap kabul eder, paylaşılan proje listelenir, sahip çıkarınca erişim biter.
// Koşum: node scripts/e2e-team.mjs [--real]
//   (varsayılan) mock: ağsız — sahte GitHub + kendi dev sunucusu (:4388).

import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { installRawImageProxy, login, seedSite, sleep, startMockEnv } from "./lib/e2e-env.mjs";

const MOCK = !process.argv.includes("--real");
const PORT = MOCK ? 4388 : 4321;
const BASE = `http://localhost:${PORT}`;
const REPO = "fuatcangnc/wuppycms-demo-site";
const MEMBER_EMAIL = "dev2@wuppycms.local";
const MEMBER_PASSWORD = "dev-password-123";

const results = [];
const step = (name, cond, extra = "") => {
	results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
	if (!cond) process.exitCode = 1;
};

let env = null;
if (MOCK) {
	env = await startMockEnv({
		appDir: fileURLToPath(new URL("..", import.meta.url)),
		port: PORT,
		fullName: REPO,
		branch: "main",
		logFile: "/tmp/opencode/e2e-team-dev.log",
	});
	seedSite(env.mock);
}

const browser = await puppeteer.launch({
	executablePath: "/usr/bin/chromium",
	headless: "new",
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
	// --- Bağlam A: sahip ---
	const owner = await browser.newPage();
	await owner.setViewport({ width: 1600, height: 1000 });
	if (MOCK && env) await installRawImageProxy(owner, env.mock);
	owner.on("dialog", (d) => void d.accept());
	const consoleErrors = [];
	owner.on("pageerror", (e) => consoleErrors.push(String(e)));
	owner.on("console", (m) => {
		if (m.type() === "error") consoleErrors.push(m.text());
	});

	const clickExact = (page, text) =>
		page.evaluate((t) => {
			const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent ?? "").trim() === t);
			if (btn) btn.click();
			return Boolean(btn);
		}, text);

	step("0. sahip girişi", await login(owner, BASE));
	await owner.goto(`${BASE}/admin`, { waitUntil: "networkidle2", timeout: 60000 });
	await owner
		.waitForFunction(() => document.body.innerText.includes("Site ayarları"), { timeout: 30000, polling: 400 })
		.catch(() => undefined);

	// 0b) Önceki koşulardan kalan bekleyen davetleri iptal et (deterministik).
	await owner.evaluate(
		async (repo) => {
			const projects = await fetch("/api/projects", { credentials: "same-origin" }).then((r) => r.json());
			const project = projects?.projects?.find((p) => p.repo_full_name === repo);
			if (!project) return;
			const team = await fetch(`/api/team/members?project_id=${project.id}`, {
				credentials: "same-origin",
			}).then((r) => r.json());
			for (const invitation of team?.invitations ?? []) {
				await fetch("/api/team/invitations", {
					method: "DELETE",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ project_id: project.id, invitation_id: invitation.id }),
				});
			}
		},
		REPO,
	);

	// 1) Site ayarları → Üyeler → davet üret
	await clickExact(owner, "Site ayarları");
	await owner
		.waitForSelector('input[aria-label="Davet e-postası"]', { timeout: 15000 })
		.catch(() => undefined);
	step("1. üyeler bölümü açıldı", await owner.evaluate(() => Boolean(document.querySelector('input[aria-label="Davet e-postası"]'))));
	await owner.evaluate((email) => {
		const input = document.querySelector('input[aria-label="Davet e-postası"]');
		const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
		set.call(input, email);
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}, MEMBER_EMAIL);
	await clickExact(owner, "Davet et");
	await owner
		.waitForFunction(() => document.body.innerText.includes("kopyalandı"), { timeout: 15000, polling: 300 })
		.catch(() => undefined);
	step("1b. davet bağlantısı üretildi", await owner.evaluate(() => document.body.innerText.includes("kopyalandı")));
	await owner
		.waitForFunction((email) => document.body.innerText.includes(email), { timeout: 10000, polling: 300 }, MEMBER_EMAIL)
		.catch(() => undefined);
	step("1c. bekleyen davet listelendi", await owner.evaluate((email) => document.body.innerText.includes(email), MEMBER_EMAIL));
	const inviteToken = await owner.evaluate(() => {
		const match = document.body.innerText.match(/invite\?token=([0-9a-f-]{36})/i);
		return match?.[1] ?? "";
	});
	step("1d. token okundu", Boolean(inviteToken), inviteToken.slice(0, 8));

	// --- Bağlam B: davet edilen üye (ayrı tarayıcı bağlamı = ayrı oturum) ---
	const context = await browser.createBrowserContext();
	const member = await context.newPage();
	await member.setViewport({ width: 1440, height: 900 });
	if (MOCK && env) await installRawImageProxy(member, env.mock);
	member.on("dialog", (d) => void d.accept());
	await member.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 60000 });
	const auth = await member.evaluate(
		async ([email, password]) => {
			const post = (path, body) =>
				fetch(path, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify(body),
				}).then((r) => r.status);
			// Koşular arası kalıcı yerel D1: kayıt varsa giriş yap (idempotent).
			const signup = await post("/api/auth/sign-up/email", { email, password, name: "Dev2" });
			if (signup === 200 || signup === 201) return { via: "kayıt", status: signup };
			const signin = await post("/api/auth/sign-in/email", { email, password });
			return { via: "giriş", status: signin };
		},
		[MEMBER_EMAIL, MEMBER_PASSWORD],
	);
	step("2. üye oturumu", auth.status === 200 || auth.status === 201, `${auth.via} HTTP ${auth.status}`);

	// 3) Davet sayfası → kabul → projeler listesinde paylaşılan proje
	await member.goto(`${BASE}/invite?token=${inviteToken}`, { waitUntil: "networkidle2", timeout: 60000 });
	await member
		.waitForSelector("#accept", { timeout: 15000 })
		.catch(() => undefined);
	await member.evaluate(() => document.getElementById("accept")?.classList.remove("hidden"));
	await clickExact(member, "Accept invitation");
	await member
		.waitForFunction(
			() => document.body.innerText.includes("Projeye eklendiniz") || location.pathname === "/projects",
			{ timeout: 15000, polling: 300 },
		)
		.catch(() => undefined);
	step(
		"3. davet kabul edildi",
		await member.evaluate(() => document.body.innerText.includes("Projeye eklendiniz") || location.pathname === "/projects"),
	);
	const memberProjects = await member.evaluate(() =>
		fetch("/api/projects", { credentials: "same-origin" }).then((r) => r.json()),
	);
	const shared = memberProjects?.projects?.find((p) => p.repo_full_name === REPO);
	step("3b. paylaşılan proje listede", Boolean(shared), shared?.role ?? "yok");
	step("3c. rol düzenleyici", shared?.role === "editor");

	// 4) Sahip tarafında üye görünür → çıkar → erişim biter
	await clickExact(owner, "Vazgeç");
	await sleep(400);
	await clickExact(owner, "Site ayarları");
	await owner
		.waitForFunction((email) => document.body.innerText.includes(email), { timeout: 15000, polling: 300 }, MEMBER_EMAIL)
		.catch(() => undefined);
	step("4. üye sahip listesinde", await owner.evaluate((email) => document.body.innerText.includes(email), MEMBER_EMAIL));
	await clickExact(owner, "çıkar");
	await owner
		.waitForFunction(
			() => ![...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "çıkar"),
			{ timeout: 15000, polling: 400 },
		)
		.catch(() => undefined);
	step(
		"4b. üye çıkarıldı",
		await owner.evaluate(
			() => ![...document.querySelectorAll("button")].some((b) => (b.textContent ?? "").trim() === "çıkar"),
		),
	);
	await sleep(600);
	const afterRemoval = await member.evaluate(() =>
		fetch("/api/projects", { credentials: "same-origin" }).then((r) => r.json()),
	);
	step("4c. üyenin erişimi bitti", !afterRemoval?.projects?.some((p) => p.repo_full_name === REPO));

	// 5) Konsol hijyeni (sahip bağlamı)
	const noise = /favicon|ResizeObserver|WebSocket|DevTools|404 \(Not Found\)|net::ERR_ABORTED|Failed to load resource/i;
	const real = consoleErrors.filter((e) => !noise.test(e));
	step("5. konsol hatasız", real.length === 0, real.slice(0, 2).join(" | "));
} finally {
	await browser.close();
	if (env) await env.stop();
}

console.log(results.join("\n"));
const fails = results.filter((r) => r.startsWith("FAIL")).length;
console.log(`\n${results.length - fails}/${results.length} geçti`);
