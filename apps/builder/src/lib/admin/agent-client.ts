// Ajan istemcisi — widget'ın /api/agent uçlarıyla konuştuğu tipli katman
// (ADR 0008). fetch-atom önbelleği yok; sohbet durumu widget hook'undadır.

import type {
	AgentStatus,
	PromptContext,
	SessionSummary,
	StoredMessage,
	AgentEvent,
} from "@/lib/agent/protocol";

export type { AgentEvent, AgentStatus, PromptContext, SessionSummary, StoredMessage };

export class AgentApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "AgentApiError";
	}
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, { credentials: "same-origin", ...init });
	if (!res.ok) {
		let message = `İstek başarısız (${res.status})`;
		try {
			const data = (await res.json()) as { message?: string; error?: string };
			if (data.message) message = data.message;
			else if (data.error) message = data.error;
		} catch {
			// JSON değil
		}
		throw new AgentApiError(res.status, message);
	}
	return (await res.json()) as T;
}

const json = (body: unknown): RequestInit => ({
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify(body),
});

export function getAgentStatus(): Promise<AgentStatus> {
	return request("/api/agent/status");
}

export function sendPrompt(input: {
	full_name: string;
	branch?: string;
	sessionId?: string;
	message: string;
	provider?: "openai" | "gemini" | "anthropic";
	model?: string;
	context?: PromptContext;
}): Promise<{ sessionId: string; runId: string }> {
	return request("/api/agent/prompt", json(input));
}

export function getEvents(input: {
	sessionId: string;
	runId?: string;
	cursor: number;
}): Promise<{ events: AgentEvent[]; cursor: number; done: boolean; runId?: string }> {
	const params = new URLSearchParams({
		sessionId: input.sessionId,
		cursor: String(input.cursor),
	});
	if (input.runId) params.set("runId", input.runId);
	return request(`/api/agent/events?${params}`);
}

export function stopRun(sessionId: string): Promise<{ ok: boolean; runId?: string }> {
	return request("/api/agent/stop", json({ sessionId }));
}

export function listAgentSessions(fullName: string): Promise<{ sessions: SessionSummary[] }> {
	return request(`/api/agent/sessions?full_name=${encodeURIComponent(fullName)}`);
}

export function getAgentSession(id: string): Promise<{
	session: { id: string; title: string; messages: StoredMessage[] } | null;
}> {
	return request(`/api/agent/session?id=${encodeURIComponent(id)}`);
}

export function deleteAgentSession(id: string): Promise<{ ok: boolean }> {
	return request(`/api/agent/session?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getAgentPages(
	fullName: string,
	branch?: string,
): Promise<{ pages: Array<{ url: string; title: string }>; siteUrl: string | null; branch: string }> {
	const params = new URLSearchParams({ full_name: fullName });
	if (branch) params.set("branch", branch);
	return request(`/api/agent/pages?${params}`);
}

export function undoAgentChange(input: {
	full_name: string;
	branch?: string;
	changeId?: string;
}): Promise<{ ok: boolean; reverted: boolean; changeId?: string; path?: string; error?: string }> {
	return request("/api/agent/undo", json(input));
}
