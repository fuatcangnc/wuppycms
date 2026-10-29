// İstemci tarafı görsel kırpma — react-easy-crop ile (GitCMS "Edit image"
// sekmesinin karşısı). Çıktı ya aynı yola yazılır (orijinali değiştir) ya da
// "-crop" sonekli kopya olur; sunucuya ham bayt değil kırpılmış blob gider.

import { useRef, useState, type MouseEvent } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Button } from "@/components/ui-react/button";
import { Label } from "@/components/ui-react/label";
import { t } from "@/lib/i18n";
import { Icon } from "../parts";

const ASPECTS: { value: string; label: string; labelKey?: string; ratio?: number }[] = [
	{ value: "orig", label: "Orijinal", labelKey: "media.aspectOrig" },
	{ value: "1:1", label: "1:1 Kare", labelKey: "media.aspectSquare", ratio: 1 },
	{ value: "4:3", label: "4:3", ratio: 4 / 3 },
	{ value: "3:2", label: "3:2", ratio: 3 / 2 },
	{ value: "16:9", label: "16:9", ratio: 16 / 9 },
	{ value: "9:16", label: "9:16 Dikey", labelKey: "media.aspectVertical", ratio: 9 / 16 },
];

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(t("media.cropLoadFailed")));
		img.src = src;
	});
}

/** Doğal piksel alanını tuvale çizer (croppedAreaPixels doğal birimdedir). */
async function cropToBlob(src: string, area: Area, type: string): Promise<Blob> {
	const img = await loadImage(src);
	const x = Math.round(area.x);
	const y = Math.round(area.y);
	const width = Math.round(area.width);
	const height = Math.round(area.height);
	const canvas = document.createElement("canvas");
	canvas.width = Math.max(1, width);
	canvas.height = Math.max(1, height);
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error(t("media.canvasUnsupported"));
	ctx.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error(t("media.cropExportFailed")))),
			type,
			0.92,
		),
	);
}

