// İncelemeler (parity 2b-ii) — açık pull request'ler: karar durumu, satır
// diff'i, onayla / değişiklik iste, birleştir (yayın) ve kapat. Her şey
// repo'da yaşar (ADR 0006); bu görünüm yalnız yürütücüdür.

import { useStore } from "@nanostores/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui-react/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
} from "@/components/ui-react/dialog";
import { SkeletonRows } from "@/components/ui-react/skeleton";
import * as api from "@/lib/admin/api";
import type { PullRequestRow } from "@/lib/admin/api";
import { closeReviewPull, decideReview, mergeReviewPull } from "@/lib/admin/actions";
import { diffLines, diffStats } from "@/lib/admin/diff";
import { timeAgo } from "@/lib/admin/format";
import { $site } from "@/lib/admin/store";
import { t } from "@/lib/i18n";
import { Icon } from "../parts";

function DecisionBadge({ decision }: { decision: PullRequestRow["decision"] }) {
	if (decision === "approved") {
		return <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">{t("review.approved")}</span>;
	}
	if (decision === "changes_requested") {
		return <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">{t("review.changesRequested")}</span>;
	}
	return <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">{t("review.pending")}</span>;
}

/** Diff diyaloğu — karşılaştırma + dosya başına satır diff'i. */
function DiffDialog({ repo, pull, onClose }: { repo: string; pull: PullRequestRow; onClose: () => void }) {
	const [file, setFile] = useState<string>("");
	const compare = useQuery({
		queryKey: ["reviewDiff", repo, pull.number],
		queryFn: () => api.compareRefs(repo, pull.base, pull.head),
	});
	const baseFile = useQuery({
		queryKey: ["reviewFile", repo, pull.number, file, pull.base],
		queryFn: () => api.getFile(repo, file, pull.base),
		enabled: Boolean(file),
	});
	const headFile = useQuery({
		queryKey: ["reviewFile", repo, pull.number, file, pull.head],
		queryFn: () => api.getFile(repo, file, pull.head),
		enabled: Boolean(file),
	});
	const rows = useMemo(
		() => (baseFile.data && headFile.data ? diffLines(baseFile.data.content, headFile.data.content) : []),
		[baseFile.data, headFile.data],
	);
	const stats = useMemo(() => diffStats(rows), [rows]);

	return (
		<Dialog open onClose={onClose}>
			<DialogOverlay />
			<DialogContent className="sm:max-w-3xl">
				<DialogHeader>
					<DialogTitle>{t("review.diffTitle", { number: pull.number })}</DialogTitle>
					<DialogDescription>
						{pull.base} ← {pull.head}
						{file && ` · ${file} · +${stats.added} −${stats.removed}`}
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<div className="flex flex-wrap gap-1">
						{(compare.data?.files ?? []).map((changed) => (
							<button
								key={changed.filename}
								type="button"
								onClick={() => setFile(changed.filename)}
								className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
									file === changed.filename ? "border-primary text-foreground" : "border-border text-muted-foreground hover:text-foreground"
								}`}
							>
								{changed.filename}
							</button>
						))}
						{compare.isLoading && <span className="text-xs text-muted-foreground">{t("common.loading")}</span>}
					</div>
					{file &&
						(baseFile.isLoading || headFile.isLoading ? (
							<p className="text-xs text-muted-foreground">{t("review.loadingVersions")}</p>
						) : (
							<pre className="max-h-[45vh] overflow-auto rounded-md border border-border p-2 font-mono text-xs leading-5">
								{rows.slice(0, 600).map((row, index) => (
									<div
										key={index}
										className={
											row.type === "add"
												? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
												: row.type === "del"
													? "bg-red-500/10 text-red-900 dark:text-red-200"
													: ""
										}
									>
										<span className="mr-2 inline-block w-3 select-none text-muted-foreground/60">
											{row.type === "add" ? "+" : row.type === "del" ? "−" : " "}
										</span>
										{row.text || " "}
									</div>
								))}
								{rows.length > 600 && <div className="text-muted-foreground">{t("panel.moreLines", { count: rows.length - 600 })}</div>}
							</pre>
						))}
				</div>
				<DialogFooter className="flex flex-row justify-end">
					<Button type="button" variant="secondary" size="sm" onClick={onClose}>
						{t("common.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function ReviewView() {
	const repo = useStore($site);
	const [diffPull, setDiffPull] = useState<PullRequestRow | null>(null);
	const query = useQuery({
		queryKey: ["reviews", repo],
		queryFn: () => api.listReviewPulls(repo, "open"),
		enabled: Boolean(repo),
	});
	const pulls = query.data?.pulls ?? [];

	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			<div className="mb-4 flex items-baseline justify-between gap-3">
				<h2 className="flex items-baseline gap-2 text-lg font-semibold">
					{t("review.title")}
					<span className="text-xs font-normal text-muted-foreground">{t("review.openCount", { count: pulls.length })}</span>
				</h2>
				<p className="text-xs text-muted-foreground">
					{t("review.hint")}
				</p>
			</div>
			<div className="overflow-hidden rounded-xl border border-border">
				{query.isLoading && <SkeletonRows rows={3} />}
				{pulls.map((pull) => (
					<div key={pull.number} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
						<Icon name="check" className="size-4 shrink-0 text-muted-foreground" />
						<span className="min-w-0 flex-1">
							<span className="flex items-center gap-2">
								<span className="truncate text-sm font-medium">{pull.title}</span>
								<DecisionBadge decision={pull.decision} />
							</span>
							<span className="block truncate font-mono text-[11px] text-muted-foreground">
								#{pull.number} · {pull.base} ← {pull.head} · {pull.author} · {timeAgo(pull.createdAt)}
							</span>
						</span>
						<span className="flex shrink-0 items-center gap-1">
							<Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDiffPull(pull)}>
								{t("review.diff")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => void decideReview(pull.number, "REQUEST_CHANGES")}
							>
								{t("review.requestChanges")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs"
								onClick={() => void decideReview(pull.number, "APPROVE")}
							>
								{t("review.approve")}
							</Button>
							<Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => void mergeReviewPull(pull.number)}>
								{t("review.merge")}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs text-destructive hover:text-destructive"
								onClick={() => void closeReviewPull(pull.number)}
							>
								{t("review.close")}
							</Button>
						</span>
					</div>
				))}
				{!query.isLoading && pulls.length === 0 && (
					<p className="px-3 py-8 text-center text-sm text-muted-foreground">
						{t("review.empty")}
					</p>
				)}
			</div>
			{diffPull && repo && <DiffDialog repo={repo} pull={diffPull} onClose={() => setDiffPull(null)} />}
		</div>
	);
}
