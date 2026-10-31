// Ajan oturum/olay deposu — S3 backend. Lambda örnekleri kendi /tmp SQLite'ını
// kullandığı için oturum bir örnekte açılıp olay isteği başka örneğe gidince
// "session_not_found" alınıyordu. Bu store tüm ajan durumunu tek S3 bucket'ında
// tutar; hangi örnek işlerse işlesin aynı veriyi görür.
//
// Anahtarlar (AGENT_BUCKET = DB bucket, özel):
//   agent/v1/sessions/<id>/meta.json          oturum + lastRunId
//   agent/v1/sessions/<id>/messages.json      StoredMessage[]
//   agent/v1/sessions/<id>/changes.json       ChangeRecord[] (repo bazlı ayrı)
//   agent/v1/runs/<runId>/meta.json           durum + stop isteği
//   agent/v1/runs/<runId>/events/<ts>-<n>.json olay partileri
//   agent/v1/user-sessions/<u>/<repo>/<id>.json özet dizini
//   agent/v1/users/<u>/repos/<repo>/changes.json ChangeRecord[]

import { AwsClient } from "aws4fetch";
import type { SqlDatabase } from "../platform";
import type { AgentEvent, AgentSession, SessionSummary, StoredMessage } from "./protocol";
import { newId, type ChangeRecord } from "./store-sql";

const PREFIX = "agent/v1";

type SessionMeta = {
	id: string;
	userId: string;
	repoFullName: string;
	title: string;
	createdAt: string;
	updatedAt: string;
	lastRunId?: string;
};

type IndexEntry = {
	id: string;
	title: string;
	updatedAt: string;
	messageCount: number;
};

type RunMeta = {
	id: string;
	sessionId: string;
	status: "running" | "done" | "error" | "stopped";
	stopRequested: boolean;
	createdAt: string;
	updatedAt: string;
};

const now = () => new Date().toISOString();

function storeEnv(): { bucket: string; region: string } {
	const env = typeof process !== "undefined" ? process.env : ({} as NodeJS.ProcessEnv);
	return {
		bucket: env.AGENT_BUCKET ?? env.DB_BUCKET ?? "",
		region: env.AWS_REGION ?? "us-east-1",
	};
}

let client: AwsClient | null = null;
function s3(): AwsClient {
	if (client) return client;
	const env = typeof process !== "undefined" ? process.env : ({} as NodeJS.ProcessEnv);
	client = new AwsClient({
		accessKeyId: env.AWS_ACCESS_KEY_ID ?? "",
		secretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? "",
		sessionToken: env.AWS_SESSION_TOKEN,
		region: env.AWS_REGION ?? "us-east-1",
		service: "s3",
	});
	return client;
}

function objectUrl(key: string, query?: string): string {
	const { bucket, region } = storeEnv();
	const path = key
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
	return `https://${bucket}.s3.${region}.amazonaws.com/${path}${query ? `?${query}` : ""}`;
}

function decodeXml(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

async function getObject(key: string): Promise<{ text: string; etag?: string } | null> {
	const res = await s3().fetch(objectUrl(key), { method: "GET" });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`S3 GET ${res.status}`);
	return { text: await res.text(), etag: res.headers.get("etag") ?? undefined };
}

async function readJson<T>(key: string): Promise<{ value: T; etag?: string } | null> {
	const object = await getObject(key);
	if (!object) return null;
	return { value: JSON.parse(object.text) as T, etag: object.etag };
}

async function putJson(
	key: string,
	value: unknown,
	opts: { ifMatch?: string; ifNoneMatch?: boolean } = {},
): Promise<boolean> {
	const headers: Record<string, string> = { "content-type": "application/json" };
	if (opts.ifMatch) headers["if-match"] = opts.ifMatch;
	else if (opts.ifNoneMatch) headers["if-none-match"] = "*";
	const res = await s3().fetch(objectUrl(key), {
		method: "PUT",
		headers,
		body: JSON.stringify(value),
	});
	if (res.status === 412) return false;
	if (!res.ok) throw new Error(`S3 PUT ${res.status}`);
	return true;
}

