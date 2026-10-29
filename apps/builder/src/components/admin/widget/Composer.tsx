/** Mesaj kutusu: seçim çipleri, model seçici, seçim modu ve gönder/durdur. */

import { Icon } from "@/components/admin/parts";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui-react/button";
import { Textarea } from "@/components/ui-react/textarea";
import type { ModelChoice, PickedElement } from "./types";

const SELECT_CLS =
	"border-input focus-visible:border-ring focus-visible:ring-ring/50 h-7 max-w-[150px] appearance-none rounded-md border bg-transparent px-2 text-xs text-muted-foreground shadow-xs outline-none focus-visible:ring-3";

export interface ComposerProps {
	draft: string;
	onDraft(value: string): void;
	onSend(): void;
	busy: boolean;
	onStop(): void;
	selections: PickedElement[];
	onRemoveSelection(selection: PickedElement): void;
	onPositionChange(selection: PickedElement, position: "before" | "after"): void;
	insertMode: boolean;
	onInsertModeChange(value: boolean): void;
	queuedCount: number;
	selMode: boolean;
	onToggleSelMode(): void;
	bridgeReady: boolean;
	model: ModelChoice | null;
	models: ModelChoice[];
	onModelChange(id: string): void;
	configured: boolean;
	onConfigure(): void;
	onNewSession(): void;
	onReload(): void;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
	draft,
	onDraft,
	onSend,
	busy,
	onStop,
	selections,
	onRemoveSelection,
	onPositionChange,
	insertMode,
	onInsertModeChange,
	queuedCount,
	selMode,
	onToggleSelMode,
	bridgeReady,
	model,
	models,
	onModelChange,
	configured,
	onConfigure,
	onNewSession,
	onReload,
	textareaRef,
}: ComposerProps) {
	return (
		<div className="border-t border-border p-3">
			{selections.length > 0 ? (
				<div className="mb-2 space-y-1.5">
					<div className="flex flex-wrap items-center gap-1.5">
						<span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
							{t("widget.action")}
						</span>
						<div className="inline-flex overflow-hidden rounded-md border border-border bg-muted/40 p-0.5">
							<button
								type="button"
								aria-pressed={!insertMode}
								onClick={() => onInsertModeChange(false)}
								className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
									!insertMode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
								}`}
							>
								{t("widget.editMode")}
							</button>
							<button
								type="button"
								aria-pressed={insertMode}
								onClick={() => onInsertModeChange(true)}
								className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
									insertMode ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
								}`}
							>
								{t("widget.insertMode")}
							</button>
						</div>
					</div>
					<div className="flex flex-wrap gap-1.5">
					{selections.map((selection) => (
						<span
							key={`${selection.path}-${selection.label}`}
							title={selection.path}
							className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-foreground"
						>
							<span className="truncate">
								{selection.content?.collection
									? `${selection.content.collection}/${selection.content.slug ?? "?"}`
									: selection.label}
								{selection.text ? ` · ${selection.text.slice(0, 18)}${selection.text.length > 18 ? "…" : ""}` : ""}
							</span>
							{insertMode ? (
								<select
									aria-label={t("widget.insertPosition")}
									title={t("widget.insertPosition")}
									value={selection.position ?? "after"}
									onChange={(event) =>
										onPositionChange(selection, event.target.value === "before" ? "before" : "after")
									}
									className="h-5 shrink-0 rounded-sm border border-primary/30 bg-white px-0.5 text-[10px] text-primary outline-none focus-visible:border-primary"
								>
									<option value="after">{t("widget.insertAfter")}</option>
									<option value="before">{t("widget.insertBefore")}</option>
								</select>
							) : null}
							<button
								type="button"
								className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
								title={t("widget.close")}
								onClick={() => onRemoveSelection(selection)}
							>
								<Icon name="x" className="size-3" />
							</button>
						</span>
					))}
					</div>
				</div>
			) : null}

			{queuedCount > 0 ? (
				<p className="mb-2 mt-2 text-[10px] font-bold uppercase tracking-wider text-primary">
					{t("widget.queuedCount", { count: queuedCount })}
				</p>
			) : null}

			<Textarea
				ref={textareaRef}
				rows={1}
				placeholder={t("widget.composerPlaceholder")}
				value={draft}
				onChange={(event) => onDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						onSend();
					}
				}}
				className="min-h-10 resize-none border-0 bg-muted/30 px-3 py-2 shadow-none focus-visible:ring-0"
			/>

			<div className="mt-2 flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					title={t("widget.newChat")}
					aria-label={t("widget.newChat")}
					onClick={onNewSession}
				>
					<Icon name="plus" className="size-4" />
				</Button>
				<Button
					type="button"
					variant={selMode ? "default" : "ghost"}
					size="icon-sm"
					title={bridgeReady ? t("widget.pick") : t("widget.pickUnavailable")}
					aria-label={t("widget.pick")}
					aria-pressed={selMode}
					disabled={!bridgeReady}
					onClick={onToggleSelMode}
				>
					<Icon name="cursor" className="size-4" />
				</Button>

				<div className="ml-1 min-w-0">
					{models.length ? (
						<select
							aria-label={t("widget.model")}
							className={SELECT_CLS}
							value={model?.id ?? models[0]?.id ?? ""}
							onChange={(event) => onModelChange(event.target.value)}
						>
							{models.map((entry) => (
								<option key={entry.id} value={entry.id}>
									{entry.label}
								</option>
							))}
						</select>
					) : (
						<button
							type="button"
							onClick={onConfigure}
							className="text-[11px] text-primary underline underline-offset-2"
						>
							{t("widget.configure")}
						</button>
					)}
				</div>

				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="ml-auto"
					title={t("widget.reload")}
					aria-label={t("widget.reload")}
					onClick={onReload}
				>
					<Icon name="refresh" className="size-4" />
				</Button>

				{busy ? (
					<>
						<Button
							type="button"
							size="icon-sm"
							title={t("widget.queueSend")}
							aria-label={t("widget.queueSend")}
							disabled={!draft.trim() || !configured}
							onClick={onSend}
						>
							<Icon name="arrow-up" className="size-4" />
						</Button>
						<Button type="button" variant="secondary" size="icon-sm" title={t("widget.stop")} aria-label={t("widget.stop")} onClick={onStop}>
							<Icon name="stop" className="size-4" />
						</Button>
					</>
				) : (
					<Button
						type="button"
						size="icon-sm"
						title={t("widget.send")}
						aria-label={t("widget.send")}
						disabled={!draft.trim() || !configured}
						onClick={onSend}
					>
						<Icon name="arrow-up" className="size-4" />
					</Button>
				)}
			</div>
		</div>
	);
}
