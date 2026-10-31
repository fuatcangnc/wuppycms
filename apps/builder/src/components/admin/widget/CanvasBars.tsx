/** Canvas üst çubukları: sekmeler, gezinme, yol, seçici ve sayfa menüsü. */

import { Icon } from "@/components/admin/parts";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui-react/dropdown-menu";
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
	onBrowserPreview(): void;
	onBack(): void;
	onForward(): void;
	onFocusComposer(): void;
	onDragStart(url: string): void;
	onDropTab(url: string): void;
}

function PagesList({
	pages,
	activeUrl,
	onSelectPage,
}: {
	pages: PageItem[];
	activeUrl: string;
	onSelectPage(url: string, title: string): void;
}) {
	return (
		<>
			<DropdownMenuLabel>{t("widget.pagesTitle")}</DropdownMenuLabel>
			{pages.length ? (
				pages.map((page) => {
					const path = page.url.replace(/^https?:\/\/[^/]+/, "") || "/";
					const active = page.url === activeUrl;
					return (
						<DropdownMenuItem
							key={page.url}
							onSelect={() => onSelectPage(page.url, page.title)}
							className={active ? "bg-accent text-foreground" : ""}
						>
							<Icon name="file" className="mt-0.5 size-3.5 shrink-0" />
							<span className="min-w-0 flex-1">
								<span className="block truncate text-xs font-medium">{page.title}</span>
								<span className="block truncate font-mono text-[10px] text-muted-foreground">{path}</span>
							</span>
						</DropdownMenuItem>
					);
				})
			) : (
				<DropdownMenuLabel>{t("widget.pagesEmpty")}</DropdownMenuLabel>
			)}
		</>
	);
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
	onBrowserPreview,
	onBack,
	onForward,
	onFocusComposer,
	onDragStart,
	onDropTab,
}: CanvasBarsProps) {
	const shownPath = pagePath ?? activeUrl.replace(/^https?:\/\/[^/]+/, "") ?? "/";

	const loadPagesOnOpen = (open: boolean) => {
		if (open) onOpenPages();
	};

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
					<DropdownMenu onOpenChange={loadPagesOnOpen}>
						<DropdownMenuTrigger
							variant="ghost"
							size="icon-sm"
							title={t("widget.openPage")}
							aria-label={t("widget.openPage")}
						>
							<Icon name="plus" className="size-4" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-72">
							<PagesList pages={pages} activeUrl={activeUrl} onSelectPage={onSelectPage} />
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<DropdownMenu onOpenChange={loadPagesOnOpen}>
					<DropdownMenuTrigger
						variant="ghost"
						size="sm"
						title={t("widget.pagesTitle")}
					>
						<Icon name="list" className="size-3.5" />
						{t("widget.pages")}
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-72">
						<PagesList pages={pages} activeUrl={activeUrl} onSelectPage={onSelectPage} />
					</DropdownMenuContent>
				</DropdownMenu>
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
				<Button type="button" variant="ghost" size="icon-sm" title={t("widget.browserPreview")} aria-label={t("widget.browserPreview")} onClick={onBrowserPreview}>
					<Icon name="external" className="size-4" />
				</Button>
				<DropdownMenu className="mx-1 flex min-w-0 flex-1" onOpenChange={loadPagesOnOpen}>
					<DropdownMenuTrigger
						variant="ghost"
						size="sm"
						containerClassName="flex min-w-0 flex-1"
						className="w-full min-w-0 justify-start gap-1 bg-muted/40 px-2 py-1 font-mono text-[11px] font-normal text-muted-foreground hover:bg-muted hover:text-foreground"
						title={t("widget.pagesTitle")}
					>
						<span className="min-w-0 flex-1 truncate text-left">{shownPath}</span>
						<Icon name="chevron-down" className="size-3 shrink-0" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-72">
						<PagesList pages={pages} activeUrl={activeUrl} onSelectPage={onSelectPage} />
					</DropdownMenuContent>
				</DropdownMenu>
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
