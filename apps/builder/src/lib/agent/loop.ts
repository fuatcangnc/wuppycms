// Ajan döngüsü — sağlayıcıdan bağımsız tool-calling state machine (ADR 0008).
// Olaylar D1'e yazılır; istemci polling ile tüketir. Yazma yapan her araç
// değişikliği `agent_changes`e kaydeder ve `content_changed` olayı yayar.

import type { SqlDatabase } from "../platform";
import { buildTools, type ChangeInfo, type ToolContext } from "./tools";
import {
	appendEvent,
	appendMessage,
	attachChangeIds,
	finishRun,
	isStopRequested,
	loadMessages,
	touchSession,
	updateTitle,
} from "./store";
import type {
	ChatMessage,
	Provider,
	SelectionContext,
	StoredMessage,
	ToolSpec,
	AgentEvent,
} from "./protocol";

// Büyük şablonlarda (çok sayfalı siteler) tek koşuda bitmesi için geniş tutuldu.
const MAX_STEPS = 64;
const TOOL_RESULT_LIMIT = 8_000;
/** Yazma yapan araçlar — kısa düzenlemelerde okuma turunu kesmek için. */
const WRITE_TOOLS = new Set([
	"edit_file",
	"write_file",
	"content_update",
	"content_create",
	"content_publish",
	"content_unpublish",
	"undo_last_change",
]);

function now(): string {
	return new Date().toISOString();
}

export interface RunAgentInput {
	db: SqlDatabase;
	provider: Provider;
	runId: string;
	sessionId: string;
	userId: string;
	token: string;
	fullName: string;
	branch: string;
	siteUrl: string | null;
	document?: { collection: string; path: string } | null;
	pagePath?: string | null;
	selections?: SelectionContext[];
	/** İlk kullanıcı mesajı (başlık türetmek için). */
	userText: string;
}

function truncate(payload: unknown): string {
	let text: string;
	try {
		text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 1);
	} catch {
		text = String(payload);
	}
	return text.length > TOOL_RESULT_LIMIT ? `${text.slice(0, TOOL_RESULT_LIMIT)}\n…[kısaltıldı]` : text;
}

