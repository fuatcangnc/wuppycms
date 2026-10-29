-- 0007_agent — admin içi AI widget oturumları, olayları ve geri alınabilir
-- yazma kayıtları (ADR 0008). İçerik burada YAŞAMAZ: yalnızca sohbet/olay
-- günlüğü ve bir yazmanın önceki hâli (undo) tutulur.

CREATE TABLE IF NOT EXISTS agent_sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	repo_full_name TEXT NOT NULL,
	title TEXT NOT NULL DEFAULT 'New chat',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user
	ON agent_sessions (user_id, repo_full_name, updated_at);

CREATE TABLE IF NOT EXISTS agent_messages (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	seq INTEGER NOT NULL,
	role TEXT NOT NULL,
	text TEXT NOT NULL,
	tool_name TEXT,
	change_ids TEXT,
	ts TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_messages_session_seq
	ON agent_messages (session_id, seq);

CREATE TABLE IF NOT EXISTS agent_runs (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'running',
	stop_requested INTEGER NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_session
	ON agent_runs (session_id, created_at);

CREATE TABLE IF NOT EXISTS agent_events (
	run_id TEXT NOT NULL,
	seq INTEGER NOT NULL,
	event TEXT NOT NULL,
	ts TEXT NOT NULL,
	PRIMARY KEY (run_id, seq)
);

CREATE TABLE IF NOT EXISTS agent_changes (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	repo_full_name TEXT NOT NULL,
	kind TEXT NOT NULL,
	path TEXT,
	label TEXT,
	before TEXT,
	after TEXT,
	reverted INTEGER NOT NULL DEFAULT 0,
	ts TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_changes_user_repo
	ON agent_changes (user_id, repo_full_name, ts);
