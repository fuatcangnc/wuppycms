// Medya detay diyaloğu — GitCMS "Media details" karşılığı: önizleme + meta,
// ad-klasör-değiştir, alt metin ve caption D1'de; "Görseli düzenle" istemci
// kırpma (react-easy-crop, sekme açılınca tembel yüklenir); "Kullanılan yer"
// içerik taraması. Sunum parçaları: parts/MediaDetailsPreview, parts/MediaUsageTab.

import { t } from "@/lib/i18n";
import { useStore } from "@nanostores/react";
import { lazy, Suspense, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { Label } from "@/components/ui-react/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-react/tabs";
import { Textarea } from "@/components/ui-react/textarea";
import { openDoc } from "@/lib/admin/actions";
import {
	deleteMedia,
	mediaLinkFor,
	mediaPreviewUrl,
	moveMediaTo,
	replaceMedia,
	saveMediaMeta,
	uploadCroppedCopy,
	type MediaItem,
} from "@/lib/admin/media";
import { mediaLink, optimizeImage } from "@/lib/admin/imaging";
import {
	$collection,
	$collections,
	$media,
	$mediaAlts,
	$mediaCaptions,
	$mediaFocals,
	$mediaWidths,
	mediaRelPath,
	mediaStorage,
	showError,
} from "@/lib/admin/store";
import { DialogShell } from "./DialogShell";
import { Icon } from "../parts";
import { MediaDetailsPreview } from "../parts/MediaDetailsPreview";
import { MediaUsageTab, type MediaUseRow } from "../parts/MediaUsageTab";

// react-easy-crop yalnız "Görseli düzenle" sekmesinde gerekir; adayı şişirmesin.
const MediaCropPanel = lazy(() =>
	import("../parts/MediaCropPanel").then((m) => ({ default: m.MediaCropPanel })),
);

type Tab = "details" | "edit" | "usage";

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Label className="items-start gap-1 text-xs">
			{label}
			{children}
		</Label>
	);
}

