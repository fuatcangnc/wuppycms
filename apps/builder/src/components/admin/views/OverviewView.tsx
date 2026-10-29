// Genel bakış panosu — koleksiyon kartları, commit akışı, site meta ve ekip.

import { useStore } from "@nanostores/react";
import { Badge } from "@/components/ui-react/badge";
import { Button } from "@/components/ui-react/button";
import { SkeletonRows } from "@/components/ui-react/skeleton";
import { openCollection, openSiteSettings } from "@/lib/admin/actions";
import { timeAgo } from "@/lib/admin/format";
import {
	$commits,
	$commitsLoading,
	$sites,
	$scan,
	$site,
	$user,
	currentSiteEntry,
} from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { AvatarCircle, Icon } from "../parts";

export default function OverviewView() {
	const sites = useStore($sites);
	const activeSite = useStore($site);
	const scan = useStore($scan);
	const commits = useStore($commits);
	const commitsLoading = useStore($commitsLoading);
	const user = useStore($user);
	const site = sites.find((s) => s.repoFullName === activeSite);
	if (!site) return null;

	const entry = currentSiteEntry();
	const url = entry?.url ?? scan?.siteUrl ?? "";
	const title = url || scan?.siteUrl || site.name;

	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			<div className="mb-5 flex flex-wrap items-center gap-3">
				<h2 className="text-xl font-semibold">{title}</h2>
				{scan?.astroConfigFound && (
					<Badge variant="outline" size="sm">
						Astro
					</Badge>
				)}
				<div className="ml-auto flex items-center gap-2">
					{url && (
						<Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
							{t("overview.visit")}
						</Button>
					)}
					<Button variant="outline" size="sm" onClick={() => openSiteSettings()}>
						{t("sidebar.siteSettings")}
					</Button>
				</div>
			</div>

			<h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t("overview.collections")}</h3>
			<div className="mb-6 grid gap-2 sm:grid-cols-2">
				{(scan?.collections ?? []).map((def) => (
					<button
						key={def.key}
						type="button"
						onClick={() => void openCollection(def.key)}
						className="flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-accent/40"
					>
						<Icon name="folder" className="size-5 text-muted-foreground" />
						<span className="min-w-0">
							<span className="block truncate text-sm font-medium">{def.name}</span>
							<span className="block truncate text-xs text-muted-foreground">
								{t("overview.stats", { entries: def.entryCount, fields: def.fields.length, base: def.base })}
							</span>
						</span>
						<Icon name="chevron-right" className="ml-auto size-4 text-muted-foreground" />
					</button>
				))}
				{(scan?.collections.length ?? 0) === 0 && (
					<p className="col-span-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
						{t("overview.noCollections")}
					</p>
				)}
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
				<div>
					<h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t("overview.recent")}</h3>
					<div className="rounded-xl border border-border">
						{commitsLoading && commits.length === 0 ? (
							<SkeletonRows rows={4} />
						) : commits.length === 0 ? (
							<p className="px-3 py-4 text-xs text-muted-foreground">{t("overview.noCommits")}</p>
						) : (
							commits.map((commit, index) => (
								<div key={commit.sha} className={`flex items-center gap-3 px-3 py-2.5 ${index > 0 ? "border-t border-border" : ""}`}>
									<AvatarCircle name={commit.authorName} />
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm">{commit.message.split("\n")[0] ?? commit.message}</span>
										<span className="block text-xs text-muted-foreground">
											{commit.authorName} · {timeAgo(commit.date)}
										</span>
									</span>
									<a
										href={`https://github.com/${activeSite}/commit/${commit.sha}`}
										target="_blank"
										rel="noopener"
										className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground"
									>
										{commit.sha.slice(0, 7)}
									</a>
								</div>
							))
						)}
					</div>
				</div>
				<div>
					<h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t("overview.site")}</h3>
					<div className="space-y-1 rounded-xl border border-border p-3 text-xs text-muted-foreground">
						<p>{t("overview.repo", { value: site.repoFullName })}</p>
						<p>{t("overview.branch", { value: site.branch })}</p>
						<p>{t("overview.url", { value: entry?.url ?? scan?.siteUrl ?? "—" })}</p>
						<p>{t("overview.media", { value: entry?.media ?? scan?.media ?? "—" })}</p>
						<p>
							{t("overview.publish")}{" "}
							{entry?.publishing === "review"
								? t("overview.publishReview")
								: entry?.publishing === "immediate"
									? t("overview.publishNow")
									: t("overview.publishDefault")}
						</p>
					</div>
					<h3 className="mb-2 mt-4 text-sm font-semibold text-muted-foreground">{t("overview.team")}</h3>
					<div className="rounded-xl border border-border p-3 text-xs">
						<div className="flex items-center gap-2">
							<AvatarCircle name={user?.name ?? "?"} className="size-6 text-[10px]" />
							<span className="min-w-0">
								<span className="block truncate text-xs font-medium">{user?.name ?? "…"}</span>
								<span className="block text-[10px] text-muted-foreground">Owner</span>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
