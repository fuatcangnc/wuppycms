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
	/** GitHub App — kurulum ve installation token'ları için. */
	GITHUB_APP_ID?: string;
	GITHUB_APP_CLIENT_ID?: string;
	GITHUB_APP_CLIENT_SECRET?: string;
	/** PKCS#8 PEM'in base64'ü; GitHub App private key. */
	GITHUB_APP_PRIVATE_KEY_B64?: string;
	GITHUB_APP_WEBHOOK_SECRET?: string;
	GITHUB_APP_SLUG?: string;
	/** "With AI" yeni site üretiminde kullanılan public GitHub template repo. */
	SITE_TEMPLATE_REPO?: string;
	/** İlk sıradaki Karakas şablonunun public template repo'su. */
	SITE_TEMPLATE_KARAKAS_REPO?: string;
	/** OpenCode Go inference org kimliği (x-opencode-org-id). */
	OPENCODE_ORG_ID?: string;

	// --- AWS yayın (ADR 0022) -------------------------------------------------
	/** S3'e yazma + CloudFront invalidation yapan IAM kimliği. */
	AWS_ACCESS_KEY_ID?: string;
	AWS_SECRET_ACCESS_KEY?: string;
	/** Tüm sitelerin içinde yaşadığı tek bucket. */
	AWS_S3_BUCKET?: string;
	/** `*.sites.wuppycms.com` dağıtımı. */
	AWS_CLOUDFRONT_DISTRIBUTION_ID?: string;
	/** Alt alan adı tabanı (varsayılan: sites.wuppycms.com). */
	AWS_SITES_DOMAIN?: string;
	/** VM'deki build worker adresi (varsayılan http://127.0.0.1:8790). */
	DEPLOY_WORKER_URL?: string;
	/** Lambda'da ajan turu yanıt içinde tamamlanır (arka plan görevi donar). */
	AGENT_INLINE?: string;
	/** AWS CodeBuild projesi (varsa build VM yerine orada koşar). */
	AWS_CODEBUILD_PROJECT?: string;
	/** Uygulama ↔ worker paylaşılan sırrı. */
	DEPLOY_WORKER_SECRET?: string;
	/** VM'deki canlı önizleme (astro dev) servisi (varsayılan http://127.0.0.1:8791). */
	PREVIEW_MANAGER_URL?: string;
	/** Uygulama ↔ önizleme servisi paylaşılan sırrı. */
	PREVIEW_SECRET?: string;
	/**
	 * Müşterinin kendi Cloudflare hesabını bağlaması için WuppyCMS OAuth
	 * uygulaması (self-managed OAuth client).
	 */
	CLOUDFLARE_OAUTH_CLIENT_ID?: string;
	CLOUDFLARE_OAUTH_CLIENT_SECRET?: string;
	/**
	 * R2 medya kitaplığı — kovası bağlıysa medya ekranında "R2" sekmesi açılır.
	 * Site bazlı önek/public URL `.wuppycms/sites.jsonc` içinde tutulur.
	 */
	MEDIA_R2?: R2Bucket;
}