export function MediaDetailsDialog({
	item,
	onClose,
	onZoom,
}: {
	item: MediaItem;
	onClose: () => void;
	onZoom: () => void;
}) {
	const files = useStore($media);
	const alts = useStore($mediaAlts);
	const captions = useStore($mediaCaptions);
	const focals = useStore($mediaFocals);
	const widths = useStore($mediaWidths);
	const st = mediaStorage();

	const name0 = item.path.split("/").pop() ?? item.path;
	const rel0 = mediaRelPath(item.path);
	const dir0 = rel0.includes("/") ? rel0.slice(0, rel0.lastIndexOf("/")) : "";

	const [tab, setTab] = useState<Tab>("details");
	const [dir, setDir] = useState(dir0);
	const [alt, setAlt] = useState(alts[item.path] ?? "");
	const [caption, setCaption] = useState(captions[item.path] ?? "");
	const [width, setWidth] = useState(widths[item.path] ? String(widths[item.path]) : "");
	const [linkNote, setLinkNote] = useState("");
	const [busy, setBusy] = useState(false);
	const replaceInput = useRef<HTMLInputElement>(null);

	const isImage = /\.(png|jpe?g|webp|gif|avif)$/i.test(item.path);
	const preview = mediaPreviewUrl(item.path);

	// Kitaplıktaki klasörler (Konum seçeneği) — liste bellekte zaten.
	const folders = useMemo(
		() =>
			[
				...new Set(
					files
						.map((f) => {
							const rel = mediaRelPath(f.path);
							return rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
						})
						.filter(Boolean),
				),
			].sort(),
		[files],
	);

	// Ad sabittir (salt okunur alan) — yalnız Konum değişikliği taşıma üretir.
	const targetPath = [st.root, dir, name0].filter(Boolean).join("/");
	const savedWidth = widths[item.path] ? String(widths[item.path]) : "";
	const dirty =
		targetPath !== item.path ||
		alt !== (alts[item.path] ?? "") ||
		caption !== (captions[item.path] ?? "") ||
		width.trim() !== savedWidth;

	const save = async () => {
		if (busy) return;
		setBusy(true);
		try {
			let path = item.path;
			if (targetPath !== item.path) {
				// Yalnız klasör taşıması: ad değiştirilemez (kullanıcı kararı).
				const ok = window.confirm(
					t("dialog.moveConfirm", {
						from: name0,
						to: targetPath.replace(`${st.root}/`, ""),
					}),
				);
				if (!ok) return;
				const moved = await moveMediaTo(item.path, targetPath);
				if (!moved) return;
				path = targetPath;
			}
			if (
				alt !== (alts[item.path] ?? "") ||
				caption !== (captions[item.path] ?? "") ||
				width.trim() !== savedWidth
			) {
				await saveMediaMeta(path, {
					alt,
					caption,
					width: width.trim() === "" ? null : Number(width),
				});
			}
			onClose();
		} finally {
			setBusy(false);
		}
	};

	const doReplace = async (file: File) => {
		setBusy(true);
		try {
			const result = await optimizeImage(file);
			await replaceMedia(item.path, result.blob);
		} catch (error) {
			showError(error instanceof Error ? error.message : t("dialog.imageReplaceFailed"));
		} finally {
			setBusy(false);
		}
	};

	const cropSave = async (mode: "replace" | "copy", blob: Blob) => {
		setBusy(true);
		try {
			if (mode === "replace") await replaceMedia(item.path, blob);
			else await uploadCroppedCopy(item.path, blob);
			setTab("details");
		} finally {
			setBusy(false);
		}
	};

	const openUse = async (use: MediaUseRow) => {
		onClose();
		if (use.collectionKey && $collections.get().some((c) => c.key === use.collectionKey)) {
			$collection.set(use.collectionKey);
		}
		await openDoc(use.path);
	};

	return (
		<DialogShell panelClassName="w-[94vw] max-w-4xl sm:max-w-4xl gap-0 p-0 sm:p-0" onClose={onClose}>
			<div className="flex items-start justify-between px-6 pt-5">
				<div>
					<h3 className="text-sm font-semibold">{t("dialog.mediaDetailsTitle")}</h3>
					<p className="text-xs text-muted-foreground">{name0}</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label={t("common.close")}
					className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<Icon name="x" className="size-4" />
				</button>
			</div>

			<Tabs value={tab} onValueChange={(next) => setTab(next as Tab)} className="gap-0">
			<div className="px-6 pt-4">
				<TabsList variant="default" className="w-full">
					<TabsTrigger value="details">{t("dialog.detailsTab")}</TabsTrigger>
					{isImage && <TabsTrigger value="edit">{t("dialog.editTab")}</TabsTrigger>}
					<TabsTrigger value="usage">{t("dialog.usageTab")}</TabsTrigger>
				</TabsList>
			</div>

			<div className="max-h-[70vh] overflow-y-auto px-6 py-5">
				<TabsContent value="details">
					<div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_300px]">
						<MediaDetailsPreview item={item} alt={alt} onZoom={onZoom} />

						<div className="flex flex-col gap-3">
							<Field label={t("dialog.fileName")}>
								<Input
									size="sm"
									value={name0}
									readOnly
									aria-readonly="true"
									title={t("dialog.fileNameLocked")}
								/>
							</Field>
							<Field label={t("dialog.location")}>
								<select
									value={dir}
									onChange={(event) => setDir(event.target.value)}
									className="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
								>
									<option value="">{t("dialog.libraryRoot", { root: st.root || "kök" })}</option>
									{folders.map((folder) => (
										<option key={folder} value={folder}>
											{folder}/
										</option>
									))}
								</select>
							</Field>
							<Field label={t("dialog.altLabel")}>
								<Textarea
									rows={2}
									placeholder={t("dialog.altPlaceholder")}
									value={alt}
									onChange={(event) => setAlt(event.target.value)}
								/>
							</Field>
							<Field label={t("dialog.captionLabel")}>
								<Textarea
									rows={2}
									placeholder={t("dialog.captionPlaceholder")}
									value={caption}
									onChange={(event) => setCaption(event.target.value)}
								/>
							</Field>
							<Field label={t("dialog.widthLabel")}>
								<Input
									size="sm"
									type="number"
									min={5}
									max={100}
									placeholder={t("dialog.widthPlaceholder")}
									value={width}
									onChange={(event) => setWidth(event.target.value)}
								/>
							</Field>
							<Field label={t("dialog.linkLabel")}>
								<div className="flex items-center gap-1.5">
									<code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-2 py-1 font-mono text-[11px]">
										{mediaLinkFor(item.path)}
									</code>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="h-7 px-2 text-xs"
										onClick={() => {
											void navigator.clipboard?.writeText(mediaLinkFor(item.path));
											setLinkNote("kopyalandı ✓");
										}}
									>
										Kopyala
									</Button>
									{st.linkFormat === "media-uri" && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-7 px-2 text-xs"
											title={t("dialog.unapplyTitle")}
											onClick={() => {
												const resolved = mediaLink("relative", item.path, st.root, st.siteUrl);
												void navigator.clipboard?.writeText(resolved);
												setLinkNote(t("dialog.unapplyNote", { link: resolved }));
											}}
										>
											{t("dialog.unapply")}
										</Button>
									)}
								</div>
								{linkNote && <span className="text-[11px] text-muted-foreground">{linkNote}</span>}
							</Field>
						</div>
					</div>
				</TabsContent>

				{isImage && (
					<TabsContent value="edit">
						<Suspense
							fallback={
								<div className="h-64 animate-pulse rounded-xl bg-muted/50" aria-label="Düzenleyici yükleniyor…" />
							}
						>
							<MediaCropPanel
								image={preview}
								sourcePath={item.path}
								busy={busy}
								onSave={cropSave}
								focal={focals[item.path] ?? null}
								onSaveFocal={async (focal) => {
									await saveMediaMeta(item.path, { focal });
								}}
							/>
						</Suspense>
					</TabsContent>
				)}

				<TabsContent value="usage">
					<MediaUsageTab path={item.path} onOpen={(use) => void openUse(use)} />
				</TabsContent>
			</div>
			</Tabs>

			<div className="flex items-center gap-2 border-t border-border px-6 py-4">
				<Button
					size="sm"
					variant="destructive"
					onClick={() => void deleteMedia(item.path).then((ok) => ok && onClose())}
				>
					<Icon name="trash" className="size-3.5" /> Sil
				</Button>
				{tab === "details" && (
					<>
						<input
							ref={replaceInput}
							type="file"
							accept="image/*"
							className="hidden"
							onChange={(event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) void doReplace(file);
							}}
						/>
						<Button size="sm" variant="outline" disabled={busy} onClick={() => replaceInput.current?.click()}>
							<Icon name="chevron-right" className="size-3.5 rotate-180" /> {t("dialog.replaceImage")}
						</Button>
					</>
				)}
				<div className="ml-auto flex gap-2">
					{tab === "details" && (
						<Button size="sm" disabled={!dirty || busy} onClick={() => void save()}>
							{busy ? t("topbar.saving") : t("common.save")}
						</Button>
					)}
					<Button size="sm" variant="secondary" onClick={onClose}>
						{t("common.close")}
					</Button>
				</div>
			</div>
		</DialogShell>
	);
}
