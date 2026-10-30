-- Yayın hedefleri (ADR 0022).
--
-- Varsayılan hedef `aws`: WuppyCMS'in kendi altyapısı, müşteri hiçbir şey
-- kurmaz. `cloudflare` yalnızca müşteri kendi Cloudflare hesabını OAuth ile
-- bağladığında kullanılır; domain ayarları müşterinin panelinde kalır.

ALTER TABLE projects ADD COLUMN deploy_target TEXT;
ALTER TABLE projects ADD COLUMN deploy_url TEXT;
ALTER TABLE projects ADD COLUMN preview_url TEXT;

CREATE TABLE IF NOT EXISTS deploy_jobs (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL,
	repo_full_name TEXT NOT NULL,
	branch TEXT NOT NULL,
	target TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'queued',
	url TEXT,
	preview_url TEXT,
	error TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deploy_jobs_status ON deploy_jobs (status);
CREATE INDEX IF NOT EXISTS idx_deploy_jobs_project ON deploy_jobs (project_id);

-- Müşterinin kendi Cloudflare hesabı. Token'lar şifreli saklanır ve her
-- yenilemede D1'deki değer güncellenir (rotasyon).
CREATE TABLE IF NOT EXISTS cloudflare_accounts (
	user_id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL,
	account_name TEXT,
	access_token_encrypted TEXT NOT NULL,
	refresh_token_encrypted TEXT,
	expires_at TEXT,
	scopes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
