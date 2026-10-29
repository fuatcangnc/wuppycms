/** Sohbet transkripti: mesajlar, katlanmış araç grupları, akan metin. */

import type { StoredMessage } from "@/lib/agent/protocol";
import { Icon } from "@/components/admin/parts";
import { t } from "@/lib/i18n";
import { Markdown } from "./Markdown";
import { ToolGroup } from "./ToolGroup";
import type { QueuedPrompt, ToolChip } from "./types";

type Row =
	| { key: string; kind: "user"; message: StoredMessage }
	| { key: string; kind: "assistant"; message: StoredMessage }
	| { key: string; kind: "tools"; chips: ToolChip[] };

function buildRows(messages: StoredMessage[]): Row[] {
	const rows: Row[] = [];
	let chips: ToolChip[] = [];
	let seq = 0;
	const flush = () => {
		if (!chips.length) return;
		rows.push({ key: `g${seq++}`, kind: "tools", chips });
		chips = [];
	};
	for (const message of messages) {
		if (message.role === "tool") {
			const failed = message.text.startsWith("HATA:");
			chips.push({
				callId: `stored-${seq}-${chips.length}`,
				name: message.toolName ?? "tool",
				args: null,
				ok: !failed,
				summary: message.text,
				running: false,
			});
			continue;
		}
		flush();
		rows.push(
			message.role === "user"
				? { key: `m${seq++}`, kind: "user", message }
				: { key: `m${seq++}`, kind: "assistant", message },
		);
	}
	flush();
	return rows;
}

function displayUserMessage(text: string): { text: string; selected: number } {
	const match = text.match(/\[SELECTED ELEMENTS\]([\s\S]*?)\[\/SELECTED ELEMENTS\]/);
	if (!match) return { text, selected: 0 };
	const selected = (match[1]!.match(/^#\d+/gm) ?? []).length;
	const clean = text.replace(/\[SELECTED ELEMENTS\][\s\S]*?\[\/SELECTED ELEMENTS\]\s*/g, "").trim();
	return { text: clean || text, selected };
}

export interface ChatLogProps {
	messages: StoredMessage[];
	tools: ToolChip[];
	stream: string;
	note: string;
	error: string;
	busy: boolean;
	elapsed: number;
	undoing: string | null;
	queued: QueuedPrompt[];
	loading?: boolean;
	onCopy(text: string): void;
	onEdit(text: string): void;
	onUndoChange(changeId: string): void;
}

export function ChatLog({
	messages,
	tools,
	stream,
	note,
	error,
	busy,
	elapsed,
	undoing,
	queued,
	loading = false,
	onCopy,
	onEdit,
	onUndoChange,
}: ChatLogProps) {
	return (
		<div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
			{error ? (
				<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					{error}
				</div>
			) : null}

			{loading ? (
				<div className="animate-pulse space-y-3 px-1 py-2" aria-label={t("widget.history")}>
					<div className="ml-auto h-9 w-2/3 rounded-2xl rounded-br-md bg-primary/15" />
					<div className="h-3 w-5/6 rounded bg-foreground/10" />
					<div className="h-3 w-4/6 rounded bg-foreground/10" />
					<div className="h-3 w-3/4 rounded bg-foreground/10" />
				</div>
			) : null}

			{!loading && !busy && !messages.length && !tools.length && !stream ? (
				<div className="mx-auto mt-10 max-w-sm text-center">
					<div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
						<Icon name="sparkles" className="size-5" />
					</div>
					<p className="text-sm font-medium text-foreground">{t("widget.emptyTitle")}</p>
					<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
						{t("widget.emptyBody")}
					</p>
				</div>
			) : null}

			{buildRows(messages).map((row) => {
				if (row.kind === "tools") return <ToolGroup chips={row.chips} key={row.key} />;
				const message = row.message;
				if (row.kind === "assistant") {
					return (
						<div key={row.key} className="rounded-lg px-1 py-1">
							<Markdown text={message.text} onCopy={onCopy} />
						</div>
					);
				}
				const display = displayUserMessage(message.text);
				return (
					<div key={row.key} className="flex flex-col items-end gap-1">
						<div className="max-w-[92%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
							{display.text}
							{display.selected > 0 ? (
								<span className="ml-1 opacity-80">
									· {t("widget.elements", { count: display.selected })}
								</span>
							) : null}
						</div>
						<div className="flex items-center gap-2 text-[11px] text-muted-foreground">
							{message.changeIds?.length ? (
								<button
									type="button"
									disabled={undoing !== null}
									aria-busy={undoing === message.changeIds[0]}
									className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
									title={t("widget.undoTitle")}
									onClick={() => onUndoChange(message.changeIds![0]!)}
								>
									<Icon name="undo" className="size-3" />
									{undoing === message.changeIds[0] ? t("widget.undoing") : t("widget.undo")}
								</button>
							) : null}
							<button
								type="button"
								className="rounded-md p-1 transition-colors hover:bg-accent hover:text-foreground"
								title={t("widget.copy")}
								onClick={() => onCopy(message.text)}
							>
								<Icon name="copy" className="size-3" />
							</button>
							<button
								type="button"
								className="rounded-md p-1 transition-colors hover:bg-accent hover:text-foreground"
								title={t("widget.edit")}
								onClick={() => onEdit(message.text)}
							>
								<Icon name="pencil" className="size-3" />
							</button>
						</div>
					</div>
				);
			})}

			{busy ? (
				<div
					role="status"
					aria-live="polite"
					className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-xs text-primary"
				>
					<span className="flex items-center gap-1" aria-hidden="true">
						<span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.2s]" />
						<span className="size-1.5 animate-pulse rounded-full bg-primary [animation-delay:-0.1s]" />
						<span className="size-1.5 animate-pulse rounded-full bg-primary" />
					</span>
					<span className="font-medium">{t("widget.thinking")}</span>
					<span className="ml-auto font-mono text-[11px] tabular-nums text-primary/80">{elapsed}s</span>
				</div>
			) : null}

			{tools.length ? <ToolGroup chips={tools} /> : null}

			{stream ? (
				<div className="rounded-lg px-1 py-1">
					<Markdown text={stream} onCopy={onCopy} />
				</div>
			) : null}

			{queued.map((item) => (
				<div key={item.id} className="flex flex-col items-end gap-1">
					<div className="max-w-[92%] rounded-2xl rounded-br-md border border-primary/30 bg-primary/10 px-3.5 py-2 text-sm text-foreground">
						{item.text}
					</div>
					<span className="text-[10px] text-muted-foreground">{t("widget.queued")}</span>
				</div>
			))}

			{note ? <div className="pt-1 text-[11px] text-muted-foreground">{note}</div> : null}
		</div>
	);
}