export function selectionBlock(selections: SelectionContext[] | undefined): string {
	if (!selections?.length) return "";
	const lines = selections.map((selection, index) => {
		const target = selection.content
			? ` | content: ${selection.content.collection ?? "?"}/${selection.content.slug ?? "?"}${
					selection.content.field ? `#${selection.content.field}` : ""
				}`
			: "";
		const insert = selection.position
			? ` | insert: ${selection.position === "before" ? "before" : "after"}`
			: "";
		return `#${index + 1} <${selection.tag ?? "element"}> css: ${selection.path ?? "?"}${
			selection.text ? ` | text: "${selection.text}"` : ""
		}${target}${insert}${selection.html ? ` | html: ${selection.html}` : ""}`;
	});
	return `[SELECTED ELEMENTS]\n${lines.join("\n")}\n[/SELECTED ELEMENTS]\n\n`;
}

function systemPrompt(input: RunAgentInput): string {
	const context = [
		`Repo: ${input.fullName}`,
		`Branch: ${input.branch}`,
		input.siteUrl ? `Site URL: ${input.siteUrl}` : "",
		input.document ? `Open document: ${input.document.path} (collection: ${input.document.collection})` : "",
		input.pagePath ? `Preview page: ${input.pagePath}` : "",
	]
		.filter(Boolean)
		.join("\n");

	return [
		"You are WuppyCMS's in-app AI agent inside a Git-backed CMS for Astro sites.",
		"Content and source code live in the customer's GitHub repository. The CMS stores no content.",
		"Every write you make is a real Git commit whose message ends with (via WuppyCMS).",
		"",
		"## Context",
		context,
		"",
		"## Tools",
		"- get_site_info: repo, branch, site URL and content collections with fields. Call it first when unsure.",
		"- read_file / edit_file / write_file / list_files / grep: repository source files.",
		"  Paths are repo-relative; allowed roots are src/, public/, scripts/, .wuppycms/ and a few root files.",
		"  .env, node_modules, dist, lockfiles and .git are blocked. Writes create commits.",
		"- content_list / content_get / content_update / content_create: Markdown/MDX entries.",
		"  Frontmatter follows src/content.config.ts (Zod). Do not invent fields that are not in the schema.",
		"- content_publish (status: ready) / content_unpublish (status: draft): publishing state in frontmatter.",
		"- undo_last_change: revert your latest write. Use it when the user says undo/revert.",
		"- get_page_context: the open document, preview page and selected elements.",
		"",
		"## Rules",
		"- Prefer edit_file over write_file for existing files; read the file first so oldString matches exactly.",
		"- Simple edits (a word/label/color/text change on the selected element) must stay focused: use the preview page path and the selection's text/html/path. Read only that page or the one component that owns the text; do not grep the whole repo, list collections, or inspect unrelated components. Make the write in the first two tool turns.",
		"- If the selection has a content target, use content_get/content_update directly for text edits; no repo grep is needed. For a small append/remove inside a page section, locate the exact string once and edit it.",
		"- read_file is line-paged. Continue from `to + 1`; never re-read a range you already have.",
		"- grep returns {path, line, text}. Use the line number to jump in with read_file offset.",
		"- Never read or write .env or secrets. Never add dependencies or change CI configuration.",
		"- Make minimal changes consistent with the surrounding Astro/Tailwind 4 code.",
		"- UI primitives must stay Bejamas ports; do not introduce another UI library.",
		"- When adding an astro-icon / `<Icon name=\"set:name\">` icon, also add that icon to the icon() include list in astro.config.mjs; otherwise the preview/build fails with `Unable to locate ... icon`. Existing simple-icons include github/x/linkedin/whatsapp, lucide include mail/map-pin/clock-3/arrow-right/check. Prefer an existing icon or an @lucide/astro direct import.",
		"- If the repo has DESIGN_SYSTEM.md, read it before any UI change and follow it exactly. Use the tokens/classes documented for that repo; never hardcode hex, use inline styles, or introduce an off-system palette. For WuppyCMS site-template repos this is the industrial system: white/neutral surfaces, #dd641e primary, sharp 0 radius (except documented pills/carousel), Space Grotesk, Bejamas UI. Do not reintroduce the old dark Kumo theme. Reuse existing components (src/ui or src/components/ui); add a new primitive only via the Bejamas registry.",
		"- Content updates: use content_update; source/layout edits: use edit_file or write_file.",
		"- Publish only when the user asks for it; otherwise leave status as it is.",
		"- After tool calls, reply briefly with what changed (file paths) and whether it is committed.",
		"- The preview may be a built site (production) or a live dev server (local). Say the change is committed; do not promise an exact live timing.",
		"- If the user asks to remove or rename a brand/label (e.g. \"WuppyCMS sil\") and an element is selected, remove every visible occurrence on that page in the same turn: the selected element plus the layout shell (header brand, footer, default title/description). Do not stop to ask unless it would delete content entries.",
		"- If the user asks to remove or hide a visible label/text (e.g. \"İLETİŞİM yazısını kaldır\"), use the selected element's exact text/html/path to locate the owning source and remove every visible occurrence on the page (nav/header, footer, section heading, button). Do not stop after only reading files; make the edit and commit in the same turn. If the selection is not the target, search the exact text and edit the owning component.",
		"- The [SELECTED ELEMENTS] block is the primary target. If the user's words name a different region (header, footer, sidebar) or different text than the selection, follow the user's words and locate that region in the source; mention the mismatch briefly instead of editing the wrong target.",
		"- When the user asks to add a new section/block and a selection has `insert: before` or `insert: after`, insert the new section as a sibling immediately before/after that selected element in the rendered order. Do not append it to the end of the page or replace the selected element unless the user explicitly asks. Inspect the parent/sibling source around the selected element when needed.",
		"- Match the user's language (Turkish input → Turkish answer).",
		"",
		selectionBlock(input.selections).trim(),
	]
		.filter((part) => part !== "")
		.join("\n");
}

function historyToMessages(history: StoredMessage[]): ChatMessage[] {
	const messages: ChatMessage[] = [];
	for (const message of history) {
		if (message.role === "user") messages.push({ role: "user", content: message.text });
		else if (message.role === "assistant") messages.push({ role: "assistant", content: message.text });
		else {
			messages.push({
				role: "assistant",
				content: `[previous tool ${message.toolName ?? "?"}]: ${message.text.slice(0, 600)}`,
			});
		}
	}
	return messages;
}

