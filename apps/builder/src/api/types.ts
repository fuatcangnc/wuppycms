// Builder worker'ının bağlama (binding) sözleşmesi. wrangler.jsonc ile
// eşleşir; `wrangler types` sonrası global Env de aynı alanları taşır.

export interface AppEnv {
	/** D1 — uygulama verisi (kullanıcı, bağlantı, proje). İçerik burada yaşamaz. */
	DB?: D1Database;
	/** Statik varlıklar (Cloudflare Assets). */
	ASSETS?: Fetcher;
	/**
	 * Geliştirme kolaylığı: tek kullanıcılı yerel token.
	 * Üretimde kimlik better-auth oturumundan gelir ve `account` tablosundaki
	 * GitHub access token'ı kullanılır.
	 */
	GITHUB_TOKEN?: string;
	/**
	 * GitHub API kökü — varsayılan api.github.com. Ağsız E2E'de sahte sunucuya
	 * çevrilir (bkz. scripts/e2e-media.mjs --mock ve scripts/lib/mock-github.mjs).
	 */
	GITHUB_API_BASE?: string;
	/** Token şifreleme anahtarı (64 hex). openssl rand -hex 32 */
	TOKEN_ENCRYPTION_KEY?: string;
	/** better-auth oturum imzalama anahtarı. openssl rand -base64 32 */
	BETTER_AUTH_SECRET?: string;
	/** better-auth taban adresi (ör. http://localhost:4321). */
	BETTER_AUTH_URL?: string;
	/** GitHub OAuth App — sosyal giriş ve repo erişimi için. */
	GITHUB_CLIENT_ID?: string;
	GITHUB_CLIENT_SECRET?: string;
	/** "With AI" yeni site üretiminde kullanılan public GitHub template repo. */
	SITE_TEMPLATE_REPO?: string;
	/**
	 * R2 medya kitaplığı — kovası bağlıysa medya ekranında "R2" sekmesi açılır.
	 * Site bazlı önek/public URL `.wuppycms/sites.jsonc` içinde tutulur.
	 */
	MEDIA_R2?: R2Bucket;
}