export function MediaCropPanel({
	image,
	sourcePath,
	busy,
	onSave,
	focal,
	onSaveFocal,
}: {
	image: string;
	/** Orijinal depo/kova yolu — çıktı biçimini belirler. */
	sourcePath: string;
	busy: boolean;
	onSave: (mode: "replace" | "copy", blob: Blob) => Promise<void>;
	/** Kayıtlı odak noktası (yüzde; manifest) — yoksa null. */
	focal?: { x: number; y: number } | null;
	/** Odak noktasını manifeste yazar (P2+ parity: focal point). */
	onSaveFocal: (focal: { x: number; y: number }) => Promise<void>;
}) {
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [aspect, setAspect] = useState("orig");
	const [area, setArea] = useState<Area | null>(null);
	const [focalDraft, setFocalDraft] = useState<{ x: number; y: number } | null>(focal ?? null);
	const [focalNote, setFocalNote] = useState("");
	const boxRef = useRef<HTMLDivElement>(null);

	const ratio = ASPECTS.find((a) => a.value === aspect)?.ratio;
	const ext = (sourcePath.split(".").pop() ?? "").toLowerCase();
	const outType = ext === "png" ? "image/png" : "image/webp";

	const save = async (mode: "replace" | "copy") => {
		if (!area) return;
		const blob = await cropToBlob(image, area, outType);
		await onSave(mode, blob);
	};

	/** Mini önizlemede tıklanan noktayı yüzdeye çevirir. */
	const pickFocal = (event: MouseEvent<HTMLDivElement>) => {
		const rect = event.currentTarget.getBoundingClientRect();
		setFocalDraft({
			x: Math.min(100, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * 100))),
			y: Math.min(100, Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * 100))),
		});
		setFocalNote("");
	};

	const saveFocal = async () => {
		if (!focalDraft) return;
		await onSaveFocal(focalDraft);
		setFocalNote(t("media.focalSaved"));
	};

	return (
		<div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_260px]">
			<div
				ref={boxRef}
				className="relative h-72 overflow-hidden rounded-xl border-2 border-dashed border-sky-500/60 bg-black sm:h-96"
			>
				<Cropper
					image={image}
					crop={crop}
					zoom={zoom}
					aspect={ratio}
					showGrid
					onCropChange={setCrop}
					onZoomChange={setZoom}
					// ikinci argüman doğal piksel cinsinden kırpma alanıdır
					onCropComplete={(_a, pixels) => setArea(pixels)}
				/>
			</div>

			<div className="flex flex-col gap-3">
				<div>
					<Label htmlFor="crop-aspect" className="mb-1 w-full justify-start text-xs">
						{t("media.aspectRatio")}
					</Label>
					<select
						id="crop-aspect"
						value={aspect}
						onChange={(event) => setAspect(event.target.value)}
						className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						{ASPECTS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.labelKey ? t(option.labelKey) : option.label}
							</option>
						))}
					</select>
				</div>

				<div className="flex items-center gap-2">
					<span className="text-xs font-medium">{t("media.zoom")}</span>
					<div className="ml-auto flex items-center gap-1">
						<button
							type="button"
							title={t("media.zoomOut")}
							onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
							className="flex size-7 items-center justify-center rounded-lg border border-border text-xs hover:bg-muted"
						>
							−
						</button>
						<span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
							×{zoom.toFixed(2)}
						</span>
						<button
							type="button"
							title={t("media.zoomIn")}
							onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100))}
							className="flex size-7 items-center justify-center rounded-lg border border-border text-xs hover:bg-muted"
						>
							+
						</button>
					</div>
				</div>

				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						setCrop({ x: 0, y: 0 });
						setZoom(1);
						setAspect("orig");
					}}
				>
					<Icon name="chevron-right" className="size-3.5 rotate-180" /> {t("media.reset")}
				</Button>

				<div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
					<span className="text-muted-foreground">{t("media.outputSize")} </span>
					<span className="font-medium tabular-nums">
						{area ? `${Math.round(area.width)} × ${Math.round(area.height)}` : "—"}
					</span>
				</div>

				{/* P2+ parity: odak noktası — kırpmadan ayrı, manifeste yazılır. */}
				<div>
					<span className="text-xs font-medium">{t("media.focal")}</span>
					<p className="mt-0.5 text-[11px] text-muted-foreground">
						{t("media.focalHint")}
					</p>
					<div
						className="relative mt-1 w-full cursor-crosshair overflow-hidden rounded-lg border border-border"
						onClick={pickFocal}
						role="button"
						aria-label={t("media.focalAria")}
					>
						<img src={image} alt="" className="h-24 w-full object-cover" draggable={false} />
						{focalDraft && (
							<span
								className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow"
								style={{ left: `${focalDraft.x}%`, top: `${focalDraft.y}%` }}
							/>
						)}
					</div>
					<div className="mt-1.5 flex items-center gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="h-7 px-2 text-xs"
							disabled={!focalDraft || busy}
							onClick={() => void saveFocal()}
						>
							{t("media.focalSave")}
						</Button>
						{focalDraft && (
							<span className="text-[11px] tabular-nums text-muted-foreground">
								%{focalDraft.x} · %{focalDraft.y}
							</span>
						)}
					</div>
					{focalNote && <p className="mt-1 text-[11px] text-emerald-600">{focalNote}</p>}
				</div>

				<div className="mt-auto flex flex-wrap justify-end gap-2">
					<Button
						size="sm"
						variant="outline"
						disabled={!area || busy}
						onClick={() => void save("copy")}
					>
						{t("media.croppedCopy")}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={!area || busy}
						className="text-red-600 hover:text-red-600"
						onClick={() => {
							if (window.confirm(t("media.replaceConfirm"))) {
								void save("replace");
							}
						}}
					>
						{t("media.replaceOriginal")}
					</Button>
				</div>
			</div>
		</div>
	);
}
