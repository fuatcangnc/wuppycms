// Medya lightbox'ı — tam ekran görsel inceleme: klasör içinde gezinme (oklar),
// yakınlaştırma (−/%/+), indirme ve kapatma. GitCMS lightbox davranışının
// WuppyCMS karşılığı; sınıflar bizim token'larımızla kuruludur.

import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui-react/dialog";
import { mediaLinkFor, mediaPreviewUrl, type MediaItem } from "@/lib/admin/media";
import { Icon } from "../parts";

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

function BarButton({
	label,
	onClick,
	disabled,
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
		>
			{children}
		</button>
	);
}

export function MediaLightbox({
	items,
	index,
	onIndex,
	onClose,
}: {
	items: MediaItem[];
	index: number;
	onIndex: (next: number) => void;
	onClose: () => void;
}) {
	const [zoom, setZoom] = useState(1);
	const item = items[index];

	// Yakınlaştırma adımını koruyarak ileri/geri adım at.
	const step = (delta: number) => {
		const next = index + delta;
		if (next < 0 || next >= items.length) return;
		setZoom(1);
		onIndex(next);
	};

	const zoomTo = (factorOrValue: number, relative = false) =>
		setZoom((z) => {
			const next = relative ? z * factorOrValue : factorOrValue;
			return Math.min(ZOOM_STEPS[ZOOM_STEPS.length - 1], Math.max(ZOOM_STEPS[0], next));
		});

	useEffect(() => {
		// Escape'i Bejamas Dialog yığını kapatıyor; ok/zoom tuşları lightbox'a
		// ait ve alt katmanlara (editör) iletilmez.
		const onKey = (event: KeyboardEvent) => {
			if (
				event.key !== "ArrowLeft" &&
				event.key !== "ArrowRight" &&
				event.key !== "+" &&
				event.key !== "=" &&
				event.key !== "-" &&
				event.key !== "0"
			) {
				return;
			}
			event.stopPropagation();
			if (event.key === "ArrowRight") step(1);
			else if (event.key === "ArrowLeft") step(-1);
			else if (event.key === "+" || event.key === "=") zoomTo(1.25, true);
			else if (event.key === "-") zoomTo(1 / 1.25, true);
			else if (event.key === "0") setZoom(1);
		};
		window.addEventListener("keydown", onKey, true);
		return () => window.removeEventListener("keydown", onKey, true);
	});

	if (!item) return null;
	const name = item.path.split("/").pop() ?? item.path;
	const preview = mediaPreviewUrl(item.path);

	return (
		<Dialog open onClose={onClose}>
			<DialogOverlay className="bg-black/95 supports-backdrop-filter:backdrop-blur-none" />
			{/* Bejamas Dialog iskeleti, tam ekran lightbox sınıf örtmesiyle. */}
			<DialogContent
				showCloseButton={false}
				aria-label={name}
				className="fixed inset-0 top-0 left-0 flex h-dvh max-w-none flex-col -translate-x-0 -translate-y-0 grid-cols-1 gap-0 overflow-hidden rounded-none bg-transparent p-0 ring-0 sm:max-w-none"
			>
				{/* Üst şerit: ad + sayaç */}
				<div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-white/70">
				<span className="truncate font-mono">{mediaLinkFor(item.path)}</span>
				<span className="shrink-0 tabular-nums">
					{index + 1} / {items.length}
				</span>
			</div>

			{/* Görsel alanı — boşluğa tıklama kapatır (eskisi gibi). */}
			<div
				className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-14"
				onMouseDown={(event) => event.target === event.currentTarget && onClose()}
			>
				<img
					src={preview}
					alt={item.path}
					referrerPolicy="no-referrer"
					draggable={false}
					style={{ transform: `scale(${zoom})` }}
					className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
					onDoubleClick={() => setZoom(1)}
				/>
				{index > 0 && (
					<button
						type="button"
						aria-label="Önceki görsel"
						onClick={() => step(-1)}
						className="absolute left-3 flex size-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
					>
						<Icon name="chevron-right" className="size-6 rotate-180" />
					</button>
				)}
				{index < items.length - 1 && (
					<button
						type="button"
						aria-label="Sonraki görsel"
						onClick={() => step(1)}
						className="absolute right-3 flex size-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
					>
						<Icon name="chevron-right" className="size-6" />
					</button>
				)}
			</div>

			{/* Alt araç çubuğu — GitCMS düzeni: − % + · indir · kapat */}
			<div className="flex justify-center px-4 pb-5">
				<div className="flex items-center gap-1 rounded-xl bg-neutral-900 px-1.5 py-1 shadow-lg ring-1 ring-white/10">
					<BarButton label="Uzaklaş" onClick={() => zoomTo(1 / 1.25, true)} disabled={zoom <= ZOOM_STEPS[0]}>
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
							<path d="M5 12h14" />
						</svg>
					</BarButton>
					<button
						type="button"
						onClick={() => setZoom(1)}
						title="Sığdır (0)"
						className="min-w-12 rounded-md px-2 py-1 text-center text-xs tabular-nums text-white/90 transition-colors hover:bg-white/10"
					>
						{Math.round(zoom * 100)}%
					</button>
					<BarButton label="Yakınlaş" onClick={() => zoomTo(1.25, true)} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
							<path d="M12 5v14M5 12h14" />
						</svg>
					</BarButton>
					<span className="mx-1 h-5 w-px bg-white/10" />
					<a
						href={preview}
						download={name}
						aria-label="İndir"
						title="İndir"
						className="flex size-8 items-center justify-center rounded-md text-white/90 transition-colors hover:bg-white/10"
					>
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M12 15V3" />
							<path d="M7 10l5 5 5-5" />
							<path d="M5 21h14" />
						</svg>
					</a>
					<BarButton label="Kapat" onClick={onClose}>
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
							<path d="M18 6 6 18M6 6l12 12" />
						</svg>
					</BarButton>
				</div>
			</div>
			</DialogContent>
		</Dialog>
	);
}
