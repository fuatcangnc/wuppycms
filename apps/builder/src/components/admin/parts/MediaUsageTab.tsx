// Medya detayı — "Kullanılan yer" sekmesi: tarama TanStack Query'dedir; sekme
// kapanıp açıldığında önbellekten gelir, yeniden ağ isteği olmaz.

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@nanostores/react";
import { scanUsage, type MediaUsageScan } from "@/lib/admin/media";
import { $collections, currentSite } from "@/lib/admin/store";
import { Icon } from "../parts";

export type MediaUseRow = MediaUsageScan["uses"][number];

export function usageQueryKey(repo?: string, branch?: string, path?: string) {
	return ["media-usage", repo, branch, path] as const;
}

export function MediaUsageTab({
	path,
	onOpen,
}: {
	path: string;
	onOpen: (use: MediaUseRow) => void;
}) {
	const collections = useStore($collections);
	const site = currentSite();
	const { data, isFetching } = useQuery({
		queryKey: usageQueryKey(site?.repoFullName, site?.branch, path),
		queryFn: () => scanUsage(path),
		enabled: Boolean(site),
		staleTime: 60_000,
	});

	const uses = data?.uses;
	const note = !data && isFetching
		? "İçerikler taranıyor…"
		: data
			? `${data.scanned} dosya tarandı${data.truncated ? " (ağaç kesik — tüm dosyalar taranmadı)" : ""}`
			: "";

	return (
		<div className="flex flex-col gap-2">
			<p className="text-xs text-muted-foreground">
				Bu dosyanın kullanıldığı içerikler{note ? ` · ${note}` : ""}
			</p>
			{(uses ?? []).map((use) => (
				<div
					key={use.path}
					className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
				>
					<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
						<Icon name="book" className="size-4" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm font-medium">{use.title}</span>
						<span className="block truncate text-xs text-muted-foreground">
							{collections.find((c) => c.key === use.collectionKey)?.name ??
								use.path.split("/").slice(-2, -1)[0] ??
								"—"}{" "}
							· {use.field === "gövde" ? "gövde" : use.field}
						</span>
					</span>
					<button
						type="button"
						onClick={() => onOpen(use)}
						className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						Aç <Icon name="external" className="size-3" />
					</button>
				</div>
			))}
			{data && uses?.length === 0 && (
				<p className="py-6 text-center text-sm text-muted-foreground">
					Bu dosya hiçbir içerikte kullanılmıyor.
				</p>
			)}
		</div>
	);
}
