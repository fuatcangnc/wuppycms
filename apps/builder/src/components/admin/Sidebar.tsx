// Sol menü: Vercel/GitCMS düzeni — bölüm başlıkları, ikonlu satırlar ve
// sağda chevron; Siteler + İçerik + Site bölümleri, AI kartı ve hesap.

import { useStore } from "@nanostores/react";
import * as api from "@/lib/admin/api";
import { openCollection, openContentMd, openDoc, openMedia, openPage, openReviews, openSiteSettings, openTrash, selectSite, showOverview } from "@/lib/admin/actions";
import {
	$collection,
	$collections,
	$configFound,
	$doc,
	$entries,
	$pagePath,
	$pages,
	$sidebarCollapsed,
	$site,
	$sites,
	$user,
	$view,
	openDialog,
} from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { AvatarCircle, Icon } from "./parts";
import PagesTree from "./parts/PagesTree";

const MENU_BTN =
	"group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground";
const MENU_ACTIVE = "bg-accent/70 font-medium text-foreground";
const SECTION_TITLE = "mb-1.5 block px-2.5 text-sm font-medium text-foreground";
const MENU_ICON = "size-4 shrink-0 text-muted-foreground opacity-80";

function Chevron({ direction = "right" }: { direction?: "right" | "down" }) {
	return (
		<Icon
			name="chevron-right"
			className={`ml-auto size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:text-muted-foreground ${
				direction === "down" ? "rotate-90" : ""
			}`}
		/>
	);
}

