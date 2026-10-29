-- 0003_media_meta — medya dosyalarının uygulama-üstü yorumları (alt metin).
--
-- İçerik repo'da yaşar; ama alt metin gibi editör meta verisi repoya kirlilik
-- saçmadan D1'de tutulur. Site üretimi alt'ı içerik yazımında (markdown) zaten
-- taşır; bu tablo yalnız yönetici arayüzünün hatırladığı değerdir.

CREATE TABLE IF NOT EXISTS media_meta (
	repo_full_name TEXT NOT NULL,
	path TEXT NOT NULL,
	alt TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (repo_full_name, path)
);
