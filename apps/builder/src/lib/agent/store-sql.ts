// Ajan oturum/olay deposu — D1 (ADR 0008). İçerik yazmaz; yalnız sohbet,
// araç günlüğü ve geri alınabilir yazma kayıtlarını tutar.

import type { SqlDatabase } from "../platform";
import type { AgentEvent, AgentSession, SessionSummary, StoredMessage } from "./protocol";

let counter = 0;

/** Benzersiz kimlik — workerd'de crypto.randomUUID var; yoksa sayaç. */
export function newId(prefix: string): string {
	try {
		return `${prefix}_${crypto.randomUUID()}`;
	} catch {
		counter += 1;
		return `${prefix}_${Date.now().toString(36)}_${counter}`;
	}
}

type SessionRow = {
	id: string;
	title: string;
	repo_full_name: string;
	user_id: string;
	created_at: string;
	updated_at: string;
};

type MessageRow = {
	role: string;
	text: string;
	ts: string;
	tool_name: string | null;
	change_ids: string | null;
};

type RunRow = { id: string; status: string; stop_requested: number };

export async function createSession(
	database: SqlDatabase,
	input: { id: string; userId: string; repoFullName: string; title: string },
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO agent_sessions (id, user_id, repo_full_name, title, created_at, updated_at)
			 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
		)
		.bind(input.id, input.userId, input.repoFullName, input.title)
		.run();
}

export async function getSessionRow(
	database: SqlDatabase,
	id: string,
): Promise<SessionRow | null> {
	return database
		.prepare("SELECT id, title, repo_full_name, user_id, created_at, updated_at FROM agent_sessions WHERE id = ?")
		.bind(id)
		.first<SessionRow>();
}

export async function listSessions(
	database: SqlDatabase,
	userId: string,
	repoFullName: string,
): Promise<SessionSummary[]> {
	const result = await database
		.prepare(
			`SELECT s.id, s.title, s.updated_at,
			        (SELECT COUNT(*) FROM agent_messages m WHERE m.session_id = s.id) AS message_count
			 FROM agent_sessions s
			 WHERE s.user_id = ? AND s.repo_full_name = ?
			 ORDER BY s.updated_at DESC
			 LIMIT 60`,
		)
		.bind(userId, repoFullName)
		.all<{ id: string; title: string; updated_at: string; message_count: number }>();
	return result.results.map((row) => ({
		id: row.id,
		title: row.title,
		updatedAt: row.updated_at,
		messageCount: Number(row.message_count ?? 0),
	}));
}

export async function deleteSession(database: SqlDatabase, id: string): Promise<void> {
	await database.prepare("DELETE FROM agent_messages WHERE session_id = ?").bind(id).run();
	await database.prepare("DELETE FROM agent_runs WHERE session_id = ?").bind(id).run();
	await database.prepare("DELETE FROM agent_sessions WHERE id = ?").bind(id).run();
}

/** Bir değişiklik geri alınınca mesajlardaki change_ids kaydını temizler. */
export async function removeChangeIdFromMessages(
	database: SqlDatabase,
	changeId: string,
	_userId?: string,
	_repoFullName?: string,
): Promise<void> {
	const rows = await database
		.prepare("SELECT id, change_ids FROM agent_messages WHERE change_ids LIKE ?")
		.bind(`%${changeId}%`)
		.all<{ id: string; change_ids: string }>();
	for (const row of rows.results) {
		let ids: string[] = [];
		try {
			ids = JSON.parse(row.change_ids || "[]") as string[];
		} catch {
			ids = [];
		}
		const next = ids.filter((id) => id !== changeId);
		await database
			.prepare("UPDATE agent_messages SET change_ids = ? WHERE id = ?")
			.bind(next.length ? JSON.stringify(next) : null, row.id)
			.run();
	}
}

