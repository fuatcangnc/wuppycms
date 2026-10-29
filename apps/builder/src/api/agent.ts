// Ajan API'si — widget oturumları, prompt, olay polling'i, durdurma ve undo
// (ADR 0008). Kimlik better-auth oturumundan; git token'ı mevcut çözümden.
// Anahtar tarayıcıya dönmez, loglanmaz.

import { Hono } from "hono";
import { decryptToken } from "../lib/crypto";
import { commitFiles, getFile, getRepo, listTree } from "../lib/git";
import { BackendError } from "../lib/git/backend";
import type { ProviderConfig } from "../lib/agent/protocol";
import { MODEL_CATALOG, PROVIDER_DEFAULTS, resolveProvider } from "../lib/agent/providers";
import { runAgent } from "../lib/agent/loop";
import {
	appendMessage,
	createRun,
	createSession,
	deleteSession,
	getSessionRow,
	latestChange,
	listSessions,
	loadSession,
	markChangeReverted,
	removeChangeIdFromMessages,
	newId,
	readEvents,
	requestStop,
} from "../lib/agent/store";
import type { AppEnv } from "./types";
import { platform, requireQuery, requireUser, resolveGitToken, unauthorized } from "./helpers";
import { agentPromptSchema, agentSessionSchema, agentUndoSchema, body } from "./schemas";

export const agent = new Hono<{ Bindings: AppEnv }>();

type AiProvider = "openai" | "gemini" | "anthropic";

function normalizeProvider(value: string | null | undefined): AiProvider | null {
	if (value === "gemini" || value === "anthropic" || value === "openai") return value;
	return null;
}

function withProtocol(url: string): string {
	const trimmed = url.trim().replace(/\/+$/, "");
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function readSiteUrl(token: string, fullName: string, branch: string): Promise<string | null> {
	try {
		const file = await getFile(token, fullName, ".wuppycms/sites.jsonc", branch);
		// JSONC — yorumları ayıkla, ilk url alanını al (tam parser'a gerek yok).
		const match = file.content.match(/"url"\s*:\s*"([^"]+)"/);
		return match?.[1]?.replace(/\/+$/, "") ?? null;
	} catch (error) {
		if (error instanceof BackendError && error.status === 404) return null;
		return null;
	}
}

/** Kayıtlı BYO AI ayarını çözer; anahtar yalnız bu istek boyunca bellekte. */
async function resolveAiConfig(
	c: Parameters<typeof requireUser>[0],
	userId: string,
	overrideProvider?: AiProvider,
	overrideModel?: string,
): Promise<ProviderConfig | null> {
	const db = platform(c).db;
	if (!db) return null;
	const row = await db
		.prepare("SELECT provider, base_url, model, api_key_encrypted FROM ai_settings WHERE user_id = ?")
		.bind(userId)
		.first<{
			provider: string;
			base_url: string;
			model: string;
			api_key_encrypted: string | null;
		}>();
	if (!row) return null;
	const provider = overrideProvider ?? normalizeProvider(row.provider) ?? "openai";
	const apiKey = row.api_key_encrypted
		? await decryptToken(row.api_key_encrypted, c.env.TOKEN_ENCRYPTION_KEY)
		: "";
	const isOpenAiCompatible = provider === "openai";
	const isLocalBase = row.base_url && row.base_url !== PROVIDER_DEFAULTS.openai.baseUrl;
	// Anahtarsız yalnız yerel/uyumlu sunucu (ör. Ollama) çalışabilir.
	if (!apiKey && !(isOpenAiCompatible && isLocalBase)) return null;
	const sameProvider = provider === (normalizeProvider(row.provider) ?? "openai");
	return {
		provider,
		baseUrl: sameProvider ? row.base_url : PROVIDER_DEFAULTS[provider].baseUrl,
		model:
			overrideModel ||
			(sameProvider ? row.model : PROVIDER_DEFAULTS[provider].model) ||
			PROVIDER_DEFAULTS[provider].model,
		apiKey,
	};
}

function waitUntil(c: Parameters<typeof requireUser>[0], promise: Promise<unknown>): void {
	const ctx = (c as unknown as { executionCtx?: { waitUntil(value: Promise<unknown>): void } })
		.executionCtx;
	if (ctx) ctx.waitUntil(promise);
	else void promise;
}