export async function runAgent(input: RunAgentInput): Promise<void> {
	const { db, runId, sessionId } = input;

	// Olaylar sıralı yazılır: streaming sırasında onText senkron çağrıldığı
	// için aynı seq'in iki kez üretilmesini bir promise zinciri engeller.
	let eventChain: Promise<void> = Promise.resolve();
	const emit = (event: AgentEvent): Promise<void> => {
		eventChain = eventChain.then(() => appendEvent(db, runId, event)).catch(() => undefined);
		return eventChain;
	};
	const changeIds: string[] = [];

	try {
		const before = await loadMessages(db, sessionId);
		// Başlık: ilk kullanıcı mesajından (seçim bloğu gürültüsü temizlenir).
		if (before.filter((message) => message.role === "user").length === 1) {
			const cleaned =
				input.userText.replace(/\[SELECTED ELEMENTS\][\s\S]*?\[\/SELECTED ELEMENTS\]\s*/g, "").trim() ||
				input.userText;
			const title = cleaned.replace(/\s+/g, " ").slice(0, 60) || "New chat";
			await updateTitle(db, sessionId, title);
		}

		const toolCtx: ToolContext = {
			token: input.token,
			fullName: input.fullName,
			branch: input.branch,
			userId: input.userId,
			db,
			siteUrl: input.siteUrl,
			document: input.document ?? null,
			pagePath: input.pagePath ?? null,
			selections: input.selections ?? [],
		};
		const tools = buildTools(toolCtx, {
			onContentChange: (info: ChangeInfo) => {
				changeIds.push(info.changeId);
				void emit({
					type: "content_changed",
					ts: now(),
					changeId: info.changeId,
					kind: info.kind,
					path: info.path,
					label: info.label,
				});
			},
		});
		const byName = new Map(tools.map((tool) => [tool.spec.name, tool]));

		const messages: ChatMessage[] = [
			{ role: "system", content: systemPrompt(input) },
			...historyToMessages(before),
		];

		await emit({ type: "run_started", ts: now(), provider: input.provider.id, model: input.provider.model });

		let finished = false;
		let stopped = false;
		let wrote = false;
		let nudged = false;
		for (let step = 0; step < MAX_STEPS; step += 1) {
			if (await isStopRequested(db, runId)) {
				stopped = true;
				break;
			}
			const turn = await input.provider.runTurn(
				messages,
				tools.map((tool) => tool.spec) as ToolSpec[],
				(delta) => {
					void emit({ type: "assistant_text_delta", ts: now(), text: delta });
				},
			);

			if (turn.text.trim()) {
				await emit({ type: "assistant_text_done", ts: now(), text: turn.text });
				await appendMessage(db, sessionId, { role: "assistant", text: turn.text, ts: now() });
			}
			if (!turn.toolCalls.length) {
				finished = true;
				break;
			}
			messages.push({ role: "assistant", content: turn.text, toolCalls: turn.toolCalls });

			for (const call of turn.toolCalls) {
				if (await isStopRequested(db, runId)) {
					stopped = true;
					break;
				}
				await emit({
					type: "tool_started",
					ts: now(),
					callId: call.id,
					name: call.name,
					args: call.args,
				});
				const tool = byName.get(call.name);
				let ok = true;
				let result: string;
				if (!tool) {
					ok = false;
					result = `Bilinmeyen araç "${call.name}". Kullanılabilir: ${[...byName.keys()].join(", ")}`;
				} else {
					try {
						result = truncate(await tool.execute((call.args ?? {}) as Record<string, unknown>));
					} catch (error) {
						ok = false;
						result = `Hata: ${(error as Error).message}`;
					}
				}
				await emit({
					type: "tool_done",
					ts: now(),
					callId: call.id,
					name: call.name,
					ok,
					summary: result.slice(0, 1_200),
				});
				messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result });
				await appendMessage(db, sessionId, {
					role: "tool",
					toolName: call.name,
					text: ok ? result.slice(0, 1_000) : `HATA: ${result.slice(0, 1_000)}`,
					ts: now(),
				});
				if (ok && WRITE_TOOLS.has(call.name)) wrote = true;
			}
			if (stopped) break;
			// Kısa bir düzenleme için 3 turdan sonra hâlâ yazma yoksa modeli
			// daha fazla okumak yerine en küçük düzenlemeyi yapmaya yönlendir.
			if (!wrote && !nudged && step >= 2 && input.userText.length < 240) {
				nudged = true;
				messages.push({
					role: "system",
					content:
						"You have enough context for this small edit. Stop reading/grepping now, make the smallest source edit with edit_file/content_update, and commit it in this turn. Do not inspect unrelated files.",
				});
			}
			await touchSession(db, sessionId);
		}

		if (stopped) {
			const text = "Stopped by user.";
			await emit({ type: "assistant_text_done", ts: now(), text });
			await appendMessage(db, sessionId, { role: "assistant", text, ts: now() });
		} else if (!finished) {
			const text = `Step limit reached (${MAX_STEPS}). Say "continue" to resume.`;
			await emit({ type: "assistant_text_done", ts: now(), text });
			await appendMessage(db, sessionId, { role: "assistant", text, ts: now() });
		}
		// Değişiklik kimlikleri, koşu "done" olmadan ÖNCE kullanıcı mesajına
		// yazılmalı: UI done'ı görünce oturumu yeniden yükler ve Undo düğmesini
		// ancak bu alan doluysa gösterir (yarış hatası).
		if (changeIds.length) await attachChangeIds(db, sessionId, changeIds);
		await emit({ type: "run_finished", ts: now() });
		await eventChain;
		await finishRun(db, runId, stopped ? "stopped" : "done");
	} catch (error) {
		const message = error instanceof Error ? error.message : "Ajan çalışması başarısız.";
		if (changeIds.length) await attachChangeIds(db, sessionId, changeIds);
		await emit({ type: "run_error", ts: now(), message });
		await emit({ type: "run_finished", ts: now() });
		await eventChain;
		await finishRun(db, runId, "error");
	} finally {
		await touchSession(db, sessionId);
	}
}