export async function loadMessages(
	database: SqlDatabase,
	sessionId: string,
): Promise<StoredMessage[]> {
	const result = await database
		.prepare(
			`SELECT role, text, ts, tool_name, change_ids
			 FROM agent_messages WHERE session_id = ? ORDER BY seq ASC`,
		)
		.bind(sessionId)
		.all<MessageRow>();
	const allIds = [
		...new Set(
			result.results.flatMap((row) => {
				if (!row.change_ids) return [];
				try {
					return JSON.parse(row.change_ids) as string[];
				} catch {
					return [];
				}
			}),
		),
	];
	const reverted = new Set<string>();
	if (allIds.length) {
		const placeholders = allIds.map(() => "?").join(",");
		const gone = await database
			.prepare(`SELECT id FROM agent_changes WHERE reverted = 1 AND id IN (${placeholders})`)
			.bind(...allIds)
			.all<{ id: string }>();
		for (const row of gone.results) reverted.add(row.id);
	}
	return result.results.map((row) => {
		let ids: string[] = [];
		if (row.change_ids) {
			try {
				ids = (JSON.parse(row.change_ids) as string[]).filter((id) => !reverted.has(id));
			} catch {
				ids = [];
			}
		}
		return {
			role: row.role === "user" ? "user" : row.role === "tool" ? "tool" : "assistant",
			text: row.text,
			ts: row.ts,
			...(row.tool_name ? { toolName: row.tool_name } : {}),
			...(ids.length ? { changeIds: ids } : {}),
		};
	});
}

export async function loadSession(
	database: SqlDatabase,
	id: string,
): Promise<AgentSession | null> {
	const row = await getSessionRow(database, id);
	if (!row) return null;
	return {
		id: row.id,
		title: row.title,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		messages: await loadMessages(database, id),
	};
}

async function nextMessageSeq(database: SqlDatabase, sessionId: string): Promise<number> {
	const row = await database
		.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM agent_messages WHERE session_id = ?")
		.bind(sessionId)
		.first<{ seq: number }>();
	return Number(row?.seq ?? 1);
}

export async function appendMessage(
	database: SqlDatabase,
	sessionId: string,
	message: StoredMessage,
): Promise<void> {
	const seq = await nextMessageSeq(database, sessionId);
	await database
		.prepare(
			`INSERT INTO agent_messages (id, session_id, seq, role, text, tool_name, change_ids, ts)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			newId("msg"),
			sessionId,
			seq,
			message.role,
			message.text,
			message.toolName ?? null,
			message.changeIds?.length ? JSON.stringify(message.changeIds) : null,
			message.ts,
		)
		.run();
	await touchSession(database, sessionId);
}

export async function touchSession(database: SqlDatabase, sessionId: string): Promise<void> {
	await database
		.prepare("UPDATE agent_sessions SET updated_at = datetime('now') WHERE id = ?")
		.bind(sessionId)
		.run();
}

export async function updateTitle(
	database: SqlDatabase,
	sessionId: string,
	title: string,
): Promise<void> {
	await database.prepare("UPDATE agent_sessions SET title = ? WHERE id = ?").bind(title, sessionId).run();
}

export async function attachChangeIds(
	database: SqlDatabase,
	sessionId: string,
	changeIds: string[],
): Promise<void> {
	if (!changeIds.length) return;
	// Kullanıcı mesajının (tur başlangıcının) son satırına ekle.
	const row = await database
		.prepare(
			`SELECT id FROM agent_messages
			 WHERE session_id = ? AND role = 'user' ORDER BY seq DESC LIMIT 1`,
		)
		.bind(sessionId)
		.first<{ id: string }>();
	if (!row) return;
	await database
		.prepare("UPDATE agent_messages SET change_ids = ? WHERE id = ?")
		.bind(JSON.stringify(changeIds), row.id)
		.run();
}

// --- çalışmalar (runs) ----------------------------------------------------------

export async function createRun(
	database: SqlDatabase,
	runId: string,
	sessionId: string,
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO agent_runs (id, session_id, status, stop_requested)
			 VALUES (?, ?, 'running', 0)`,
		)
		.bind(runId, sessionId)
		.run();
}