async function deleteObject(key: string): Promise<void> {
	const res = await s3().fetch(objectUrl(key), { method: "DELETE" });
	if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE ${res.status}`);
}

async function listKeys(prefix: string): Promise<string[]> {
	const { bucket, region } = storeEnv();
	const keys: string[] = [];
	let token: string | undefined;
	do {
		const params = new URLSearchParams({ "list-type": "2", prefix, "max-keys": "1000" });
		if (token) params.set("continuation-token", token);
		const res = await s3().fetch(
			`https://${bucket}.s3.${region}.amazonaws.com/?${params.toString()}`,
			{ method: "GET" },
		);
		if (!res.ok) throw new Error(`S3 LIST ${res.status}`);
		const xml = await res.text();
		for (const match of xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)) {
			keys.push(decodeXml(match[1] ?? ""));
		}
		const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
		const next = xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1];
		token = truncated && next ? decodeXml(next) : undefined;
	} while (token);
	return keys;
}

/** Koşullu yaz: başka örnek araya yazdıysa (412) yeniden okuyup dener. */
async function mutate<T>(key: string, empty: T, fn: (value: T) => T): Promise<T> {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const current = await readJson<T>(key);
		const next = fn(current ? current.value : empty);
		const ok = await putJson(key, next, {
			ifMatch: current?.etag,
			ifNoneMatch: !current,
		});
		if (ok) return next;
	}
	throw new Error("S3 store yazma çakışması");
}

async function mutateExisting<T>(key: string, fn: (value: T) => T): Promise<T | null> {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const current = await readJson<T>(key);
		if (!current) return null;
		const next = fn(current.value);
		const ok = await putJson(key, next, { ifMatch: current.etag });
		if (ok) return next;
	}
	throw new Error("S3 store yazma çakışması");
}

const sessionPrefix = (id: string) => `${PREFIX}/sessions/${id}`;
const metaKey = (id: string) => `${sessionPrefix(id)}/meta.json`;
const messagesKey = (id: string) => `${sessionPrefix(id)}/messages.json`;
const indexKey = (userId: string, repo: string, id: string) =>
	`${PREFIX}/user-sessions/${userId}/${encodeURIComponent(repo)}/${id}.json`;
const changesKey = (userId: string, repo: string) =>
	`${PREFIX}/users/${userId}/repos/${encodeURIComponent(repo)}/changes.json`;
const runMetaKey = (runId: string) => `${PREFIX}/runs/${runId}/meta.json`;
const runEventsPrefix = (runId: string) => `${PREFIX}/runs/${runId}/events/`;

async function readMeta(sessionId: string): Promise<SessionMeta | null> {
	return (await readJson<SessionMeta>(metaKey(sessionId)))?.value ?? null;
}

// --- oturumlar -----------------------------------------------------------------

export async function createSession(
	_database: SqlDatabase,
	input: { id: string; userId: string; repoFullName: string; title: string },
): Promise<void> {
	const createdAt = now();
	const meta: SessionMeta = { ...input, createdAt, updatedAt: createdAt };
	await putJson(metaKey(input.id), meta, { ifNoneMatch: true });
	await putJson(indexKey(input.userId, input.repoFullName, input.id), {
		id: input.id,
		title: input.title,
		updatedAt: createdAt,
		messageCount: 0,
	} satisfies IndexEntry);
}

export async function getSessionRow(
	_database: SqlDatabase,
	id: string,
): Promise<{
	id: string;
	title: string;
	repo_full_name: string;
	user_id: string;
	created_at: string;
	updated_at: string;
} | null> {
	const meta = await readMeta(id);
	if (!meta) return null;
	return {
		id: meta.id,
		title: meta.title,
		repo_full_name: meta.repoFullName,
		user_id: meta.userId,
		created_at: meta.createdAt,
		updated_at: meta.updatedAt,
	};
}