/** Oturum sahibi + repo eşleşmesi. */
async function ownedSession(
	db: NonNullable<ReturnType<typeof platform>["db"]>,
	sessionId: string,
	userId: string,
) {
	const row = await getSessionRow(db, sessionId);
	if (!row || row.user_id !== userId) return null;
	return row;
}

// GET /api/agent/status — kayıtlı sağlayıcı ve model kataloğu (anahtar sızmaz).
agent.get("/status", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	const row = db
		? await db
				.prepare("SELECT provider, base_url, model, api_key_encrypted FROM ai_settings WHERE user_id = ?")
				.bind(user.id)
				.first<{ provider: string; base_url: string; model: string; api_key_encrypted: string | null }>()
		: null;
	const provider = normalizeProvider(row?.provider);
	const hasKey = Boolean(row?.api_key_encrypted);
	const isLocal = Boolean(row && row.base_url && row.base_url !== PROVIDER_DEFAULTS.openai.baseUrl);
	const models = provider
		? MODEL_CATALOG[provider].map((entry) => ({
				id: `${provider}:${entry.id}`,
				label: entry.label,
				provider,
				model: entry.id,
			}))
		: [];
	return c.json({
		dev: Boolean(c.env.GITHUB_TOKEN),
		configured: Boolean(row && (hasKey || (provider === "openai" && isLocal))),
		provider,
		model: row?.model ?? null,
		baseUrl: row?.base_url ?? null,
		models,
	});
});

// POST /api/agent/prompt — oturum açar (ya da sürdürür), koşuyu başlatır.
agent.post("/prompt", body(agentPromptSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const token = await resolveGitToken(c, payload.full_name);
	if (!token) return unauthorized(c);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured", message: "D1 bağlı değil." }, 503);

	const providerOverride = payload.provider;
	const config = await resolveAiConfig(c, user.id, providerOverride, payload.model);
	if (!config) {
		return c.json(
			{
				error: "ai_not_configured",
				message:
					"AI sağlayıcısı ayarlı değil. Admin → Ajan → Sağlayıcı sekmesinden bir anahtar kaydedin.",
			},
			400,
		);
	}

	const fullName = payload.full_name;
	const repo = await getRepo(token, fullName);
	const branch = payload.branch || repo.defaultBranch;

	let sessionId = payload.sessionId;
	if (sessionId) {
		const existing = await ownedSession(db, sessionId, user.id);
		if (!existing) return c.json({ error: "session_not_found", message: "Sohbet bulunamadı." }, 404);
		if (existing.repo_full_name !== fullName) {
			return c.json({ error: "session_repo_mismatch", message: "Sohbet başka bir repoya ait." }, 400);
		}
	} else {
		sessionId = newId("ses");
		await createSession(db, {
			id: sessionId,
			userId: user.id,
			repoFullName: fullName,
			title: "New chat",
		});
	}

	const selections = payload.context?.selections ?? [];
	// Kullanıcı mesajı TEMİZ saklanır; seçim bağlamı sistem istemine eklenir
	// (sohbette ham [SELECTED ELEMENTS] bloğu görünmesin).
	const userMessage = payload.message;
	await appendMessage(db, sessionId, {
		role: "user",
		text: userMessage,
		ts: new Date().toISOString(),
	});

	const runId = newId("run");
	await createRun(db, runId, sessionId);

	const provider = resolveProvider(config);
	const siteUrl = await readSiteUrl(token, fullName, branch);
	waitUntil(
		c,
		runAgent({
			db,
			provider,
			runId,
			sessionId,
			userId: user.id,
			token,
			fullName,
			branch,
			siteUrl,
			document: payload.context?.document ?? null,
			pagePath: payload.context?.pagePath ?? null,
			selections,
			userText: payload.message,
		}),
	);

	return c.json({ sessionId, runId });
});

// GET /api/agent/events?sessionId=…&runId=…&cursor=0 — polling.
agent.get("/events", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);
	const sessionId = requireQuery(c, "sessionId");
	const existing = await ownedSession(db, sessionId, user.id);
	if (!existing) return c.json({ error: "session_not_found" }, 404);
	const cursor = Number.parseInt(c.req.query("cursor") ?? "0", 10);
	const runId = c.req.query("runId") || undefined;
	return c.json(await readEvents(db, sessionId, runId, Number.isFinite(cursor) ? cursor : 0));
});