export async function finishRun(
	database: SqlDatabase,
	runId: string,
	status: "done" | "error" | "stopped",
): Promise<void> {
	await database
		.prepare("UPDATE agent_runs SET status = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(status, runId)
		.run();
}

export async function requestStop(database: SqlDatabase, sessionId: string): Promise<string | null> {
	const run = await database
		.prepare(
			`SELECT id FROM agent_runs
			 WHERE session_id = ? AND status = 'running'
			 ORDER BY created_at DESC LIMIT 1`,
		)
		.bind(sessionId)
		.first<{ id: string }>();
	if (!run) return null;
	await database
		.prepare("UPDATE agent_runs SET stop_requested = 1 WHERE id = ?")
		.bind(run.id)
		.run();
	return run.id;
}

export async function isStopRequested(database: SqlDatabase, runId: string): Promise<boolean> {
	const row = await database
		.prepare("SELECT stop_requested FROM agent_runs WHERE id = ?")
		.bind(runId)
		.first<{ stop_requested: number }>();
	return Number(row?.stop_requested ?? 0) === 1;
}

/** Oturumun son (ya da verilen) çalışması. */
export async function getRun(
	database: SqlDatabase,
	sessionId: string,
	runId?: string,
): Promise<RunRow | null> {
	if (runId) {
		return database
			.prepare("SELECT id, status, stop_requested FROM agent_runs WHERE id = ? AND session_id = ?")
			.bind(runId, sessionId)
			.first<RunRow>();
	}
	return database
		.prepare(
			`SELECT id, status, stop_requested FROM agent_runs
			 WHERE session_id = ? ORDER BY created_at DESC LIMIT 1`,
		)
		.bind(sessionId)
		.first<RunRow>();
}

// --- olaylar --------------------------------------------------------------------

export async function appendEvent(
	database: SqlDatabase,
	runId: string,
	event: AgentEvent,
): Promise<void> {
	const row = await database
		.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM agent_events WHERE run_id = ?")
		.bind(runId)
		.first<{ seq: number }>();
	const seq = Number(row?.seq ?? 1);
	await database
		.prepare("INSERT INTO agent_events (run_id, seq, event, ts) VALUES (?, ?, ?, ?)")
		.bind(runId, seq, JSON.stringify(event), event.ts)
		.run();
}

export async function readEvents(
	database: SqlDatabase,
	sessionId: string,
	runId: string | undefined,
	cursor: number,
): Promise<{ events: AgentEvent[]; cursor: number; done: boolean; runId?: string }> {
	const run = await getRun(database, sessionId, runId);
	if (!run) return { events: [], cursor, done: true };
	const result = await database
		.prepare("SELECT seq, event FROM agent_events WHERE run_id = ? AND seq > ? ORDER BY seq ASC")
		.bind(run.id, Math.max(0, cursor))
		.all<{ seq: number; event: string }>();
	let next = cursor;
	const events: AgentEvent[] = [];
	for (const row of result.results) {
		next = Number(row.seq);
		try {
			events.push(JSON.parse(row.event) as AgentEvent);
		} catch {
			// bozuk satırı atla — akış devam etsin
		}
	}
	return { events, cursor: next, done: run.status !== "running", runId: run.id };
}

// --- geri alınabilir yazmalar ----------------------------------------------------

export type ChangeRecord = {
	id: string;
	kind: string;
	path: string | null;
	label: string | null;
	before: string | null;
	after: string | null;
	reverted: number;
	ts: string;
};

export async function recordChange(
	database: SqlDatabase,
	input: {
		id: string;
		userId: string;
		repoFullName: string;
		kind: string;
		path: string | null;
		label: string | null;
		before: string | null;
		after: string | null;
	},
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO agent_changes (id, user_id, repo_full_name, kind, path, label, before, after, reverted, ts)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))`,
		)
		.bind(
			input.id,
			input.userId,
			input.repoFullName,
			input.kind,
			input.path,
			input.label,
			input.before,
			input.after,
		)
		.run();
}

export async function latestChange(
	database: SqlDatabase,
	userId: string,
	repoFullName: string,
	changeId?: string,
): Promise<ChangeRecord | null> {
	if (changeId) {
		return database
			.prepare(
				`SELECT id, kind, path, label, before, after, reverted, ts FROM agent_changes
				 WHERE id = ? AND user_id = ? AND repo_full_name = ? AND reverted = 0`,
			)
			.bind(changeId, userId, repoFullName)
			.first<ChangeRecord>();
	}
	return database
		.prepare(
			`SELECT id, kind, path, label, before, after, reverted, ts FROM agent_changes
			 WHERE user_id = ? AND repo_full_name = ? AND reverted = 0
			 ORDER BY ts DESC LIMIT 1`,
		)
		.bind(userId, repoFullName)
		.first<ChangeRecord>();
}

export async function markChangeReverted(
	database: SqlDatabase,
	id: string,
	_userId?: string,
	_repoFullName?: string,
): Promise<void> {
	await database.prepare("UPDATE agent_changes SET reverted = 1 WHERE id = ?").bind(id).run();
}
