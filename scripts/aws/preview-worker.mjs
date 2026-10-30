#!/usr/bin/env node
// WuppyCMS canlı önizleme servisi — VM'de çalışır (systemd: wuppycms-preview).
//
// Neden: üretim yayını Astro build + S3 sync ile ~2 dakika sürüyor. Editörde
// "direkt yansıma" için her aktif site adına bir `astro dev` sunucusu açarız;
// AI yazımından sonra `git pull` + iframe yenileme ile değişiklik 1–2 saniyede
// görünür. Üretim yayını arka planda devam eder.
//
// Tasarım:
//   POST /open    { slug, repo, branch, token }  → { ok, port, ready }
//   POST /refresh { slug, token, branch }        → git pull (dev sunucusu izler)
//   GET  /status?slug=…                          → { running, port, ready }
//   POST /close   { slug }
//   GET  /health
//
// Güvenlik: yalnız 127.0.0.1 dinler, `x-preview-secret` ister, token diske
// yazılmaz (remote URL'de tutulur ve her pull'da tazelenir).
// Kaynak: dev sunucu `--base /preview/<slug>/` ile açılır; proxy yolu aynen
// iletir, böylece Vite'ın mutlak yolları bozulmaz.

import { createServer } from "node:http";
import { execFile, spawn } from "node:child_process";
import { mkdir, open as openFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const PORT = Number(process.env.PREVIEW_PORT ?? 8791);
const SECRET = process.env.PREVIEW_SECRET ?? "";
const ROOT = process.env.PREVIEW_ROOT ?? "/var/lib/wuppycms/preview";
const IDLE_MS = Number(process.env.PREVIEW_IDLE_MS ?? 20 * 60_000);
const MAX = Math.max(1, Number(process.env.PREVIEW_MAX ?? 1));
const BASE_PORT = Number(process.env.PREVIEW_DEV_PORT ?? 8800);
const READY_TIMEOUT = Number(process.env.PREVIEW_READY_TIMEOUT_MS ?? 120_000);

/** slug → { slug, repo, branch, dir, port, proc, log, ready, lastUsed, opening } */
const sessions = new Map();
let nextPort = BASE_PORT;

const log = (...args) => console.log(new Date().toISOString(), ...args);

async function ensureDir(path) {
	await mkdir(path, { recursive: true });
}

/** Port boş mu? (önceki oturumdan kalan süreçler çakışmasın) */
async function portFree(port) {
	return new Promise((resolve) => {
		const probe = createServer();
		probe.once("error", () => resolve(false));
		probe.once("listening", () => probe.close(() => resolve(true)));
		probe.listen(port, "127.0.0.1");
	});
}

function remoteUrl(repo, token) {
	// Token yalnız süreç belleğinde; URL geçici.
	return `https://x-access-token:${token}@github.com/${repo}.git`;
}

async function checkout(session, token, repo, branch) {
	const dir = session.dir;
	const hasGit = await run("git", ["-C", dir, "rev-parse", "--git-dir"]).then(
		() => true,
		() => false,
	);
	if (!hasGit) {
		await rm(dir, { recursive: true, force: true });
		await ensureDir(dir);
		log(`[${session.slug}] clone ${repo}@${branch}`);
		await run("git", ["clone", "--depth", "1", "--branch", branch, remoteUrl(repo, token), dir], {
			timeout: 180_000,
		});
		return;
	}
	await run("git", ["-C", dir, "remote", "set-url", "origin", remoteUrl(repo, token)]);
	await run("git", ["-C", dir, "fetch", "--depth", "1", "origin", branch], { timeout: 120_000 });
	await run("git", ["-C", dir, "reset", "--hard", "FETCH_HEAD"]);
	await run("git", ["-C", dir, "clean", "-fd"]);
}

async function installDeps(session) {
	const marker = join(session.dir, "node_modules", ".wuppycms-preview");
	try {
		await run("test", ["-f", marker]);
		return false;
	} catch {
		// kurulum gerekli
	}
	log(`[${session.slug}] install`);
	await run(
		"pnpm",
		[
			"install",
			"--prefer-offline",
			"--allow-build=esbuild",
			"--allow-build=sharp",
			"--allow-build=@tailwindcss/oxide",
			"--allow-build=workerd",
			"--allow-build=msw",
		],
		{ cwd: session.dir, timeout: 300_000 },
	);
	const handle = await openFile(marker, "w");
	await handle.close();
	return true;
}

async function waitReady(session) {
	const url = `http://127.0.0.1:${session.port}/preview/${session.slug}/`;
	const deadline = Date.now() + READY_TIMEOUT;
	while (Date.now() < deadline) {
		if (session.proc?.exitCode !== null && session.proc?.exitCode !== undefined) return false;
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
			if (res.ok) {
				session.ready = true;
				return true;
			}
		} catch {
			// henüz hazır değil
		}
		await new Promise((resolve) => setTimeout(resolve, 1500));
	}
	return false;
}

async function startDev(session) {
	log(`[${session.slug}] astro dev :${session.port}`);
	const out = await openFile(join(session.dir, ".wuppycms-preview.log"), "a");
	session.proc = spawn(
		"pnpm",
		[
			"exec",
			"astro",
			"dev",
			"--host",
			"127.0.0.1",
			"--port",
			String(session.port),
			"--base",
			`/preview/${session.slug}/`,
		],
		{
			cwd: session.dir,
			env: { ...process.env, NODE_ENV: "development", ASTRO_TELEMETRY_DISABLED: "1" },
			stdio: ["ignore", out.fd, out.fd],
			// Alt süreçler (pnpm → astro → node) tek grup: durdururken hepsi ölür.
			detached: true,
		},
	);
	session.proc.on("exit", (code) => {
		log(`[${session.slug}] dev exited ${code}`);
		session.ready = false;
	});
	await out.close();
	return waitReady(session);
}

