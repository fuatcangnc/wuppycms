// GitHub App kurulumlarının D1 görünümü — kullanıcı ↔ installation eşlemesi
// webhook/setup akışında yazılır; token çözümü buradan okur.
//
// Token'ın kendisi burada tutulmaz: installation token'ları kısa ömürlüdür ve
// `app.ts` içinde bellek içi cache'lenir.

import type { SqlDatabase } from "../../platform";
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
	db: SqlDatabase,
	userId: string,
	oauthToken: string,
): Promise<number> {
	const pending = await db
		.prepare(
			`SELECT installation_id FROM github_installations WHERE user_id = '' LIMIT 20`,
		)
		.all<{ installation_id: string }>();
	if (!(pending.results?.length)) return 0;

	const data = await gh<{ installations: Array<{ id: number }> }>(
		oauthToken,
		"/user/installations?per_page=100",
	);
	const accessible = new Set((data.installations ?? []).map((entry) => String(entry.id)));
	let claimed = 0;
	for (const row of pending.results ?? []) {
		if (!accessible.has(row.installation_id)) continue;
		await db
			.prepare(
				`UPDATE github_installations SET user_id = ?, updated_at = ?
				 WHERE installation_id = ? AND user_id = ''`,
			)
			.bind(userId, new Date().toISOString(), row.installation_id)
			.run();
		claimed += 1;
	}
	return claimed;
}
