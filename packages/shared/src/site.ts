// `.wuppycms/sites.jsonc` — repo başına site kaydı. UI'dan üretilir, elle
// düzenlenmez (GitCMS'in .gitcms/sites.jsonc sözleşmesinin karşılığı).

export type PublishingMode = "review" | "immediate";

/** Bağ biçimi (GitCMS "how links should look"): siteye göreli / tam URL /
 *  klasöre göreli / media:// (derleme anında çözülür). */
export type MediaLinkFormat = "relative" | "full" | "folder" | "media-uri";

/** Platform R2 binding'i üzerinden çalışan medya kitaplığı (kimlik gerekmez). */
export type R2MediaConfig = {
	/** Kova içi önek (ör. "assets"); boşsa kök. */
	prefix?: string;
	/** Tarayıcının açabildiği varlık alanı (ör. https://assets.example.com). */
	publicBaseUrl?: string;
};

export type SiteConfigEntry = {
	/** Repo içindeki benzersiz anahtar; tek sitelik repolar için "root". */
	key: string;
	/** Gösterim adı (genelde domain ya da repo adı). */
	name: string;
	/** Yayın adresi (astro.config `site` değerinden, düzenlenebilir). */
	url?: string;
	/** Yükleme klasörü (repo köküne göre, ör. "public"). */
	media?: string;
	/** Kopyalanan/editöre eklenen bağların biçimi; yoksa "relative". */
	mediaLink?: MediaLinkFormat;
	/** Ayarlıysa R2 kitaplığı açık: depo + R2 yan yana kullanılabilir. */
	mediaR2?: R2MediaConfig;
	/** Yayın mode: doğrudan ya da inceleme sonra. */
	publishing?: PublishingMode;
	/** Editörlerde görünecek koleksiyon anahtarları; boşsa hepsi. */
	collections?: string[];
};

export type SitesFile = {
	version: 1;
	sites: SiteConfigEntry[];
};

export const SITES_CONFIG_PATH = ".wuppycms/sites.jsonc";

// --- Şema doğrulaması (OSS self-host: net hatalar, kilitlemeyen doğrulama) -------
// Sıfır bağımlılık; bilinmeyen alanlar İLERİ UYUMLULUK için hata değildir —
// geçerli girdiler her koşulda okunur (Sveltia ilkesi: doğrulama kullanıcıyı
// asla dışarıda bırakmaz).

export type SitesValidationIssue = { path: string; message: string };

const MEDIA_LINKS = ["relative", "full", "folder", "media-uri"] as const;

/** `.wuppycms/sites.jsonc` doğrulaması — geçerli girdiler korunur, sorunlar listelenir. */
export function validateSitesFile(value: unknown): {
	file: SitesFile;
	issues: SitesValidationIssue[];
	ok: boolean;
} {
	const issues: SitesValidationIssue[] = [];
	const sites: SiteConfigEntry[] = [];

	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return {
			file: { version: 1, sites: [] },
			issues: [{ path: "", message: "Kök bir nesne olmalı: { version: 1, sites: [...] }" }],
			ok: false,
		};
	}
	const record = value as Record<string, unknown>;
	if (record.version !== 1) {
		issues.push({ path: "version", message: "version: 1 olmalı (şema sürümü)." });
	}
	const rawSites = record.sites;
	if (!Array.isArray(rawSites)) {
		issues.push({ path: "sites", message: "sites bir dizi olmalı." });
		return { file: { version: 1, sites: [] }, issues, ok: false };
	}

	const seen = new Set<string>();
	rawSites.forEach((raw, index) => {
		const at = `sites[${index}]`;
		if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
			issues.push({ path: at, message: "Girdi bir nesne olmalı." });
			return;
		}
		const entry = raw as Record<string, unknown>;
		const key = typeof entry.key === "string" ? entry.key.trim() : "";
		const name = typeof entry.name === "string" ? entry.name.trim() : "";
		let valid = true;

		if (!key) {
			issues.push({ path: `${at}.key`, message: "key zorunlu." });
			valid = false;
		} else if (seen.has(key)) {
			issues.push({ path: `${at}.key`, message: `“${key}” anahtarı tekrar ediyor.` });
			valid = false;
		}
		if (!name) {
			issues.push({ path: `${at}.name`, message: "name zorunlu." });
			valid = false;
		}
		if (entry.url !== undefined && typeof entry.url !== "string") {
			issues.push({ path: `${at}.url`, message: "url bir metin olmalı." });
			valid = false;
		}
		if (entry.media !== undefined && typeof entry.media !== "string") {
			issues.push({ path: `${at}.media`, message: "media bir klasör yolu (metin) olmalı." });
			valid = false;
		}
		if (entry.mediaLink !== undefined && !MEDIA_LINKS.includes(entry.mediaLink as (typeof MEDIA_LINKS)[number])) {
			issues.push({
				path: `${at}.mediaLink`,
				message: `mediaLink şunlardan biri olmalı: ${MEDIA_LINKS.join(", ")}.`,
			});
			valid = false;
		}
		if (entry.publishing !== undefined && entry.publishing !== "review" && entry.publishing !== "immediate") {
			issues.push({ path: `${at}.publishing`, message: "publishing review|immediate olmalı." });
			valid = false;
		}
		if (entry.collections !== undefined) {
			if (!Array.isArray(entry.collections) || entry.collections.some((item) => typeof item !== "string")) {
				issues.push({ path: `${at}.collections`, message: "collections bir metin dizisi olmalı." });
				valid = false;
			}
		}
		if (entry.mediaR2 !== undefined) {
			const r2 = entry.mediaR2 as Record<string, unknown>;
			if (typeof r2 !== "object" || r2 === null) {
				issues.push({ path: `${at}.mediaR2`, message: "mediaR2 bir nesne olmalı." });
				valid = false;
			} else {
				if (r2.prefix !== undefined && typeof r2.prefix !== "string") {
					issues.push({ path: `${at}.mediaR2.prefix`, message: "prefix bir metin olmalı." });
					valid = false;
				}
				if (r2.publicBaseUrl !== undefined && typeof r2.publicBaseUrl !== "string") {
					issues.push({ path: `${at}.mediaR2.publicBaseUrl`, message: "publicBaseUrl bir metin olmalı." });
					valid = false;
				}
			}
		}

		if (valid) {
			seen.add(key);
			sites.push({ ...(entry as SiteConfigEntry), key, name });
		}
	});

	return { file: { version: 1, sites }, issues, ok: issues.length === 0 };
}
