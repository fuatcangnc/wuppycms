// Cloudflare Pages — üretilen sitelerin barındırma hattı.
//
// GitHub Actions'a bağımlı değildir: Pages projesi GitHub deposuna bağlanır,
// Cloudflare kendi build runner'ında Astro sitesini derler. WuppyCMS yalnızca
// projeyi oluşturur, deploy'u tetikler ve sabit `*.pages.dev` adresini döner.
//
// Kimlik: `CLOUDFLARE_API_TOKEN` tercih edilir. Yoksa yerel `wrangler` OAuth
// yenileme token'ı (`CLOUDFLARE_OAUTH_REFRESH_TOKEN`) ile access token alınır;
// token isolate belleğinde süresi dolana kadar cache'lenir.

import type { AppEnv } from "../../api/types";

const API_BASE = "https://api.cloudflare.com/client/v4";
const OAUTH_TOKEN_URL = "https://dash.cloudflare.com/oauth2/token";
const DEFAULT_OAUTH_CLIENT_ID = "54d11594-84e4-41aa-b438-e81b8fa78ee7";

export type PagesTarget = {
	projectName: string;
	url: string;
	created: boolean;
};

type CfError = { code?: number; message?: string };

export class PagesError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "PagesError";
	}
}

let tokenCache: { token: string; expiresAt: number } | null = null;

/** Pages için gereken env değerleri var mı? */
export function pagesConfigured(env: AppEnv): boolean {
	return Boolean(
		env.CLOUDFLARE_ACCOUNT_ID &&
			(env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_OAUTH_REFRESH_TOKEN),
	);
}

async function accessToken(env: AppEnv): Promise<string | null> {
	if (env.CLOUDFLARE_API_TOKEN) return env.CLOUDFLARE_API_TOKEN;
	if (!env.CLOUDFLARE_OAUTH_REFRESH_TOKEN) return null;
	if (tokenCache && tokenCache.expiresAt - 60_000 > Date.now()) return tokenCache.token;

	const body = new URLSearchParams({
		grant_type: "refresh_token",
		refresh_token: env.CLOUDFLARE_OAUTH_REFRESH_TOKEN,
		client_id: env.CLOUDFLARE_OAUTH_CLIENT_ID || DEFAULT_OAUTH_CLIENT_ID,
	});
	const res = await fetch(OAUTH_TOKEN_URL, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body,
	});
	const data = (await res.json().catch(() => ({}))) as {
		access_token?: string;
		expires_in?: number;
	};
	if (!res.ok || !data.access_token) {
		throw new PagesError(res.status, "Cloudflare OAuth token yenilenemedi.");
	}
	tokenCache = {
		token: data.access_token,
		expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
	};
	return data.access_token;
}

async function cf<T>(env: AppEnv, path: string, init?: RequestInit): Promise<T> {
	const token = await accessToken(env);
	if (!token) throw new PagesError(401, "Cloudflare Pages yapılandırılmadı.");
	const res = await fetch(`${API_BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${token}`,
			"content-type": "application/json",
			...(init?.headers ?? {}),
		},
	});
	const data = (await res.json().catch(() => ({}))) as {
		success?: boolean;
		result?: T;
		errors?: CfError[];
	};
	if (!res.ok || data.success === false) {
		const message = data.errors?.[0]?.message ?? `Cloudflare API ${res.status}`;
		throw new PagesError(res.status, message);
	}
	return data.result as T;
}

function slug(value: string): string {
	return value
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Deterministik ve çakışmasız proje adı (Cloudflare sınırı: 58 karakter). */
export function pagesProjectName(fullName: string): string {
	const [owner = "", repo = ""] = fullName.split("/");
	let hash = 0x811c9dc5;
	for (const char of fullName.toLowerCase()) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	const suffix = hash.toString(36).slice(0, 5).padStart(5, "0");
	const base = `wuppy-${slug(owner)}-${slug(repo)}`.slice(0, 50).replace(/-+$/, "");
	return `${base}-${suffix}`;
}

type Project = { name: string; subdomain: string };

/**
 * Depo için Pages projesini hazırlar (varsa yeniden kullanır) ve sabit
 * `https://<proje>.pages.dev` adresini döner. Proje oluşturmak build
 * tetiklemez; içerik commit'lendikten sonra `triggerPagesDeployment` çağrılır.
 */
export async function ensurePagesProject(
	env: AppEnv,
	input: { repoFullName: string; branch: string },
): Promise<PagesTarget> {
	if (!env.CLOUDFLARE_ACCOUNT_ID) {
		throw new PagesError(400, "CLOUDFLARE_ACCOUNT_ID eksik.");
	}
	const account = env.CLOUDFLARE_ACCOUNT_ID;
	const name = pagesProjectName(input.repoFullName);

	const existing = await cf<Project | null>(
		env,
		`/accounts/${account}/pages/projects/${name}`,
	).catch((error) => {
		if (error instanceof PagesError && error.status === 404) return null;
		throw error;
	});
	if (existing) {
		return { projectName: existing.name, url: `https://${existing.subdomain}`, created: false };
	}

	const [owner, repo] = input.repoFullName.split("/");
	const payload = {
		name,
		production_branch: input.branch,
		source: {
			type: "github",
			config: {
				owner,
				repo_name: repo,
				production_branch: input.branch,
				deployments_enabled: true,
				production_deployments_enabled: true,
				pr_comments_enabled: false,
			},
		},
		build_config: {
			build_command: "pnpm build",
			destination_dir: "dist",
			root_dir: "",
		},
		deployment_configs: {
			production: { env_vars: { NODE_VERSION: { value: "22" } } },
			preview: { env_vars: { NODE_VERSION: { value: "22" } } },
		},
	};

	const created = await cf<Project>(env, `/accounts/${account}/pages/projects`, {
		method: "POST",
		body: JSON.stringify(payload),
	});
	return { projectName: created.name, url: `https://${created.subdomain}`, created: true };
}

/** Bağlı Git projesinde yeni bir build başlatır (commit sonrası). */
export async function triggerPagesDeployment(
	env: AppEnv,
	projectName: string,
	branch: string,
): Promise<boolean> {
	if (!env.CLOUDFLARE_ACCOUNT_ID) return false;
	try {
		await cf(env, `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments`, {
			method: "POST",
			body: JSON.stringify({ branch }),
		});
		return true;
	} catch (error) {
		// Aynı commit için zaten kuyrukta bir build varsa 409 dönebilir.
		console.warn("[pages] deploy tetiklenemedi:", error);
		return false;
	}
}

export type PagesDeployment = {
	id: string;
	url: string;
	status: string;
	stage: string;
};

/** Tanı/CLI için son deployment durumu. */
export async function latestPagesDeployment(
	env: AppEnv,
	projectName: string,
): Promise<PagesDeployment | null> {
	if (!env.CLOUDFLARE_ACCOUNT_ID) return null;
	const rows = await cf<
		Array<{
			id: string;
			url: string;
			latest_stage?: { name?: string; status?: string };
		}>
	>(
		env,
		`/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/pages/projects/${projectName}/deployments?per_page=1`,
	);
	const row = rows?.[0];
	if (!row) return null;
	return {
		id: row.id,
		url: row.url,
		status: row.latest_stage?.status ?? "unknown",
		stage: row.latest_stage?.name ?? "unknown",
	};
}
