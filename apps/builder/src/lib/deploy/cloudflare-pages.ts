// Cloudflare Pages — **müşterinin kendi hesabı** için opsiyonel yayın hedefi
// (ADR 0022).
//
// Varsayılan hedef AWS'dir. Bu yol yalnızca müşteri "kendi Cloudflare
// hesabıma yayınla" dediğinde, OAuth ile bağladığı hesabında çalışır. Böylece
// site ve **domain ayarları müşterinin panelinde kalır**; WuppyCMS domain
// yönetmez.
//
// Token'lar `cloudflare-oauth.ts` üzerinden şifreli saklanır ve yenilenir.

import type { AppEnv } from "../../api/types";
import type { SqlDatabase } from "../platform";
import { accessToken, CloudflareAuthError } from "./cloudflare-oauth";

const API_BASE = "https://api.cloudflare.com/client/v4";

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

async function cf<T>(
	env: AppEnv,
	db: SqlDatabase,
	userId: string,
	path: string,
	init?: RequestInit,
): Promise<T> {
	let token: string;
	let accountId: string;
	try {
		const auth = await accessToken(env, db, userId);
		token = auth.token;
		accountId = auth.accountId;
	} catch (error) {
		if (error instanceof CloudflareAuthError) throw new PagesError(error.status, error.message);
		throw error;
	}
	const res = await fetch(`${API_BASE}${path.replace("{account}", accountId)}`, {
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
 * Müşterinin hesabında Pages projesini hazırlar (varsa yeniden kullanır) ve
 * sabit `https://<proje>.pages.dev` adresini döner.
 *
 * Proje **Git bağlantısı olmadan** (direct upload) açılır: build'i WuppyCMS
 * worker'ı yapar ve dosyaları yükler. Böylece müşterinin ayrıca Cloudflare'ın
 * GitHub uygulamasını kurması gerekmez.
 */
export async function ensurePagesProject(
	env: AppEnv,
	db: SqlDatabase,
	userId: string,
	input: { repoFullName: string; branch: string },
): Promise<PagesTarget> {
	const name = pagesProjectName(input.repoFullName);

	const existing = await cf<Project>(
		env,
		db,
		userId,
		`/accounts/{account}/pages/projects/${name}`,
	).catch((error) => {
		if (error instanceof PagesError && error.status === 404) return null;
		throw error;
	});
	if (existing) {
		return { projectName: existing.name, url: `https://${existing.subdomain}`, created: false };
	}

	const created = await cf<Project>(env, db, userId, `/accounts/{account}/pages/projects`, {
		method: "POST",
		body: JSON.stringify({
			name,
			production_branch: input.branch,
		}),
	});
	return { projectName: created.name, url: `https://${created.subdomain}`, created: true };
}

export type PagesDeployment = {
	id: string;
	url: string;
	status: string;
	stage: string;
};

/** Tanı için son deployment durumu. */
export async function latestPagesDeployment(
	env: AppEnv,
	db: SqlDatabase,
	userId: string,
	projectName: string,
): Promise<PagesDeployment | null> {
	const rows = await cf<
		Array<{
			id: string;
			url: string;
			latest_stage?: { name?: string; status?: string };
		}>
	>(
		env,
		db,
		userId,
		`/accounts/{account}/pages/projects/${projectName}/deployments?per_page=1`,
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
