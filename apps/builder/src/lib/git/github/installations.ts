// GitHub App kurulumlarının D1 görünümü — kullanıcı ↔ installation eşlemesi
// webhook/setup akışında yazılır; token çözümü buradan okur.
//
// Token'ın kendisi burada tutulmaz: installation token'ları kısa ömürlüdür ve
// `app.ts` içinde bellek içi cache'lenir.

import type { SqlDatabase } from "../../platform";
import type { AppEnv } from "../../../api/types";
import { getInstallation } from "./app";
import { gh } from "./api";

export type GithubInstallation = {
	installationId: string;
	accountLogin: string;
	accountType: string;
	repositorySelection: string;
	createdAt: string;
};

type Row = {
	installation_id: string;
	account_login: string | null;
	account_type: string | null;
	repository_selection: string | null;
	created_at: string;
};

function toInstallation(row: Row): GithubInstallation {
	return {
		installationId: row.installation_id,
		accountLogin: row.account_login ?? "",
		accountType: row.account_type ?? "",
		repositorySelection: row.repository_selection ?? "",
		createdAt: row.created_at,
	};
}

/** Kullanıcının bağladığı tüm kurulumlar (en yeniden eskiye). */
export async function listInstallations(
	db: SqlDatabase,
	userId: string,
): Promise<GithubInstallation[]> {
	const rows = await db
		.prepare(
			`SELECT installation_id, account_login, account_type, repository_selection, created_at
			 FROM github_installations WHERE user_id = ? ORDER BY created_at DESC`,
		)
		.bind(userId)
		.all<Row>();
	return (rows.results ?? []).map(toInstallation);
}

/**
 * Repo sahibine (owner) karşılık gelen kurulum. GitHub sahipleri büyük/küçük
 * harfe duyarsızdır; karşılaştırma da öyle yapılır.
 */
export async function installationForOwner(
	db: SqlDatabase,
	userId: string,
	owner: string,
): Promise<GithubInstallation | null> {
	const login = owner.trim().toLowerCase();
	if (!login) return null;
	const row = await db
		.prepare(
			`SELECT installation_id, account_login, account_type, repository_selection, created_at
			 FROM github_installations
			 WHERE user_id = ? AND lower(account_login) = ?
			 ORDER BY created_at DESC LIMIT 1`,
		)
		.bind(userId, login)
		.first<Row>();
	return row ? toInstallation(row) : null;
}

/**
 * Webhook ile gelen "sahipsiz" kurulumları, kullanıcının OAuth token'ıyla
 * erişebildiği installation'larla eşleştirir. Setup URL yapılandırılmamış
 * olsa bile kurulum Projects ekranında görünür.
 *
 * Yalnız sahipsiz kayıt varsa GitHub'a gider (her istekte ek çağrı yok).
 */
export async function claimInstallations(
	env: AppEnv,
	db: SqlDatabase,
	userId: string,
	oauthToken: string,
): Promise<number> {
	const data = await gh<{ installations: Array<{ id: number }> }>(
		oauthToken,
		"/user/installations?per_page=100",
	);
	const accessible = (data.installations ?? []).map((entry) => String(entry.id));
	if (accessible.length === 0) return 0;

	let claimed = 0;
	for (const installationId of accessible) {
		// Aynı kurulum başka bir WuppyCMS kullanıcısında kayıtlıysa meta veriyi
		// oradan kopyala; hiç kayıt yoksa App JWT'siyle kurulumu çek.
		const source = await db
			.prepare(
				`SELECT account_login, account_type, repository_selection
				 FROM github_installations WHERE installation_id = ? LIMIT 1`,
			)
			.bind(installationId)
			.first<{
				account_login: string | null;
				account_type: string | null;
				repository_selection: string | null;
			}>();

		let accountLogin = source?.account_login ?? null;
		let accountType = source?.account_type ?? null;
		let selection = source?.repository_selection ?? null;
		if (!source) {
			try {
				const installation = await getInstallation(env, installationId);
				accountLogin = installation.account.login;
				accountType = installation.account.type;
				selection = installation.repository_selection;
			} catch {
				// private key yoksa kurulum meta verisi olmadan bağlanır
			}
		}

		const now = new Date().toISOString();
		await db
			.prepare(
				`INSERT INTO github_installations
					(id, user_id, installation_id, account_login, account_type, repository_selection, created_at, updated_at)
				 SELECT ?, ?, ?, ?, ?, ?, ?, ?
				 WHERE NOT EXISTS (
					SELECT 1 FROM github_installations WHERE user_id = ? AND installation_id = ?
				 )`,
			)
			.bind(
				crypto.randomUUID(),
				userId,
				installationId,
				accountLogin,
				accountType,
				selection,
				now,
				now,
				userId,
				installationId,
			)
			.run();
		claimed += 1;
	}
	return claimed;
}
