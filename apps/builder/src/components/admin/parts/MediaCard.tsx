// Medya ızgara kartı — GitCMS düzeni: görsel kartın tamamını doldurur, altta
// kalıcı şeritte ad + biçim rozeti durur; bağlantı/aç/sil sağ üstte hover'da.

import { useState } from "react";
import { deleteMedia, mediaLinkFor, mediaPreviewUrl, type MediaItem } from "@/lib/admin/media";
import { formatSize, IMAGE_EXT } from "@/lib/admin/format";
import { Icon } from "../parts";

/** Uzantı rozeti: webp → WEBP (GitCMS "JPEG" rozetinin karşılığı). */
export function formatBadge(path: string): string {
	return (path.split(".").pop() ?? "").toUpperCase().slice(0, 5);
}

function CopyLink({ path }: { path: string }) {
	const [copied, setCopied] = useState(false);
	return (
		<button
			type="button"
			title={copied ? "Kopyalandı ✓" : "Bağlantıyı kopyala"}
			onClick={() => {
				void navigator.clipboard?.writeText(mediaLinkFor(path));
				setCopied(true);
				setTimeout(() => setCopied(false), 1200);
			}}
			className={`flex size-7 items-center justify-center rounded-lg bg-black/55 backdrop-blur-xs transition-colors hover:bg-black/75 ${
				copied ? "text-emerald-300" : "text-white/90"
			}`}
		>
			<Icon name={copied ? "check" : "link"} className="size-3.5" />
		</button>
	);
}

/** Kart üstü yarı saydam simge düğme stilleri (grid + liste ortak). */
export const cardActionCls =
	"flex size-7 items-center justify-center rounded-lg bg-black/55 text-white/90 backdrop-blur-xs transition-colors hover:bg-black/75";

export function MediaCard({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
	const [imgFailed, setImgFailed] = useState(false);
	const preview = mediaPreviewUrl(item.path);
	const name = item.path.split("/").pop() ?? item.path;
	const isImage = IMAGE_EXT.test(item.path) && !imgFailed;
	return (
		<div
			className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted/40"
			title={`${name} · ${formatSize(item.size)}`}
			data-testid="media-card"
			data-path={item.path}
		>
			<button
				type="button"
				className="absolute inset-0"
				onClick={onOpen}
				title={isImage ? "Büyüt" : "Önizle"}
				aria-label={name}
			>
				{isImage ? (
					<img
						src={preview}
						alt={name}
						loading="lazy"
						referrerPolicy="no-referrer"
						className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
						onError={() => setImgFailed(true)}
					/>
				) : (
					<span className="flex size-full items-center justify-center text-muted-foreground">
						<Icon name="file" className="size-8" />
					</span>
				)}
			</button>

			{/* Kalıcı şerit — ad solda, biçim rozeti sağda (GitCMS kartı). */}
			<div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2 pt-6">
				<span className="min-w-0 flex-1 truncate text-xs font-medium text-white [text-shadow:0_1px_2px_rgb(0_0_0/60%)]">
					{name}
				</span>
				<span className="shrink-0 rounded bg-white/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/85">
					{formatBadge(item.path)}
				</span>
			</div>

			{/* İşlemeler — sağ üst, yalnız hover/odakta (dokunmatikte kalıcı). */}
			<div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
				<CopyLink path={item.path} />
				<a
					href={preview}
					target="_blank"
					rel="noopener"
					title="Yeni sekmede aç"
					className={cardActionCls}
				>
					<Icon name="external" className="size-3.5" />
				</a>
				<button
					type="button"
					title="Sil"
					data-testid="media-delete"
					onClick={() => void deleteMedia(item.path)}
					className="flex size-7 items-center justify-center rounded-lg bg-black/55 text-white/90 backdrop-blur-xs transition-colors hover:bg-red-600/80"
				>
					<Icon name="trash" className="size-3.5" />
				</button>
			</div>
		</div>
	);
}
