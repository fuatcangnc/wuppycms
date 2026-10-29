-- GitHub App installations — one WuppyCMS user can install the app on
-- multiple GitHub accounts (personal and organizations).
CREATE TABLE IF NOT EXISTS github_installations (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	installation_id TEXT NOT NULL,
	account_login TEXT,
	account_type TEXT,
	repository_selection TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE (user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_github_installations_user
	ON github_installations (user_id);

CREATE INDEX IF NOT EXISTS idx_github_installations_installation
	ON github_installations (installation_id);
