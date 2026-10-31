// Sohbet durumu: transkript, olay polling'i, oturumlar ve geri alma.
// Tüm HTTP `lib/admin/agent-client` üzerinden; bileşenler yalnız çizer.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent, SessionSummary, StoredMessage } from "@/lib/agent/protocol";
import * as client from "@/lib/admin/agent-client";
import { t } from "@/lib/i18n";
import type { ModelChoice, PickedElement, QueuedPrompt, ToolChip } from "../types";

const KEY_RUN = "wuppycms:agent:run";


function sessionStore(key: string, value?: string | null): string | null {
	try {
		if (value === undefined) return sessionStorage.getItem(key);
		if (value === null) sessionStorage.removeItem(key);
		else sessionStorage.setItem(key, value);
	} catch {
		return null;
	}
	return null;
}

export interface AgentChatOptions {
	fullName: string;
	branch: string;
	siteUrl: string | null;
	document: { collection: string; path: string } | null;
	pagePath: string | null;
	selections: PickedElement[];
	model: ModelChoice | null;
	insertMode: boolean;
	onContentChanged(tools?: ToolChip[]): void;
	onClearSelections(): void;
	/** Prompt gerçekten başladığında (kuyruktan çıkınca da) çağrılır. */
	onPromptStart?(context: AgentChatOptions): void;
}

type QueueEntry = { id: string; text: string; context: AgentChatOptions };

export interface AgentChatApi {
	messages: StoredMessage[];
	stream: string;
	tools: ToolChip[];
	note: string;
	error: string;
	busy: boolean;
	elapsed: number;
	undoing: string | null;
	queued: QueuedPrompt[];
	sessions: SessionSummary[];
	sessionsLoading: boolean;
	sessionLoading: boolean;
	activeSessionId: string | null;
	draft: string;
	setDraft(value: string): void;
	setError(value: string): void;
	send(text?: string): void;
	stop(): void;
	openSession(id: string | null): void;
	refreshSessions(): void;
	undo(changeId?: string): void;
}