export async function listSessions(
	_database: SqlDatabase,
	userId: string,
	repoFullName: string,
): Promise<SessionSummary[]> {
	const keys = await listKeys(`${PREFIX}/user-sessions/${userId}/${encodeURIComponent(repoFullName)}/`);
	const rows = await Promise.all(
		keys.map(async (key) => (await readJson<IndexEntry>(key))?.value ?? null),
	);
	return rows
		.filter((row): row is IndexEntry => Boolean(row))
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		.slice(0, 60)
		.map((row) => ({
			id: row.id,
			title: row.title,
			updatedAt: row.updatedAt,
			messageCount: row.messageCount,
		}));
}

export async function deleteSession(_database: SqlDatabase, id: string): Promise<void> {
	const meta = await readMeta(id);
	const keys = await listKeys(`${sessionPrefix(id)}/`);
	await Promise.all(keys.map((key) => deleteObject(key)));
	if (meta) await deleteObject(indexKey(meta.userId, meta.repoFullName, id));
}

export async function removeChangeIdFromMessages(
	_database: SqlDatabase,
	changeId: string,
	userId?: string,
	repoFullName?: string,
): Promise<void> {
	if (!userId || !repoFullName) return;
	const keys = await listKeys(`${PREFIX}/user-sessions/${userId}/${encodeURIComponent(repoFullName)}/`);
	for (const key of keys) {
		const entry = (await readJson<IndexEntry>(key))?.value;
		if (!entry) continue;
		await mutate<StoredMessage[]>(messagesKey(entry.id), [], (messages) =>
			messages.map((message) =>
				message.changeIds?.includes(changeId)
					? { ...message, changeIds: message.changeIds.filter((id) => id !== changeId) }
					: message,
			),
		);
	}
}

async function changedSet(userId: string, repoFullName: string): Promise<Set<string>> {
	const changes = (await readJson<ChangeRecord[]>(changesKey(userId, repoFullName)))?.value ?? [];
	return new Set(changes.filter((change) => change.reverted).map((change) => change.id));
}

export async function loadMessages(
	_database: SqlDatabase,
	sessionId: string,
): Promise<StoredMessage[]> {
	const meta = await readMeta(sessionId);
	const messages = (await readJson<StoredMessage[]>(messagesKey(sessionId)))?.value ?? [];
	const reverted = meta ? await changedSet(meta.userId, meta.repoFullName) : new Set<string>();
	return messages.map((message) => {
		if (!message.changeIds?.length) return message;
		const ids = message.changeIds.filter((id) => !reverted.has(id));
		if (ids.length === message.changeIds.length) return message;
		return { ...message, changeIds: ids.length ? ids : undefined };
	});
}

export async function loadSession(
	_database: SqlDatabase,
	id: string,
): Promise<AgentSession | null> {
	const meta = await readMeta(id);
	if (!meta) return null;
	return {
		id: meta.id,
		title: meta.title,
		createdAt: meta.createdAt,
		updatedAt: meta.updatedAt,
		messages: await loadMessages(_database, id),
	};
}

async function bumpIndex(
	userId: string,
	repoFullName: string,
	sessionId: string,
	update: (entry: IndexEntry) => IndexEntry,
): Promise<void> {
	await mutate<IndexEntry>(
		indexKey(userId, repoFullName, sessionId),
		{ id: sessionId, title: "New chat", updatedAt: now(), messageCount: 0 },
		update,
	);
}

export async function appendMessage(
	_database: SqlDatabase,
	sessionId: string,
	message: StoredMessage,
): Promise<void> {
	await mutate<StoredMessage[]>(messagesKey(sessionId), [], (messages) => [...messages, message]);
	const meta = await readMeta(sessionId);
	if (!meta) return;
	await mutateExisting<SessionMeta>(metaKey(sessionId), (current) => ({
		...current,
		updatedAt: now(),
	}));
	await bumpIndex(meta.userId, meta.repoFullName, sessionId, (entry) => ({
		...entry,
		updatedAt: now(),
		messageCount: entry.messageCount + 1,
	}));
}

export async function touchSession(_database: SqlDatabase, sessionId: string): Promise<void> {
	const meta = await readMeta(sessionId);
	if (!meta) return;
	await mutateExisting<SessionMeta>(metaKey(sessionId), (current) => ({
		...current,
		updatedAt: now(),
	}));
	await bumpIndex(meta.userId, meta.repoFullName, sessionId, (entry) => ({
		...entry,
		updatedAt: now(),
	}));
}