// POST /api/agent/stop — çalışan turu adım sınırında durdur.
agent.post("/stop", body(agentSessionSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);
	const { sessionId } = c.req.valid("json");
	if (!(await ownedSession(db, sessionId, user.id))) {
		return c.json({ error: "session_not_found" }, 404);
	}
	const runId = await requestStop(db, sessionId);
	return c.json({ ok: Boolean(runId), runId });
});

// GET /api/agent/sessions?full_name=…
agent.get("/sessions", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ sessions: [] });
	const sessions = await listSessions(db, user.id, requireQuery(c, "full_name"));
	return c.json({ sessions });
});

// GET /api/agent/session?id=…
agent.get("/session", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);
	const id = requireQuery(c, "id");
	if (!(await ownedSession(db, id, user.id))) return c.json({ error: "session_not_found" }, 404);
	const session = await loadSession(db, id);
	return c.json({ session });
});

// DELETE /api/agent/session?id=…
agent.delete("/session", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);
	const id = requireQuery(c, "id");
	if (!(await ownedSession(db, id, user.id))) return c.json({ error: "session_not_found" }, 404);
	await deleteSession(db, id);
	return c.json({ ok: true });
});

// GET /api/agent/pages?full_name=…&branch=… — önizleme sayfa envanteri.
agent.get("/pages", async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const fullName = requireQuery(c, "full_name");
	const token = await resolveGitToken(c, fullName);
	if (!token) return unauthorized(c);
	const repo = await getRepo(token, fullName);
	const branch = c.req.query("branch") || repo.defaultBranch;
	const siteUrl = (await readSiteUrl(token, fullName, branch)) ?? "";
	const base = siteUrl ? withProtocol(siteUrl) : "";
	const tree = await listTree(token, fullName, branch, true);
	const seen = new Set<string>();
	const pages: Array<{ url: string; title: string }> = [];
	for (const entry of tree.entries) {
		if (entry.type !== "blob" || !entry.path.startsWith("src/pages/")) continue;
		if (!/\.(astro|md|mdx)$/.test(entry.path)) continue;
		let route = entry.path.replace(/^src\/pages/, "").replace(/\.(astro|md|mdx)$/, "");
		route = route.replace(/\/index$/, "") || "/";
		if (route.includes("[") || seen.has(route)) continue;
		seen.add(route);
		const url = base ? `${base}${route === "/" ? "/" : route}` : route;
		const title =
			route === "/" ? "Home" : route.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") ?? route;
		pages.push({ url, title });
	}
	if (!pages.length && siteUrl) pages.push({ url: siteUrl, title: "Home" });
	pages.sort((a, b) => a.url.localeCompare(b.url));
	return c.json({ pages: pages.slice(0, 120), siteUrl: siteUrl || null, branch });
});

// POST /api/agent/undo — son (ya da verilen) yazmayı geri commit'ler.
agent.post("/undo", body(agentUndoSchema), async (c) => {
	const user = await requireUser(c);
	if (!user) return c.json({ error: "unauthenticated" }, 401);
	const payload = c.req.valid("json");
	const token = await resolveGitToken(c, payload.full_name);
	if (!token) return unauthorized(c);
	const db = platform(c).db;
	if (!db) return c.json({ error: "not_configured" }, 503);
	const repo = await getRepo(token, payload.full_name);
	const branch = payload.branch || repo.defaultBranch;
	const change = await latestChange(db, user.id, payload.full_name, payload.changeId);
	if (!change || !change.path) {
		return c.json({ ok: false, error: "Geri alınacak bir değişiklik yok." }, 400);
	}
	if (change.before === null) {
		await commitFiles(
			token,
			payload.full_name,
			branch,
			[{ path: change.path, content: "", delete: true }],
			`AI: ${change.path} geri alındı (via WuppyCMS)`,
		);
	} else {
		await commitFiles(
			token,
			payload.full_name,
			branch,
			[{ path: change.path, content: change.before }],
			`AI: ${change.path} geri alındı (via WuppyCMS)`,
		);
	}
	await markChangeReverted(db, change.id);
	await removeChangeIdFromMessages(db, change.id);
	return c.json({ ok: true, reverted: true, changeId: change.id, path: change.path });
});
