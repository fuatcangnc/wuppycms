// better-auth — D1 adaptörüyle kimlik katmanı.
//
// - E-posta/şifre: yerel geliştirme ve davetsiz kullanım için açık.
// - GitHub sosyal girişi: env'de client id/secret varsa etkinleşir; repo
//   işlemleri için `repo` kapsamı istenir ve dönen access token `account`
//   tablosuna yazılır (git API'si buradan okur).
//
// Workers'ta önerilen desen: istek başına yeni bir auth örneği (ucuz).

import { betterAuth } from "better-auth";
import type { SqlDatabase } from "./platform";
import type { AppEnv } from "../api/types";

export function createAuth(env: AppEnv) {
	const socialProviders =
		env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
			? {
					github: {
						clientId: env.GITHUB_CLIENT_ID,
						clientSecret: env.GITHUB_CLIENT_SECRET,
						// Repo okuma/yazma: git katmanının commit atabilmesi için şart.
						// (read:user + user:email better-auth varsayılanlarından gelir.)
						scope: ["repo"],
					},
				}
			: undefined;

	const baseURL = env.BETTER_AUTH_URL ?? "http://localhost:4321";
	// Ters proxy (Caddy → wrangler) arkasında istek URL'i http şemasıyla
	// görünebilir; better-auth Origin'i bu şemayla karşılaştırınca 403 verir.
	// Aynı ana bilgisayarın iki şemasını da güvenilir say.
	const trustedOrigins = [baseURL];
	try {
		const host = new URL(baseURL).host;
		trustedOrigins.push(`http://${host}`, `https://${host}`);
	} catch {
		// geçersiz baseURL → yalnız kendisi
	}
	if (!trustedOrigins.includes("http://localhost:8787")) {
		trustedOrigins.push("http://localhost:8787");
	}

	return betterAuth({
		database: (env as AppEnv & { SQLITE_RAW?: unknown }).SQLITE_RAW ?? env.DB,
		secret: env.BETTER_AUTH_SECRET,
		baseURL,
		basePath: "/api/auth",
		trustedOrigins,
		emailAndPassword: {
			enabled: true,
		},
		...(socialProviders ? { socialProviders } : {}),
	});
}

export type Auth = ReturnType<typeof createAuth>;

/** Kullanıcının GitHub access token'ını bulur (yoksa null). */
export async function findGitHubToken(
	db: SqlDatabase,
	userId: string,
): Promise<string | null> {
	const row = await db
		.prepare(
			"SELECT accessToken FROM account WHERE userId = ? AND providerId = 'github' AND accessToken IS NOT NULL LIMIT 1",
		)
		.bind(userId)
		.first<{ accessToken: string }>();
	return row?.accessToken ?? null;
}
