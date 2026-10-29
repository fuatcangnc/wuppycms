// Üst bar: menü açma, site değiştirici, breadcrumb, durum rozeti, eylemler.

import { t } from "@/lib/i18n";
import { useStore } from "@nanostores/react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui-react/button";
import { deleteDoc, openCollection, saveDoc, selectSite, setMediaFolder, showOverview } from "@/lib/admin/actions";
import {
	$dirty,
	$doc,
	$pagePath,
	$mediaFolder,
	$sidebarCollapsed,
	$sites,
	$site,
	$status,
	$view,
	currentCollection,
	currentSite,
	openDialog,
} from "@/lib/admin/store";
import { Icon } from "./parts";

export default function TopBar() {
	const collapsed = useStore($sidebarCollapsed);
	const sites = useStore($sites);
	const activeSite = useStore($site);
	const view = useStore($view);
	const doc = useStore($doc);
	const pagePath = useStore($pagePath);
	const dirty = useStore($dirty);
	const status = useStore($status);
	const mediaFolder = useStore($mediaFolder);
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const siteName = currentSite()?.name ?? "";
	const saving = status === "saving";

	useEffect(() => {
		if (!menuOpen) return;
		const onDown = (event: MouseEvent) => {
			if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, [menuOpen]);

	type Crumb = { icon?: string; label: string; onClick?: () => void };
	const crumbs: Crumb[] = [];
	switch (view) {
		case "entries":
			crumbs.push({ icon: "book", label: currentCollection()?.name ?? "" });
			break;
		case "doc": {
			const collection = currentCollection();
			if (collection)
				crumbs.push({
					icon: "book",
					label: collection.name,
					onClick: () => void openCollection(collection.key),
				});
			// Wryte düzeni: dosya adı görünmez — başlığın kendisi üst bardaki
			// yuvaya portal'lanır (DocView başlık girdisi).
			break;
		}
		case "contentmd":
			crumbs.push({ icon: "file", label: t("sidebar.contentMd") });
			break;
		case "page":
			if (pagePath) crumbs.push({ icon: "file", label: pagePath });
			break;
		case "media": {
			const folder = mediaFolder;
			crumbs.push({
				icon: "image",
				label: t("sidebar.media"),
				...(folder ? { onClick: () => setMediaFolder("") } : {}),
			});
			if (folder) crumbs.push({ label: `${folder}/` });
			break;
		}
		default:
			break;
	}
	const visible = crumbs.filter((crumb) => crumb.label);

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
			{collapsed && (
				<button
					type="button"
					title={t("topbar.openMenu")}
					onClick={() => $sidebarCollapsed.set(false)}
					className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg>
				</button>
			)}

			<div className="relative shrink-0" ref={menuRef}>
				<button
					type="button"
					data-testid="site-menu"
					onClick={() => setMenuOpen((open) => !open)}
					className="flex max-w-56 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-muted-foreground" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
					<span className="truncate">{siteName || "Home"}</span>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3 text-muted-foreground" aria-hidden="true"><path d="m7 15 5 5 5-5" /><path d="m7 9 5-5 5 5" /></svg>
				</button>
				{menuOpen && (
					<div className="absolute left-0 top-10 z-40 w-64 rounded-xl border border-border bg-background p-1 shadow-lg">
						<div className="max-h-64 overflow-y-auto">
							{sites.map((site) => (
								<button
									key={site.id}
									type="button"
									onClick={() => {
										setMenuOpen(false);
										if (site.repoFullName !== activeSite) void selectSite(site.repoFullName);
										else showOverview();
									}}
									className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent"
								>
									<span className={`w-3 text-emerald-500 ${site.repoFullName === activeSite ? "" : "invisible"}`}>✓</span>
									<span className="truncate">{site.name}</span>
								</button>
							))}
						</div>
						<button
							type="button"
							onClick={() => {
								setMenuOpen(false);
								openDialog("site");
							}}
							className="mt-1 flex w-full items-center gap-2 border-t border-border px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						>
							+ {t("topbar.addSite")}
						</button>
					</div>
				)}
			</div>

			{visible.length > 0 && <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />}
			<nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden" aria-label="breadcrumb">
				{visible.map((crumb, index) => {
					const clickable = Boolean(crumb.onClick);
					return (
						<Fragment key={`${crumb.label}-${index}`}>
							{index > 0 && <Icon name="chevron-right" className="size-3 shrink-0 text-muted-foreground/50" />}
							{clickable ? (
								<button
									type="button"
									onClick={crumb.onClick}
									className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								>
									{crumb.icon && <Icon name={crumb.icon} className="size-3.5" />}
									<span className="truncate">{crumb.label}</span>
								</button>
							) : (
								<span className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 text-sm text-foreground">
									{crumb.icon && <Icon name={crumb.icon} className="size-3.5 text-muted-foreground" />}
									<span className="truncate">{crumb.label}</span>
								</span>
							)}
						</Fragment>
					);
				})}
				{/* Wryte düzeni: doküman açıkken başlık breadcrumb'ın sonunda
				    görünür (collection > başlık). DocView buraya girdi portal'lar. */}
				{view === "doc" && (
					<>
						<Icon name="chevron-right" className="size-3 shrink-0 text-muted-foreground/50" />
						<span data-doc-title-slot className="flex min-w-0 flex-1 items-center" />
					</>
				)}
			</nav>
			{/* Wryte düzeni: durum çipi + iş akışı düğmeleri DocView'dan buraya portal'lanır. */}
			<span data-doc-actions-slot className="flex shrink-0 items-center gap-1" />
			<span
				className={`inline-flex shrink-0 items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground ${
					dirty && !saving ? "text-amber-500" : ""
				}`}
			>
				{saving ? t("topbar.saving") : dirty ? t("topbar.dirty") : t("topbar.saved")}
			</span>
			<Button
				variant="ghost"
				size="icon-sm"
				title={t("topbar.deleteDoc")}
				disabled={saving || !doc}
				onClick={() => void deleteDoc()}
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2v2" /></svg>
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				title={t("topbar.viewInRepo")}
				onClick={() => {
					const site = currentSite();
					if (site) window.open(`https://github.com/${site.repoFullName}`, "_blank");
				}}
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
			</Button>
			<Button size="sm" disabled={saving || !dirty || !doc} onClick={() => void saveDoc()}>
				{t("common.save")}
			</Button>
		</header>
	);
}
