// Müşterinin kendi Cloudflare hesabı — OAuth ile bağlanır, token'lar şifreli
// saklanır (ADR 0022).
//
// Cloudflare'ın self-managed OAuth client'ı kullanılır: kullanıcı yalnızca
// `pages:write` + `account:read` izni verir; dilediği an Cloudflare panelinden
// yetkiyi kaldırır. Domain ayarları müşterinin zone'unda kalır.
//
// Refresh token her yenilemede değişir; yeni değer D1'e yazılır.

import type { AppEnv } from "../../api/types";
import { decryptToken, encryptToken } from "../crypto";
import type { SqlDatabase } from "../platform";

const AUTH_URL = "https://dash.cloudflare.com/oauth2/auth";
const TOKEN_URL = "https://dash.cloudflare.com/oauth2/token";

/** Pages projesi açmak ve deploy tetiklemek için gereken en dar küme. */
export const CLOUDFLARE_SCOPES = [
	"account:read",
	"user:read",
	"pages:write",
	"offline_access",
] as const;

export type CloudflareAccount = {
	accountId: string;
	accountName: string | null;
	scopes: string[];
	connectedAt: string;
};

type Row = {
	user_id: string;
	account_id: string;
	account_name: string | null;
	access_token_encrypted: string;
	refresh_token_encrypted: string | null;
	expires_at: string | null;
	scopes: string | null;
	updated_at: string;
};

export class CloudflareAuthError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "CloudflareAuthError";
	}
}

/** OAuth client yapılandırıldı mı? (Yoksa bağlanma düğmesi gizlenir.) */
export function cloudflareOAuthConfigured(env: AppEnv): boolean {
	return Boolean(env.CLOUDFLARE_OAUTH_CLIENT_ID && env.CLOUDFLARE_OAUTH_CLIENT_SECRET);
}

export function cloudflareRedirectUri(env: AppEnv, origin: string): string {
	const base = (env.BETTER_AUTH_URL || origin).replace(/\/+$/, "");
	return `${base}/api/deploy/cloudflare/callback`;
}

/** Kullanıcıyı Cloudflare onay ekranına gönderir. */
export function authorizationUrl(
	env: AppEnv,
	input: { state: string; redirectUri: string },
): string {
	const params = new URLSearchParams({
		client_id: env.CLOUDFLARE_OAUTH_CLIENT_ID ?? "",
		redirect_uri: input.redirectUri,
		response_type: "code",
		scope: CLOUDFLARE_SCOPES.join(" "),
		state: input.state,
	});
	return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
	access_token?: string;
	refresh_token?: string;
	expires_in?: number;
	scope?: string;
	error?: string;
	error_description?: string;
};

async function exchange(body: URLSearchParams, env: AppEnv): Promise<TokenResponse> {
	const res = await fetch(TOKEN_URL, {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
			authorization: `Basic ${btoa(`${env.CLOUDFLARE_OAUTH_CLIENT_ID}:${env.CLOUDFLARE_OAUTH_CLIENT_SECRET}`)}`,
		},
		body,
	});
	const data = (await res.json().catch(() => ({}))) as TokenResponse;
	if (!res.ok || !data.access_token) {
		throw new CloudflareAuthError(
			res.status,
			data.error === "invalid_grant"
				? "Cloudflare yetkisi geçersiz veya kaldırılmış. Yeniden bağlanın."
				: (data.error_description ?? "Cloudflare yetkilendirmesi başarısız."),
		);
	}
	return data;
}

/** Onay dönüşündeki kodu token'a çevirir. */
export async function exchangeCode(
	env: AppEnv,
	input: { code: string; redirectUri: string },
): Promise<TokenResponse> {
	return exchange(
		new URLSearchParams({
			grant_type: "authorization_code",
			code: input.code,
			redirect_uri: input.redirectUri,
			client_id: env.CLOUDFLARE_OAUTH_CLIENT_ID ?? "",
		}),
		env,
	);
}

type CfAccount = { id: string; name: string };

async function listAccounts(accessToken: string): Promise<CfAccount[]> {
	const res = await fetch("https://api.cloudflare.com/client/v4/accounts", {
		headers: {
			authorization: `Bearer ${accessToken}`,
			"content-type": "application/json",
		},
	});
	const data = (await res.json().catch(() => ({}))) as {
		success?: boolean;
		result?: CfAccount[];
		errors?: Array<{ message?: string }>;
	};
	if (!res.ok || data.success === false) {
		throw new CloudflareAuthError(
			res.status,
			data.errors?.[0]?.message ?? "Cloudflare hesapları okunamadı.",
		);
	}
	return data.result ?? [];
}