export function useAgentChat(options: AgentChatOptions): AgentChatApi {
	const [messages, setMessages] = useState<StoredMessage[]>([]);
	const [stream, setStream] = useState("");
	const [tools, setTools] = useState<ToolChip[]>([]);
	// State render beklemeden, aynı turda güncel araç listesi (iyimser yama için).
	const toolsRef = useRef<ToolChip[]>([]);
	const [note, setNote] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const [elapsed, setElapsed] = useState(0);
	const [queued, setQueued] = useState<QueuedPrompt[]>([]);
	const [undoing, setUndoing] = useState<string | null>(null);
	const undoInFlight = useRef(false);
	const [sessions, setSessions] = useState<SessionSummary[]>([]);
	const [sessionsLoading, setSessionsLoading] = useState(false);
	const [sessionLoading, setSessionLoading] = useState(false);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [draft, setDraft] = useState("");

	const sessionId = useRef<string | null>(null);
	const runId = useRef<string | null>(null);
	const cursor = useRef(0);
	const poll = useRef<ReturnType<typeof setInterval> | null>(null);
	const startedAt = useRef(0);
	const lastEventAt = useRef(0);
	const inFlight = useRef(false);
	const contentChanged = useRef(false);
	const filesChanged = useRef(false);
	const sessionsRequest = useRef(0);
	const sessionRequest = useRef(0);
	const queueRef = useRef<QueueEntry[]>([]);
	const startPromptRef = useRef<(text: string, context: AgentChatOptions) => void>(() => {});
	const drainRef = useRef<() => void>(() => {});

	// Seçim/bağlam her zaman en güncel hâliyle gönderilsin.
	const live = useRef(options);
	live.current = options;

	const stopPoll = useCallback(() => {
		if (poll.current) {
			clearInterval(poll.current);
			poll.current = null;
		}
	}, []);

	useEffect(() => stopPoll, [stopPoll]);

	useEffect(() => {
		if (!busy) return;
		const tick = () => setElapsed(Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)));
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, [busy]);

	const renderStored = useCallback((stored: StoredMessage[]) => {
		setMessages(stored);
		setTools([]);
		setStream("");
	}, []);

	const refreshSessions = useCallback(() => {
		const fullName = live.current.fullName;
		if (!fullName) {
			setSessions([]);
			setSessionsLoading(false);
			return;
		}
		const request = ++sessionsRequest.current;
		setSessionsLoading(true);
		client
			.listAgentSessions(fullName)
			.then((data) => {
				if (request === sessionsRequest.current) setSessions(data.sessions);
			})
			.catch(() => {
				if (request === sessionsRequest.current) setSessions([]);
			})
			.finally(() => {
				if (request === sessionsRequest.current) setSessionsLoading(false);
			});
	}, []);

	// Widget kapalıyken de önceden yükle: panel açıldığında geçmiş hazır olsun.
	useEffect(() => {
		if (!options.fullName) return;
		refreshSessions();
	}, [options.fullName, refreshSessions]);

	const startPoll = useCallback(() => {
		stopPoll();
		const applyEvent = (event: AgentEvent) => {
			if (event.type === "assistant_text_delta") setStream((current) => current + event.text);
			else if (event.type === "tool_started") {
				const next = [
					...toolsRef.current,
					{ callId: event.callId, name: event.name, args: event.args, running: true },
				];
				toolsRef.current = next;
				setTools(next);
			} else if (event.type === "tool_done") {
				if (event.ok && (event.name === "content_publish" || event.name === "content_unpublish")) {
					contentChanged.current = true;
				}
				if (
					event.ok &&
					(event.name === "edit_file" ||
						event.name === "write_file" ||
						event.name === "content_update" ||
						event.name === "content_create" ||
						event.name === "undo_last_change")
				) {
					filesChanged.current = true;
				}
				const next = toolsRef.current.map((chip) =>
					chip.callId === event.callId
						? { ...chip, running: false, ok: event.ok, summary: event.summary }
						: chip,
				);
				toolsRef.current = next;
				setTools(next);
			} else if (event.type === "run_error") setError(event.message);
		};

		poll.current = setInterval(() => {
			const id = sessionId.current;
			if (!id || inFlight.current) return;
			if (lastEventAt.current && Date.now() - lastEventAt.current > 180_000) {
				stopPoll();
				setBusy(false);
				setError(t("widget.timeout"));
				drainRef.current();
				return;
			}
			inFlight.current = true;
			client
				.getEvents({ sessionId: id, runId: runId.current ?? undefined, cursor: cursor.current })
				.then((res) => {
					lastEventAt.current = Date.now();
					if (res.runId) runId.current = res.runId;
					res.events.forEach(applyEvent);
					cursor.current = res.cursor;
					if (!res.done) return;
					stopPoll();
					setBusy(false);
					const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
					setElapsed(seconds);
					setNote(t("widget.done", { seconds }));
					setStream("");
					sessionStore(KEY_RUN, null);
					if (contentChanged.current || filesChanged.current) {
						contentChanged.current = false;
						filesChanged.current = false;
						live.current.onContentChanged(toolsRef.current);
					}
					client
						.getAgentSession(id)
						.then((data) => {
							if (data.session) renderStored(data.session.messages);
						})
						.catch(() => undefined)
						.finally(() => drainRef.current());
					refreshSessions();
				})
				.catch((err: Error) => {
					stopPoll();
					setBusy(false);
					setError(err.message);
					drainRef.current();
				})
				.finally(() => {
					inFlight.current = false;
				});
		}, 400);
	}, [refreshSessions, renderStored, stopPoll]);

	// 15 dk içindeki bir koşuya yeniden bağlan (sayfa yenilemesi).
	useEffect(() => {
		const raw = sessionStore(KEY_RUN);
		if (!raw) return;
		try {
			const saved = JSON.parse(raw) as { sessionId?: string; runId?: string; at?: number };
			if (!saved.sessionId || Date.now() - (saved.at ?? 0) > 15 * 60_000) {
				sessionStore(KEY_RUN, null);
				return;
			}
			sessionId.current = saved.sessionId;
			runId.current = saved.runId ?? null;
			cursor.current = 0;
			startedAt.current = saved.at ?? Date.now();
			setElapsed(Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)));
			setActiveSessionId(saved.sessionId);
			setBusy(true);
			setNote(t("widget.reattached"));
			client
				.getAgentSession(saved.sessionId)
				.then((data) => {
					if (data.session) renderStored(data.session.messages);
				})
				.catch(() => undefined);
			startPoll();
		} catch {
			sessionStore(KEY_RUN, null);
		}
	}, [renderStored, startPoll]);

	const startPrompt = useCallback(
		(text: string, context: AgentChatOptions) => {
			const picked = context.selections;
			const insert = context.insertMode;
			setError("");
			setNote("");
			setBusy(true);
			setElapsed(0);
			setMessages((current) => [
				...current,
				{
					role: "user",
					text: picked.length ? `${text} · ${picked.length} element(s)` : text,
					ts: new Date().toISOString(),
				},
			]);
			startedAt.current = Date.now();
			lastEventAt.current = Date.now();
			context.onPromptStart?.(context);
			const model = context.model;
			client
				.sendPrompt({
					full_name: context.fullName,
					branch: context.branch || undefined,
					sessionId: sessionId.current ?? undefined,
					message: text,
					...(model ? { provider: model.provider, model: model.model } : {}),
					context: {
						document: context.document,
						pagePath: context.pagePath,
						selections: picked.map((selection) => ({
							tag: selection.tag,
							label: selection.label,
							text: selection.text,
							html: selection.html,
							path: selection.path,
							...(insert ? { position: selection.position ?? "after" } : {}),
							content: selection.content ?? null,
						})),
					},
				})
				.then((data) => {
					sessionId.current = data.sessionId;
					setActiveSessionId(data.sessionId);
					runId.current = data.runId;
					cursor.current = 0;
					refreshSessions();
					sessionStore(
						KEY_RUN,
						JSON.stringify({ sessionId: data.sessionId, runId: data.runId, at: Date.now() }),
					);
					startPoll();
				})
				.catch((err: Error) => {
					setBusy(false);
					setError(err.message);
					drainRef.current();
				});
		},
		[refreshSessions, startPoll],
	);

	const drainQueue = useCallback(() => {
		const next = queueRef.current.shift();
		setQueued(queueRef.current.map(({ id, text }) => ({ id, text })));
		if (!next) return;
		startPromptRef.current(next.text, next.context);
	}, []);

	const send = useCallback(
		(override?: string) => {
			const text = (override ?? draft).trim();
			const context = live.current;
			if (!text) return;
			if (!context.fullName) {
				setError(t("widget.selectSite"));
				return;
			}
			if (!override) setDraft("");
			context.onClearSelections();
			if (busy) {
				const entry: QueueEntry = {
					id: `q_${Date.now()}_${Math.random().toString(36).slice(2)}`,
					text,
					context,
				};
				queueRef.current.push(entry);
				setQueued(queueRef.current.map(({ id, text }) => ({ id, text })));
				return;
			}
			startPrompt(text, context);
		},
		[busy, draft, startPrompt],
	);

	startPromptRef.current = startPrompt;
	drainRef.current = drainQueue;

	const stop = useCallback(() => {
		const id = sessionId.current;
		if (!id) return;
		setNote(t("widget.stopping"));
		client.stopRun(id).catch((err: Error) => setError(err.message));
	}, []);

	const openSession = useCallback(
		(id: string | null) => {
			stopPoll();
			queueRef.current = [];
			setQueued([]);
			setBusy(false);
			setStream("");
			toolsRef.current = [];
			setTools([]);
			setError("");
			setNote("");
			setElapsed(0);
			cursor.current = 0;
			runId.current = null;
			sessionId.current = id;
			setActiveSessionId(id);
			const request = ++sessionRequest.current;
			setSessionLoading(Boolean(id));
			if (!id) {
				setMessages([]);
				return;
			}
			// Önceki sohbetin mesajlarını seçim anında temizle; yeni oturum
			// gelene kadar eski transkript görünmesin.
			setMessages([]);
			client
				.getAgentSession(id)
				.then((data) => {
					if (request !== sessionRequest.current) return;
					if (data.session) renderStored(data.session.messages);
				})
				.catch((err: Error) => {
					if (request !== sessionRequest.current) return;
					setError(`${t("widget.history")}: ${err.message}`);
				})
				.finally(() => {
					if (request === sessionRequest.current) setSessionLoading(false);
				});
		},
		[renderStored, stopPoll],
	);

	const undo = useCallback((changeId?: string) => {
		if (undoInFlight.current) return;
		undoInFlight.current = true;
		setUndoing(changeId ?? "__latest__");
		const context = live.current;
		client
			.undoAgentChange({
				full_name: context.fullName,
				branch: context.branch || undefined,
				changeId,
			})
			.then((res) => {
				if (!res.ok) {
					setError(res.error ?? t("widget.undo"));
					return;
				}
				setError("");
				setNote(t("widget.undone"));
				const undone = res.changeId ?? changeId;
				setMessages((rows) =>
					rows.map((message) =>
						undone && message.changeIds?.includes(undone)
							? { ...message, changeIds: message.changeIds.filter((id) => id !== undone) }
							: message,
					),
				);
				context.onContentChanged();
			})
			.catch((err: Error) => setError(err.message))
			.finally(() => {
				undoInFlight.current = false;
				setUndoing(null);
			});
	}, []);

	return {
		messages,
		stream,
		tools,
		note,
		error,
		busy,
		elapsed,
		undoing,
		queued,
		sessions,
		sessionsLoading,
		sessionLoading,
		activeSessionId,
		draft,
		setDraft,
		setError,
		send,
		stop,
		openSession,
		refreshSessions,
		undo,
	};
}