export default function Sidebar() {
	const collapsed = useStore($sidebarCollapsed);
	const sites = useStore($sites);
	const activeSite = useStore($site);
	const collections = useStore($collections);
	const configFound = useStore($configFound);
	const activeCollection = useStore($collection);
	const entries = useStore($entries);
	const doc = useStore($doc);
	const pages = useStore($pages);
	const pagePath = useStore($pagePath);
	const view = useStore($view);
	const user = useStore($user);

	if (collapsed) return null;

	return (
		<aside id="sidebar" className="flex w-64 shrink-0 flex-col border-r border-border">
			<div className="flex h-14 shrink-0 items-center gap-2 px-4">
				<span className="inline-block size-4 rounded bg-primary" />
				<a href="/projects" className="text-sm font-semibold tracking-tight">WuppyCMS</a>
				<button
					type="button"
					title={t("sidebar.collapse")}
					onClick={() => $sidebarCollapsed.set(true)}
					className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				>
					<Icon name="panel" className="size-4" />
				</button>
			</div>
			<div className="border-b border-border" />

			<nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2 py-3">
				<section>
					<div className="mb-1 flex items-center justify-between pr-1">
						<span className={SECTION_TITLE}>{t("sidebar.sites")}</span>
						<button
							type="button"
							title="Site ekle"
							onClick={() => openDialog("site")}
							className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
						>
							<Icon name="plus" className="size-3.5" />
						</button>
					</div>
					<div className="space-y-0.5">
						{sites.map((site) => (
							<button
								key={site.id}
								type="button"
								onClick={() => {
									if (site.repoFullName === activeSite) showOverview();
									else void selectSite(site.repoFullName);
								}}
								className={`${MENU_BTN} ${site.repoFullName === activeSite ? MENU_ACTIVE : ""}`}
							>
								<Icon name="globe" className={MENU_ICON} />
								<span className="truncate">{site.name}</span>
								<Chevron />
							</button>
						))}
					</div>
				</section>

				{activeSite && configFound && (
					<section>
						<div className="flex items-center justify-between pr-2.5">
							<span className={SECTION_TITLE}>{t("sidebar.content")}</span>
							<button
								type="button"
								title={t("sidebar.addCollection")}
								onClick={() => openDialog("collection")}
								className="mb-1.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							>
								<Icon name="plus" className="size-3.5" />
							</button>
						</div>
						<div className="space-y-0.5">
							{collections.map((def) => (
								<div key={def.key}>
									<button
										type="button"
										onClick={() => void openCollection(def.key)}
										className={`${MENU_BTN} ${def.key === activeCollection ? MENU_ACTIVE : ""}`}
									>
										<Icon name="book" className={MENU_ICON} />
										<span className="truncate">{def.name}</span>
										<Chevron direction={def.key === activeCollection ? "down" : "right"} />
									</button>
									{def.key === activeCollection && (
										<div className="ml-5 mt-0.5 space-y-0.5 border-l border-border pl-2">
											{entries.slice(0, 25).map((entry) => (
												<button
													key={entry.path}
													type="button"
													onClick={() => void openDoc(entry.path)}
													className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-accent/60 hover:text-foreground ${
														view === "doc" && doc?.path === entry.path
															? "bg-accent/70 font-medium text-foreground"
															: "text-muted-foreground"
													}`}
												>
													<Icon name="file" className="size-3.5 shrink-0 opacity-60" />
													<span className="truncate">{entry.title}</span>
												</button>
											))}
											{entries.length > 25 && (
												<p className="px-2 py-1 text-xs text-muted-foreground">{t("sidebar.moreDocs", { count: entries.length - 25 })}</p>
											)}
										</div>
									)}
								</div>
							))}
							<button
								type="button"
								onClick={() => void openContentMd()}
								className={`${MENU_BTN} ${view === "contentmd" ? MENU_ACTIVE : ""}`}
							>
								<Icon name="file" className={MENU_ICON} />
								{t("sidebar.contentMd")}
								<Chevron />
							</button>
						</div>
					</section>
				)}

				{activeSite && pages.length > 0 && (
					<section>
						<PagesTree pages={pages} activePath={view === "page" ? pagePath : ""} onOpen={openPage} />
					</section>
				)}

				{activeSite && (
					<section>
						<span className={SECTION_TITLE}>{t("sidebar.site")}</span>
						<div className="space-y-0.5">
							<button
								type="button"
								onClick={() => void openMedia()}
								className={`${MENU_BTN} ${view === "media" ? MENU_ACTIVE : ""}`}
							>
								<Icon name="image" className={MENU_ICON} />
								{t("sidebar.media")}
								<Chevron />
							</button>
							<button
								type="button"
								onClick={() => openTrash()}
								className={`${MENU_BTN} ${view === "trash" ? MENU_ACTIVE : ""}`}
							>
								<Icon name="trash" className={MENU_ICON} />
								{t("sidebar.trash")}
								<Chevron />
							</button>
							<button
								type="button"
								onClick={() => openReviews()}
								className={`${MENU_BTN} ${view === "review" ? MENU_ACTIVE : ""}`}
							>
								<Icon name="check" className={MENU_ICON} />
								{t("sidebar.reviews")}
								<Chevron />
							</button>
							<button
								type="button"
								onClick={() => openSiteSettings()}
								className={`${MENU_BTN} ${view === "settings" ? MENU_ACTIVE : ""}`}
							>
								<Icon name="sliders" className={MENU_ICON} />
								{t("sidebar.siteSettings")}
								<Chevron />
							</button>
						</div>
					</section>
				)}
			</nav>

			<div className="shrink-0 space-y-2 border-t border-border p-2">
				<button
					type="button"
					onClick={() => openDialog("ai")}
					className="w-full rounded-lg border border-border bg-muted/40 p-3 text-left transition-colors hover:bg-muted/70"
				>
					<span className="flex items-center gap-2">
						<Icon name="sparkles" className="size-4 shrink-0 text-primary" />
						<span className="text-sm font-medium">{t("sidebar.agentCardTitle")}</span>
					</span>
					<p className="mt-1 text-xs text-muted-foreground">
						{t("sidebar.agentCardBody")}
					</p>
				</button>
				<div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
					<AvatarCircle name={user?.name ?? "?"} className="size-7 text-xs" />
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{user?.name ?? "…"}</p>
						<p className="truncate text-xs text-muted-foreground">{user?.email}</p>
					</div>
					<button
						type="button"
						title={t("sidebar.signOut")}
						onClick={() => void api.signOut().then(() => window.location.assign("/login"))}
						className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						<Icon name="logout" className="size-4" />
					</button>
				</div>
			</div>
		</aside>
	);
}