/** Token'ı (ve varsa yenileme anahtarını) D1'e şifreli yazar. */
async function persist(
	env: AppEnv,
	db: SqlDatabase,
	userId: string,
	input: {
		accountId: string;
		accountName: string | null;
		accessToken: string;
		refreshToken?: string;
		expiresIn?: number;
		scopes?: string;
	},
): Promise<void> {
	const now = new Date().toISOString();
	const expiresAt = input.expiresIn
		? new Date(Date.now() + input.expiresIn * 1000).toISOString()
		: null;
	const access = await encryptToken(input.accessToken, env.TOKEN_ENCRYPTION_KEY);
	const refresh = input.refreshToken
		? await encryptToken(input.refreshToken, env.TOKEN_ENCRYPTION_KEY)
		: null;
	await db
		.prepare(
			`INSERT INTO cloudflare_accounts
				(user_id, account_id, account_name, access_token_encrypted, refresh_token_encrypted, expires_at, scopes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(user_id) DO UPDATE SET
				account_id = excluded.account_id,
				account_name = excluded.account_name,
				access_token_encrypted = excluded.access_token_encrypted,
				refresh_token_encrypted = COALESCE(excluded.refresh_token_encrypted, cloudflare_accounts.refresh_token_encrypted),
				expires_at = excluded.expires_at,
				scopes = excluded.scopes,
				updated_at = excluded.updated_at`,
		)
		.bind(
			userId,
			input.accountId,
			input.accountName,
			access,
			refresh,
			expiresAt,
			input.scopes ?? null,
			now,
			now,
		)
		.run();
}

/** Onay dönüşünü tamamlar: hesabı seçer ve bağlantıyı kaydeder. */
export async function completeConnection(
	env: AppEnv,
	db: SqlDatabase,
	userId: string,
	input: { code: string; redirectUri: string },
): Promise<CloudflareAccount> {
	const tokens = await exchangeCode(env, input);
	const accounts = await listAccounts(tokens.access_token!);
	const account = accounts[0];
	if (!account) {
		throw new CloudflareAuthError(400, "Bu Cloudflare hesabında erişilebilir bir hesap yok.");
	}
	await persist(env, db, userId, {
		accountId: account.id,
		accountName: account.name,
		accessToken: tokens.access_token!,
		refreshToken: tokens.refresh_token,
		expiresIn: tokens.expires_in,
		scopes: tokens.scope,
	});
	return {
		accountId: account.id,
		accountName: account.name,
		scopes: (tokens.scope ?? CLOUDFLARE_SCOPES.join(" ")).split(" "),
		connectedAt: new Date().toISOString(),
	};
}

export async function getAccount(db: SqlDatabase, userId: string): Promise<CloudflareAccount | null> {
	const row = await db
		.prepare(
			`SELECT user_id, account_id, account_name, access_token_encrypted,
			        refresh_token_encrypted, expires_at, scopes, updated_at
			 FROM cloudflare_accounts WHERE user_id = ?`,
		)
		.bind(userId)
		.first<Row>();
	if (!row) return null;
	return {
		accountId: row.account_id,
		accountName: row.account_name,
		scopes: (row.scopes ?? "").split(" ").filter(Boolean),
		connectedAt: row.updated_at,
	};
}

export async function disconnect(db: SqlDatabase, userId: string): Promise<void> {
	await db.prepare("DELETE FROM cloudflare_accounts WHERE user_id = ?").bind(userId).run();
}

/** Süresi dolmuşsa yeniler; her durumda geçerli access token döner. */
export async function accessToken(
	env: AppEnv,
	db: SqlDatabase,
	userId: string,
): Promise<{ accountId: string; token: string }> {
	const row = await db
		.prepare(
			`SELECT account_id, access_token_encrypted, refresh_token_encrypted, expires_at
			 FROM cloudflare_accounts WHERE user_id = ?`,
		)
		.bind(userId)
		.first<{
			account_id: string;
			access_token_encrypted: string;
			refresh_token_encrypted: string | null;
			expires_at: string | null;
		}>();
	if (!row) {
		throw new CloudflareAuthError(401, "Cloudflare hesabı bağlı değil.");
	}
	const current = await decryptToken(row.access_token_encrypted, env.TOKEN_ENCRYPTION_KEY);
	const expiresAt = row.expires_at ? Date.parse(row.expires_at) : 0;
	if (expiresAt && expiresAt - 60_000 > Date.now()) {
		return { accountId: row.account_id, token: current };
	}

	const refreshToken = row.refresh_token_encrypted
		? await decryptToken(row.refresh_token_encrypted, env.TOKEN_ENCRYPTION_KEY)
		: null;
	if (!refreshToken) {
		throw new CloudflareAuthError(401, "Cloudflare oturumu doldu. Yeniden bağlanın.");
	}
	const tokens = await exchange(
		new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: env.CLOUDFLARE_OAUTH_CLIENT_ID ?? "",
		}),
		env,
	);
	await persist(env, db, userId, {
		accountId: row.account_id,
		accountName: null,
		accessToken: tokens.access_token!,
		refreshToken: tokens.refresh_token,
		expiresIn: tokens.expires_in,
		scopes: tokens.scope,
	});
	return { accountId: row.account_id, token: tokens.access_token! };
}
