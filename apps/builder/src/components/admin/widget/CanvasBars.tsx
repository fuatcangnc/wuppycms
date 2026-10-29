/** Canvas üst çubukları: sekmeler, gezinme, yol, seçici ve sayfa menüsü. */

import { useEffect, useRef, useState } from "react";
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
	const [pagesOpen, setPagesOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement | null>(null);

	const openPages = () => {
		onOpenPages();
		setPagesOpen(true);
	};

	useEffect(() => {
		if (!pagesOpen) return;
		const onPointerDown = (event: PointerEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setPagesOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setPagesOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [pagesOpen]);

	return (
		<div className="relative flex shrink-0 flex-col border-b border-border bg-background">
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
						onClick={openPages}
					>
						<Icon name="plus" className="size-4" />
					</Button>
				</div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-haspopup="menu"
					aria-expanded={pagesOpen}
					title={t("widget.pagesTitle")}
					onClick={openPages}
				>
					<Icon name="list" className="size-3.5" />
					{t("widget.pages")}
				</Button>
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
				<button
					type="button"
					onClick={openPages}
					aria-haspopup="menu"
					aria-expanded={pagesOpen}
					title={t("widget.pagesTitle")}
					className="mx-1 flex min-w-0 flex-1 items-center gap-1 truncate rounded-md bg-muted/40 px-2 py-1 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				>
					<span className="min-w-0 flex-1 truncate">{shownPath}</span>
					<Icon name="chevron-down" className="size-3 shrink-0" />
				</button>
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

			{pagesOpen ? (
				<div
					ref={menuRef}
					role="menu"
					className="absolute right-2 top-[82px] z-50 w-72 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl"
				>
					<div className="flex items-center justify-between border-b border-border px-3 py-2">
						<span className="text-xs font-semibold">{t("widget.pagesTitle")}</span>
						<button
							type="button"
							aria-label={t("common.close")}
							title={t("common.close")}
							className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
							onClick={() => setPagesOpen(false)}
						>
							<Icon name="x" className="size-3.5" />
						</button>
					</div>
					<div className="max-h-80 overflow-y-auto p-1">
						{pages.length ? (
							pages.map((page) => {
								const path = page.url.replace(/^https?:\/\/[^/]+/, "") || "/";
								const active = page.url === activeUrl;
								return (
									<button
										key={page.url}
										type="button"
										role="menuitem"
										onClick={() => {
											onSelectPage(page.url, page.title);
											setPagesOpen(false);
										}}
										className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors ${
											active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
										}`}
									>
										<Icon name="file" className="mt-0.5 size-3.5 shrink-0" />
										<span className="min-w-0 flex-1">
											<span className="block truncate text-xs font-medium">{page.title}</span>
											<span className="block truncate font-mono text-[10px] text-muted-foreground">{path}</span>
										</span>
									</button>
								);
							})
						) : (
							<p className="px-2 py-3 text-xs text-muted-foreground">{t("widget.pagesEmpty")}</p>
						)}
					</div>
				</div>
			) : null}
		</div>
	);
}
