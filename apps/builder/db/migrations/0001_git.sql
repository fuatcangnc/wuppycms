-- 0001_git — git bağlantıları ve proje kayıtları.
--
-- Token alanları uygulama katmanında şifrelenir (src/lib/crypto.ts,
-- `iv:tag:ciphertext` hex). refresh_token_index = düz metnin HMAC'i; anahtar
-- rotasyonunda satırı bulmak için deterministik arama indeksi.

CREATE TABLE IF NOT EXISTS git_connections (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	provider TEXT NOT NULL DEFAULT 'github',
	account_login TEXT,
	account_type TEXT,
	installation_id TEXT,
	access_token_enc TEXT NOT NULL,
	refresh_token_enc TEXT,
	refresh_token_index TEXT,
	token_expires_at TEXT,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_git_connections_user_provider
	ON git_connections (user_id, provider);
CREATE INDEX IF NOT EXISTS idx_git_connections_refresh_index
	ON git_connections (refresh_token_index);

CREATE TABLE IF NOT EXISTS projects (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	name TEXT NOT NULL,
	repo_full_name TEXT NOT NULL,
	default_branch TEXT NOT NULL DEFAULT 'main',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_user_repo
	ON projects (user_id, repo_full_name);