export async function updateTitle(
	_database: SqlDatabase,
	sessionId: string,
	title: string,
): Promise<void> {
	const meta = await readMeta(sessionId);
	if (!meta) return;
	await mutateExisting<SessionMeta>(metaKey(sessionId), (current) => ({
		...current,
		title,
		updatedAt: now(),
	}));
	await bumpIndex(meta.userId, meta.repoFullName, sessionId, (entry) => ({
		...entry,
		title,
		updatedAt: now(),
	}));
}

export async function attachChangeIds(
	_database: SqlDatabase,
	sessionId: string,
	changeIds: string[],
): Promise<void> {
	if (!changeIds.length) return;
	await mutate<StoredMessage[]>(messagesKey(sessionId), [], (messages) => {
		const index = [...messages].reverse().findIndex((message) => message.role === "user");
		if (index < 0) return messages;
		const at = messages.length - 1 - index;
		const current = messages[at];
		const merged = [...new Set([...(current.changeIds ?? []), ...changeIds])];
		const next = [...messages];
		next[at] = { ...current, changeIds: merged };
		return next;
	});
}

// --- çalışmalar ----------------------------------------------------------------

export async function createRun(
	_database: SqlDatabase,
	runId: string,
	sessionId: string,
): Promise<void> {
	const createdAt = now();
	const meta: RunMeta = {
		id: runId,
		sessionId,
		status: "running",
		stopRequested: false,
		createdAt,
		updatedAt: createdAt,
	};
	await putJson(runMetaKey(runId), meta);
	await mutateExisting<SessionMeta>(metaKey(sessionId), (current) => ({
		...current,
		lastRunId: runId,
	}));
}

const eventChains = new Map<string, Promise<void>>();
const eventTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingEvents = new Map<string, AgentEvent[]>();
const eventCaches = new Map<string, { keys: Set<string>; events: AgentEvent[] }>();
let batchCounter = 0;

async function flushEvents(runId: string): Promise<void> {
	const buffered = pendingEvents.get(runId);
	if (!buffered?.length) return;
	const batch = buffered.splice(0, buffered.length);
	const key = `${runEventsPrefix(runId)}${String(Date.now()).padStart(13, "0")}-${String(
		batchCounter++,
	).padStart(4, "0")}.json`;
	await putJson(key, batch);
	const cache = eventCaches.get(runId);
	if (cache && !cache.keys.has(key)) {
		cache.keys.add(key);
		cache.events.push(...batch);
	}
}

function scheduleFlush(runId: string): void {
	if (eventTimers.has(runId)) return;
	const timer = setTimeout(() => {
		eventTimers.delete(runId);
		const chain = (eventChains.get(runId) ?? Promise.resolve()).then(() =>
			flushEvents(runId).catch(() => undefined),
		);
		eventChains.set(runId, chain);
	}, 350);
	eventTimers.set(runId, timer);
}

export async function appendEvent(
	_database: SqlDatabase,
	runId: string,
	event: AgentEvent,
): Promise<void> {
	const buffered = pendingEvents.get(runId) ?? [];
	buffered.push(event);
	pendingEvents.set(runId, buffered);
	scheduleFlush(runId);
}

async function flushNow(runId: string): Promise<void> {
	const timer = eventTimers.get(runId);
	if (timer) {
		clearTimeout(timer);
		eventTimers.delete(runId);
	}
	await (eventChains.get(runId) ?? Promise.resolve());
	await flushEvents(runId).catch(() => undefined);
}

export async function finishRun(
	_database: SqlDatabase,
	runId: string,
	status: "done" | "error" | "stopped",
): Promise<void> {
	await flushNow(runId);
	await mutateExisting<RunMeta>(runMetaKey(runId), (current) => ({
		...current,
		status,
		updatedAt: now(),
	}));
}

