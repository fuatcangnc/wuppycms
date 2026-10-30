#!/usr/bin/env node
// WuppyCMS yayın worker'ı — Lightsail VM'inde çalışır (systemd: wuppycms-deploy).
//
// Neden burada: `astro build` workerd içinde çalışmaz, container kullanmıyoruz,
// GitHub Actions billing kilidi var. Mevcut sunucu zaten bunu yapabiliyor.
//
// Akış (tek HTTP çağrısı, polling yok):
//   POST /build { jobId, repo, branch, token, slug, callbackSecret }
//     1. git clone --depth 1 <repo> (token'lı, geçici dizin)
//     2. pnpm install --prefer-offline
//     3. pnpm build
//     4. aws s3 sync dist/ s3://$BUCKET/sites/<slug>/ --delete
//     5. callback → POST <APP_URL>/api/deploy/callback  { jobId, status, secret }
//
// Kimlik: worker yalnız 127.0.0.1'i dinler ve `DEPLOY_WORKER_SECRET` ister.
// Git token'ı ve AWS anahtarları diske yazılmaz; süreç belleğinde kalır.

import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const PORT = Number(process.env.DEPLOY_WORKER_PORT ?? 8790);
const SECRET = process.env.DEPLOY_WORKER_SECRET ?? "";
const BUCKET = process.env.AWS_S3_BUCKET ?? "";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const APP_URL = (process.env.APP_URL ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
const MAX_JOBS = Number(process.env.DEPLOY_MAX_CONCURRENT ?? 2);
const BUILD_TIMEOUT = Number(process.env.DEPLOY_BUILD_TIMEOUT_MS ?? 10 * 60_000);
/** Cloudflare Pages direct upload için wrangler ikilisi. */
const WRANGLER_BIN = process.env.WRANGLER_BIN ?? "wrangler";

let running = 0;
const queue = [];

function log(...args) {
	console.log(new Date().toISOString(), ...args);
}

function exec(cmd, args, options = {}) {
	return run(cmd, args, {
		cwd: options.cwd,
		timeout: options.timeout ?? BUILD_TIMEOUT,
		maxBuffer: 20 * 1024 * 1024,
		env: {
			...process.env,
			CI: "1",
			NODE_ENV: "production",
			...(options.env ?? {}),
		},
	});
}

async function callback(payload) {
	try {
		const res = await fetch(`${APP_URL}/api/deploy/callback`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) log("callback başarısız", res.status, (await res.text()).slice(0, 200));
	} catch (error) {
		log("callback ulaşmadı", error.message);
	}
}

/** Repo'yu token'lı HTTPS URL'iyle, loglara sızdırmadan klonlar. */
async function cloneRepo({ repo, branch, token, dir }) {
	const url = `https://x-access-token:${token}@github.com/${repo}.git`;
	await exec("git", ["clone", "--depth", "1", "--branch", branch, url, dir], {
		env: {
			// Kimlik bilgisi git config'e yazılmasın.
			GIT_TERMINAL_PROMPT: "0",
			GIT_ASKPASS: "/bin/true",
		},
	});
}

async function buildSite(job) {
	const dir = await mkdtemp(join(tmpdir(), "wuppy-build-"));
	try {
		log(`[${job.jobId}] klon: ${job.repo}@${job.branch}`);
		await cloneRepo({ repo: job.repo, branch: job.branch, token: job.token, dir });

		log(`[${job.jobId}] install`);
		// pnpm 10+ postinstall script'lerini varsayılan olarak engeller;
		// Astro/Tailwind build'i için esbuild + sharp açıkça onaylanır.
		await exec(
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
			{ cwd: dir },
		);

		log(`[${job.jobId}] build`);
		await exec("pnpm", ["build"], { cwd: dir });

		if (job.target === "cloudflare") {
			// Direct upload: site müşterinin Cloudflare hesabındaki Pages
			// projesine yüklenir. Git entegrasyonu gerekmez.
			const cf = job.cloudflare ?? {};
			if (!cf.projectName || !cf.accountId || !cf.accessToken) {
				throw new Error("Cloudflare hedefi için hesap/token eksik.");
			}
			log(`[${job.jobId}] pages deploy → ${cf.projectName}`);
			await exec(
				WRANGLER_BIN,
				[
					"pages",
					"deploy",
					join(dir, "dist"),
					"--project-name",
					cf.projectName,
					"--branch",
					job.branch,
					"--commit-dirty=true",
				],
				{
					cwd: dir,
					env: {
						CLOUDFLARE_API_TOKEN: cf.accessToken,
						CLOUDFLARE_ACCOUNT_ID: cf.accountId,
						WRANGLER_SEND_METRICS: "false",
					},
				},
			);
			log(`[${job.jobId}] tamam (cloudflare)`);
			return { ok: true };
		}

		log(`[${job.jobId}] s3 sync`);
		await exec(
			"aws",
			[
				"s3",
				"sync",
				join(dir, "dist") + "/",
				`s3://${BUCKET}/sites/${job.slug}/`,
				"--delete",
				"--region",
				REGION,
				"--cache-control",
				"public, max-age=60, must-revalidate",
				"--exclude",
				"_astro/*",
				"--exclude",
				"fonts/*",
				"--exclude",
				"*.woff2",
				"--exclude",
				"*.png",
				"--exclude",
				"*.jpg",
				"--exclude",
				"*.webp",
				"--exclude",
				"*.svg",
				"--quiet",
			],
			{ cwd: dir, timeout: BUILD_TIMEOUT },
		);

		// Uzun ömürlü varlıklar ayrı geçiş: immutable cache.
		await exec(
			"aws",
			[
				"s3",
				"sync",
				join(dir, "dist", "_astro") + "/",
				`s3://${BUCKET}/sites/${job.slug}/_astro/`,
				"--region",
				REGION,
				"--cache-control",
				"public, max-age=31536000, immutable",
				"--quiet",
			],
			{ cwd: dir, timeout: BUILD_TIMEOUT },
		).catch(() => undefined);

		log(`[${job.jobId}] tamam`);
		return { ok: true };
	} finally {
		await rm(dir, { recursive: true, force: true }).catch(() => undefined);
	}
}

async function processJob(job) {
	try {
		await buildSite(job);
		await callback({
			jobId: job.jobId,
			status: "deployed",
			secret: SECRET,
			target: job.target ?? "aws",
			// CloudFront önbelleğini uygulama tarafı temizler.
			slug: job.target === "cloudflare" ? undefined : job.slug,
		});
	} catch (error) {
		const message = String(error?.stderr ?? error?.message ?? error).slice(-1500);
		log(`[${job.jobId}] HATA`, message);
		await callback({
			jobId: job.jobId,
			status: "failed",
			error: message,
			secret: SECRET,
			target: job.target ?? "aws",
		});
	} finally {
		running -= 1;
		drain();
	}
}

function drain() {
	while (running < MAX_JOBS && queue.length) {
		const job = queue.shift();
		running += 1;
		void processJob(job);
	}
}

const server = createServer((req, res) => {
	if (req.method === "GET" && req.url === "/health") {
		res.writeHead(200, { "content-type": "application/json" });
		res.end(JSON.stringify({ ok: true, running, queued: queue.length }));
		return;
	}
	if (req.method !== "POST" || req.url !== "/build") {
		res.writeHead(404).end();
		return;
	}

	const chunks = [];
	req.on("data", (chunk) => chunks.push(chunk));
	req.on("end", () => {
		let body;
		try {
			body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		} catch {
			res.writeHead(400).end("invalid json");
			return;
		}
		if (!SECRET || body.secret !== SECRET) {
			res.writeHead(401).end("unauthorized");
			return;
		}
		if (!body.jobId || !body.repo || !body.slug || !body.token) {
			res.writeHead(400).end("missing fields");
			return;
		}
		queue.push({ ...body, branch: body.branch || "main" });
		drain();
		res.writeHead(202, { "content-type": "application/json" });
		res.end(JSON.stringify({ accepted: true, queued: queue.length }));
	});
});

server.listen(PORT, "127.0.0.1", () => log(`deploy worker :${PORT} (bucket ${BUCKET})`));