async function stopSession(session) {
	const proc = session.proc;
	try {
		if (proc?.pid) {
			// Negatif PID = süreç grubu (pnpm + astro + node).
			process.kill(-proc.pid, "SIGTERM");
		}
	} catch {
		try {
			proc?.kill("SIGTERM");
		} catch {
			// yok say
		}
	}
	// 2 sn içinde kapanmazsa zorla.
	if (proc?.pid) {
		await new Promise((resolve) => setTimeout(resolve, 1500));
		try {
			if (proc.exitCode === null) process.kill(-proc.pid, "SIGKILL");
		} catch {
			// zaten kapandı
		}
	}
	session.ready = false;
	sessions.delete(session.slug);
	log(`[${session.slug}] stopped`);
}

async function openSession({ slug, repo, branch, token }) {
	const existing = sessions.get(slug);
	if (existing) {
		existing.lastUsed = Date.now();
		if (!existing.ready) await ensureReady(existing);
		return existing;
	}

	if (sessions.size >= MAX) {
		const oldest = [...sessions.values()].sort((a, b) => a.lastUsed - b.lastUsed)[0];
		if (oldest) await stopSession(oldest);
	}

	const dir = join(ROOT, slug);
	await ensureDir(ROOT);
	while (!(await portFree(nextPort))) nextPort += 1;
	const session = {
		slug,
		repo,
		branch,
		dir,
		port: nextPort++,
		proc: null,
		ready: false,
		lastUsed: Date.now(),
		opening: null,
	};
	sessions.set(slug, session);
	session.opening = (async () => {
		await checkout(session, token, repo, branch);
		await installDeps(session);
		await startDev(session);
		return session;
	})();
	try {
		await session.opening;
	} catch (error) {
		await stopSession(session);
		throw error;
	}
	session.opening = null;
	return session;
}

async function ensureReady(session) {
	if (session.ready) return session;
	if (!session.proc || session.proc.exitCode !== null) {
		await startDev(session);
	} else {
		await waitReady(session);
	}
	return session;
}

async function refreshSession({ slug, token, branch }) {
	const session = sessions.get(slug);
	if (!session) return { ok: false, error: "not_open" };
	session.lastUsed = Date.now();
	const effectiveBranch = branch || session.branch;
	await checkout(session, token, session.repo, effectiveBranch);
	session.branch = effectiveBranch;
	return { ok: true, ready: session.ready };
}

function json(res, status, payload) {
	const body = JSON.stringify(payload);
	res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
	res.end(body);
}

async function readBody(req) {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	if (!chunks.length) return {};
	try {
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch {
		return {};
	}
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", "http://127.0.0.1");
	if (url.pathname === "/health") {
		return json(res, 200, {
			ok: true,
			sessions: [...sessions.values()].map((s) => ({
				slug: s.slug,
				port: s.port,
				ready: s.ready,
			})),
		});
	}
	if (SECRET && req.headers["x-preview-secret"] !== SECRET) {
		return json(res, 401, { error: "invalid_secret" });
	}
	try {
		if (req.method === "GET" && url.pathname === "/status") {
			const slug = url.searchParams.get("slug") ?? "";
			const session = sessions.get(slug);
			return json(res, 200, {
				running: Boolean(session),
				ready: Boolean(session?.ready),
				port: session?.port ?? null,
			});
		}
		if (req.method === "POST" && url.pathname === "/open") {
			const body = await readBody(req);
			if (!body.slug || !body.repo || !body.token) {
				return json(res, 400, { error: "slug, repo and token are required" });
			}
			const session = await openSession({
				slug: String(body.slug),
				repo: String(body.repo),
				branch: String(body.branch ?? "main"),
				token: String(body.token),
			});
			return json(res, 200, { ok: true, port: session.port, ready: session.ready });
		}
		if (req.method === "POST" && url.pathname === "/refresh") {
			const body = await readBody(req);
			if (!body.slug || !body.token) return json(res, 400, { error: "slug and token are required" });
			const result = await refreshSession({
				slug: String(body.slug),
				token: String(body.token),
				branch: body.branch ? String(body.branch) : undefined,
			});
			return json(res, result.ok ? 200 : 404, result);
		}
		if (req.method === "POST" && url.pathname === "/close") {
			const body = await readBody(req);
			const session = sessions.get(String(body.slug ?? ""));
			if (session) await stopSession(session);
			return json(res, 200, { ok: true });
		}
		return json(res, 404, { error: "not_found" });
	} catch (error) {
		log("error", error);
		return json(res, 500, { error: error instanceof Error ? error.message : "preview_error" });
	}
});

setInterval(() => {
	const now = Date.now();
	for (const session of [...sessions.values()]) {
		if (now - session.lastUsed > IDLE_MS) {
			void stopSession(session);
		}
	}
}, 60_000).unref();

server.listen(PORT, "127.0.0.1", () => {
	log(`preview worker :${PORT} root=${ROOT} max=${MAX}`);
	// Önceki çalıştırmadan kalan dev sunucuları temizle (port çakışması).
	void run("pkill", ["-f", "astro dev --host 127.0.0.1 --port 88"]).catch(() => undefined);
});