export async function requestStop(
	_database: SqlDatabase,
	sessionId: string,
): Promise<string | null> {
	const meta = await readMeta(sessionId);
	if (!meta?.lastRunId) return null;
	const run = await mutateExisting<RunMeta>(runMetaKey(meta.lastRunId), (current) => ({
		...current,
		stopRequested: true,
	}));
	if (!run) return null;
	return run.id;
}

const stopCache = new Map<string, { value: boolean; at: number }>();

export async function isStopRequested(_database: SqlDatabase, runId: string): Promise<boolean> {
	const cached = stopCache.get(runId);
	if (cached && Date.now() - cached.at < 1000) return cached.value;
	const run = (await readJson<RunMeta>(runMetaKey(runId)))?.value;
	const value = Boolean(run?.stopRequested);
	stopCache.set(runId, { value, at: Date.now() });
	return value;
}

export async function getRun(
	_database: SqlDatabase,
	sessionId: string,
	runId?: string,
): Promise<{ id: string; status: string; stop_requested: number } | null> {
	let target = runId;
	if (!target) {
		const meta = await readMeta(sessionId);
		target = meta?.lastRunId;
	}
	if (!target) return null;
	const run = (await readJson<RunMeta>(runMetaKey(target)))?.value;
	if (!run || run.sessionId !== sessionId) return null;
	return { id: run.id, status: run.status, stop_requested: run.stopRequested ? 1 : 0 };
}

async function runEvents(runId: string): Promise<AgentEvent[]> {
	const keys = (await listKeys(runEventsPrefix(runId))).sort();
	const cache = eventCaches.get(runId);
	if (!cache) {
		const events: AgentEvent[] = [];
		const seen = new Set<string>();
		for (const key of keys) {
			const value = (await readJson<AgentEvent[]>(key))?.value;
			if (!value) continue;
			seen.add(key);
			events.push(...value);
		}
		eventCaches.set(runId, { keys: seen, events });
		return events;
	}
	const fresh = keys.filter((key) => !cache.keys.has(key));
	for (const key of fresh) {
		const value = (await readJson<AgentEvent[]>(key))?.value;
		if (!value) continue;
		cache.keys.add(key);
		cache.events.push(...value);
	}
	return cache.events;
}

export async function readEvents(
	_database: SqlDatabase,
	sessionId: string,
	runId: string | undefined,
	cursor: number,
): Promise<{ events: AgentEvent[]; cursor: number; done: boolean; runId?: string }> {
	const run = await getRun(_database, sessionId, runId);
	if (!run) return { events: [], cursor, done: true };
	const events = await runEvents(run.id);
	const start = Math.max(0, cursor);
	return {
		events: events.slice(start),
		cursor: events.length,
		done: run.status !== "running",
		runId: run.id,
	};
}

// --- geri alınabilir yazmalar ----------------------------------------------------

export async function recordChange(
	_database: SqlDatabase,
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
	const record: ChangeRecord = {
		id: input.id,
		kind: input.kind,
		path: input.path,
		label: input.label,
		before: input.before,
		after: input.after,
		reverted: 0,
		ts: now(),
	};
	await mutate<ChangeRecord[]>(changesKey(input.userId, input.repoFullName), [], (changes) => [
		...changes,
		record,
	]);
}

export async function latestChange(
	_database: SqlDatabase,
	userId: string,
	repoFullName: string,
	changeId?: string,
): Promise<ChangeRecord | null> {
	const changes =
		(await readJson<ChangeRecord[]>(changesKey(userId, repoFullName)))?.value ?? [];
	const open = changes.filter((change) => !change.reverted);
	if (changeId) return open.find((change) => change.id === changeId) ?? null;
	return open.sort((a, b) => b.ts.localeCompare(a.ts))[0] ?? null;
}

export async function markChangeReverted(
	_database: SqlDatabase,
	id: string,
	userId?: string,
	repoFullName?: string,
): Promise<void> {
	if (!userId || !repoFullName) return;
	await mutate<ChangeRecord[]>(changesKey(userId, repoFullName), [], (changes) =>
		changes.map((change) => (change.id === id ? { ...change, reverted: 1 } : change)),
	);
}

export { newId };
