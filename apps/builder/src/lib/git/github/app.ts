// GitHub App kimliği: RS256 JWT + kısa ömürlü installation access token.
//
// App private key'i PKCS#8 PEM'in base64'ü olarak `GITHUB_APP_PRIVATE_KEY_B64`
// içinde tutulur (Cloudflare secret / .dev.vars). Installation token'ları
// süreleri dolana kadar bellekte cache'lenir; DB'ye yazılmaz.

import type { AppEnv } from "../../../api/types";
import { gh } from "./api";

type InstallationToken = { token: string; expiresAt: number };
const cache = new Map<string, InstallationToken>();

function b64url(input: string | ArrayBuffer): string {
	const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * `GITHUB_APP_PRIVATE_KEY_B64` iki biçimi de kabul eder:
 * - PEM dosyasının base64'ü (BEGIN/END başlıkları dahil) — panelden indirilen
 *   anahtarın doğrudan base64'ü,
 * - DER (PKCS#8) gövdesinin base64'ü.
 */
function pemBase64ToBytes(pemBase64: string): ArrayBuffer {
	const decoded = atob(pemBase64.replace(/\s+/g, ""));
	const bytes = new Uint8Array(decoded.length);
	for (let i = 0; i < decoded.length; i += 1) bytes[i] = decoded.charCodeAt(i);

	const text = new TextDecoder().decode(bytes);
	if (!text.includes("BEGIN")) return bytes.buffer as ArrayBuffer;

	const der = atob(text.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
	const out = new Uint8Array(der.length);
	for (let i = 0; i < der.length; i += 1) out[i] = der.charCodeAt(i);
	return out.buffer as ArrayBuffer;
}

async function appJwt(env: AppEnv): Promise<string> {
	if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY_B64) {
		throw new Error("GitHub App yapılandırılmadı (GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY_B64).");
	}
	const key = await crypto.subtle.importKey(
		"pkcs8",
		pemBase64ToBytes(env.GITHUB_APP_PRIVATE_KEY_B64),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
	const now = Math.floor(Date.now() / 1000);
	const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const payload = b64url(
		JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID }),
	);
	const unsigned = `${header}.${payload}`;
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(unsigned),
	);
	return `${unsigned}.${b64url(signature)}`;
}

/** Bir installation için kısa ömürlü token döndürür. */
export async function getInstallationToken(env: AppEnv, installationId: string): Promise<string> {
	const cached = cache.get(installationId);
	if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

	const jwt = await appJwt(env);
	const data = await gh<{ token: string; expires_at: string }>(
		jwt,
		`/app/installations/${installationId}/access_tokens`,
		{ method: "POST" },
	);
	cache.set(installationId, {
		token: data.token,
		expiresAt: new Date(data.expires_at).getTime(),
	});
	return data.token;
}

export async function getInstallation(
	env: AppEnv,
	installationId: string,
): Promise<{ id: number; account: { login: string; type: string }; repository_selection: string }> {
	const jwt = await appJwt(env);
	return gh(jwt, `/app/installations/${installationId}`);
}

export async function listInstallationRepos(
	env: AppEnv,
	installationId: string,
): Promise<
	{
		fullName: string;
		name: string;
		private: boolean;
		defaultBranch: string;
		description: string | null;
		pushedAt: string;
		htmlUrl: string;
	}[]
> {
	const token = await getInstallationToken(env, installationId);
	const data = await gh<{
		repositories: Array<{
			full_name: string;
			name: string;
			private: boolean;
			default_branch: string;
			description: string | null;
			pushed_at: string;
			html_url: string;
		}>;
	}>(token, "/installation/repositories?per_page=100");
	return data.repositories.map((repo) => ({
		fullName: repo.full_name,
		name: repo.name,
		private: repo.private,
		defaultBranch: repo.default_branch,
		description: repo.description,
		pushedAt: repo.pushed_at,
		htmlUrl: repo.html_url,
	}));
}

/** Webhook imzasını doğrular. */
export async function verifyWebhook(env: AppEnv, body: string, signature: string | undefined): Promise<boolean> {
	if (!env.GITHUB_APP_WEBHOOK_SECRET || !signature) return false;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(env.GITHUB_APP_WEBHOOK_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
	const expected = `sha256=${b64urlHex(mac)}`;
	if (expected.length !== signature.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
	return diff === 0;
}

function b64urlHex(input: ArrayBuffer): string {
	return Array.from(new Uint8Array(input))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/** Kurulum akışı state'i — kullanıcı kimliğini imzalı olarak taşır. */
export async function createInstallState(
	env: AppEnv,
	userId: string,
): Promise<string | null> {
	if (!env.BETTER_AUTH_SECRET) return null;
	const payload = b64url(JSON.stringify({ uid: userId, ts: Date.now() }));
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(env.BETTER_AUTH_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
	return `${payload}.${b64url(mac)}`;
}

/** State'i doğrular ve kullanıcı kimliğini döndürür (30 dk geçerlilik). */
export async function verifyInstallState(
	env: AppEnv,
	state: string | undefined,
): Promise<string | null> {
	if (!state || !env.BETTER_AUTH_SECRET) return null;
	const [payload, signature] = state.split(".");
	if (!payload || !signature) return null;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(env.BETTER_AUTH_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);
	const mac = b64urlToBytes(signature);
	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		mac,
		new TextEncoder().encode(payload),
	);
	if (!valid) return null;
	try {
		const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))) as {
			uid?: string;
			ts?: number;
		};
		if (!data.uid || !data.ts) return null;
		if (Date.now() - data.ts > 30 * 60_000) return null;
		return data.uid;
	} catch {
		return null;
	}
}

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(new ArrayBuffer(binary.length));
	for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
