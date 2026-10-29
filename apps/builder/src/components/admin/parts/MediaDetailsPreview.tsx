// Medya detayı — sol önizleme sütunu: lightbox'a götüren görsel, meta çipleri
// ve URL kopyalama satırı. Yükleme tarihi (repo commit'i) Query önbelleğinden.

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listCommits } from "@/lib/admin/api";
import { mediaLinkFor, mediaPreviewUrl, type MediaItem } from "@/lib/admin/media";
import { formatSize } from "@/lib/admin/format";
import { currentSite, mediaStorage } from "@/lib/admin/store";
import { Icon } from "../parts";

function MetaChip({ icon, label, value }: { icon: string; label: string; value: string }) {
	return (
		<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
			<Icon name={icon} className="size-3.5" />
			{label}: <span className="font-medium text-foreground">{value}</span>
		</span>
	);
}

export function MediaDetailsPreview({
	item,
	alt,
	onZoom,
}: {
	item: MediaItem;
	alt: string;
	onZoom: () => void;
}) {
	const name0 = item.path.split("/").pop() ?? item.path;
	const preview = mediaPreviewUrl(item.path);
	// Boyutlar her görsel kurulumunda doğal değerlerden; kopya imi geçici.
	const [dims, setDims] = useState<string>("");
	const [copied, setCopied] = useState(false);

	const site = currentSite();
	const storage = mediaStorage();
	// Yükleme tarihi: depo = dosyanın son commit'i, R2 = nesne zamanı.
	const { data: commitDate } = useQuery({
		queryKey: ["media-commit-date", site?.repoFullName, item.path],
		queryFn: () =>
			listCommits(site!.repoFullName, { path: item.path, perPage: 1 }).then(
				(r) => r.commits[0]?.date ?? "",
			),
		enabled: !item.uploaded && storage.kind === "repo" && Boolean(site),
		staleTime: Infinity,
	});
	const uploaded = item.uploaded || commitDate || "";

	return (
		<div>
			<button
				type="button"
				onClick={onZoom}
				title="Lightbox'ta aç"
				className="block w-full cursor-zoom-in overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/30"
			>
				<img
					src={preview}
					alt={alt || name0}
					referrerPolicy="no-referrer"
					className="mx-auto max-h-80 object-contain"
					onLoad={(event) =>
						setDims(`${event.currentTarget.naturalWidth} × ${event.currentTarget.naturalHeight}`)
					}
				/>
			</button>
			<div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
				<MetaChip icon="file" label="Boyut" value={formatSize(item.size)} />
				<MetaChip icon="grid" label="Boyutlar" value={dims || "—"} />
				<MetaChip
					icon="book"
					label="Yüklendi"
					value={uploaded ? new Date(uploaded).toLocaleString("tr-TR") : "—"}
				/>
				<MetaChip icon="file" label="Biçim" value={name0.split(".").pop()?.toUpperCase() ?? "—"} />
			</div>
			<div className="mt-3 flex items-center gap-1.5">
				<Icon name="link" className="size-3.5 shrink-0 text-muted-foreground" />
				<code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/30 px-2 py-1 text-[11px]">
					{mediaLinkFor(item.path)}
				</code>
				<button
					type="button"
					title="Bağlantıyı kopyala"
					onClick={() => {
						void navigator.clipboard?.writeText(mediaLinkFor(item.path));
						setCopied(true);
						setTimeout(() => setCopied(false), 1200);
					}}
					className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<Icon name={copied ? "check" : "file"} className="size-3.5" />
				</button>
			</div>
		</div>
	);
}
