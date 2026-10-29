/** Canvas üst çubukları: sekmeler, gezinme, yol, seçici ve sayfa menüsü. */

import { Icon } from "@/components/admin/parts";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui-react/button";
import type { PageItem, Tab } from "./types";

export interface CanvasBarsProps {
	tabs: Tab[];
	activeUrl: string;
	pagePath: string | null;
	pages: PageItem[];
	bridgeReady: boolean;
	selMode: boolean;
	onToggleSelMode(): void;
	onActivate(url: string): void;
	onCloseTab(url: string): void;
	onOpenPages(): void;
	onSelectPage(url: string, title: string): void;
	onReload(): void;
	onBack(): void;
	onForward(): void;
	onFocusComposer(): void;
	onDragStart(url: string): void;
	onDropTab(url: string): void;
}

export function CanvasBars({
	tabs,
	activeUrl,
	pagePath,
	pages,
	bridgeReady,
	selMode,
	onToggleSelMode,
	onActivate,
	onCloseTab,
	onOpenPages,
	onSelectPage,
	onReload,
	onBack,
	onForward,
	onFocusComposer,
	onDragStart,
	onDropTab,
}: CanvasBarsProps) {
	const shownPath = pagePath ?? activeUrl.replace(/^https?:\/\/[^/]+/, "") ?? "/";
	return (
		<div className="flex shrink-0 flex-col border-b border-border bg-background">
			<div className="flex h-10 items-center gap-1 border-b border-border px-2">
				<div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
					{tabs.map((tab) => {
						const active = tab.url === activeUrl;
						return (
							<button
								key={tab.url}
								type="button"
								draggable
								onDragStart={(event) => {
									event.dataTransfer.effectAllowed = "move";
									try {
										event.dataTransfer.setData("text/plain", tab.url);
									} catch {
										// bazı tarayıcılar özel veriyi kısıtlar
									}
									onDragStart(tab.url);
								}}
								onDragOver={(event) => event.preventDefault()}
								onDrop={(event) => {
									event.preventDefault();
									onDropTab(tab.url);
								}}
								onClick={() => onActivate(tab.url)}
								title={tab.url}
								className={`inline-flex max-w-[200px] shrink-0 cursor-grab items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors active:cursor-grabbing ${
									active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"
								}`}
							>
								<span className="truncate">{tab.title}</span>
								{tabs.length > 1 ? (
									<span
										role="button"
										aria-label="Close tab"
										title={t("widget.closeTab")}
										className="rounded p-0.5 hover:text-destructive"
										onClick={(event) => {
											event.stopPropagation();
											onCloseTab(tab.url);
										}}
									>
										<Icon name="x" className="size-3" />
									</span>
								) : null}
							</button>
						);
					})}
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						title={t("widget.openPage")}
						aria-label={t("widget.openPage")}
						onClick={onOpenPages}
					>
						<Icon name="plus" className="size-4" />
					</Button>
				</div>
				{pages.length ? (
					<select
						aria-label={t("widget.pages")}
						className="border-input h-7 max-w-[190px] appearance-none rounded-md border bg-transparent px-2 text-xs text-muted-foreground outline-none"
						value=""
						onChange={(event) => {
							const page = pages.find((item) => item.url === event.target.value);
							if (page) onSelectPage(page.url, page.title);
						}}
					>
						<option value="">{t("widget.pages")}</option>
						{pages.map((page) => (
							<option key={page.url} value={page.url}>
								{page.title}
							</option>
						))}
					</select>
				) : null}
			</div>
			<div className="flex h-10 items-center gap-1 px-2">
				<Button type="button" variant="ghost" size="icon-sm" title={t("widget.back")} aria-label={t("widget.back")} onClick={onBack}>
					<Icon name="chevron-right" className="size-4 rotate-180" />
				</Button>
				<Button type="button" variant="ghost" size="icon-sm" title={t("widget.forward")} aria-label={t("widget.forward")} onClick={onForward}>
					<Icon name="chevron-right" className="size-4" />
				</Button>
				<Button type="button" variant="ghost" size="icon-sm" title={t("widget.reloadShort")} aria-label={t("widget.reloadShort")} onClick={onReload}>
					<Icon name="refresh" className="size-4" />
				</Button>
				<span className="mx-1 min-w-0 flex-1 truncate rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">
					{shownPath}
				</span>
				{bridgeReady ? (
					<span className="mr-1 text-[10px] text-emerald-500" title={t("widget.bridgeOnTitle")}>
						{t("widget.bridgeOn")}
					</span>
				) : (
					<span className="mr-1 text-[10px] text-muted-foreground" title={t("widget.bridgeOffTitle")}>
						{t("widget.bridgeOff")}
					</span>
				)}
				<Button
					type="button"
					variant={selMode ? "default" : "ghost"}
					size="sm"
					title={t("widget.pick")}
					aria-pressed={selMode}
					disabled={!bridgeReady}
					data-testid="agent-pick"
					onClick={onToggleSelMode}
				>
					<Icon name="cursor" className="size-3.5" />
					{t("widget.pick")}
				</Button>
				<Button type="button" variant="ghost" size="sm" title={t("widget.write")} onClick={onFocusComposer}>
					<Icon name="pencil" className="size-3.5" />
					{t("widget.write")}
				</Button>
			</div>
		</div>
	);
}
