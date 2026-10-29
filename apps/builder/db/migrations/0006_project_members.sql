-- Ekip / izinler (parity 2b): proje paylaşımı — sahip davet eder, üye kabul
-- eder. İçerik yine repoda; burada yalnızca erişim kaydı tutulur. Üyeler
-- KENDİ GitHub bağlantılarıyla çalışır (sahibin token'ı paylaşılmaz).
CREATE TABLE IF NOT EXISTS project_members (
	project_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	-- 'editor' (yazabilir) | 'viewer' (salt okunur; yaptırım sonraki turda)
	role TEXT NOT NULL DEFAULT 'editor',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_invitations (
	id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL,
	email TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'editor',
	token TEXT NOT NULL UNIQUE,
	invited_by TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	accepted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_members_user ON project_members (user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_project ON project_invitations (project_id);
