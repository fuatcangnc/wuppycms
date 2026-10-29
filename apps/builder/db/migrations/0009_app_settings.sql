-- Genel uygulama ayarları (şifreli değerler) — ör. Cloudflare OAuth yenileme
-- token'ı rotasyona uğradığında yeni değeri kalıcı saklamak için.
CREATE TABLE IF NOT EXISTS app_settings (
	key TEXT PRIMARY KEY,
	value_encrypted TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
