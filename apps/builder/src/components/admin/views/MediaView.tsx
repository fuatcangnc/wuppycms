// Medya kütüphanesi — GitCMS düzeni: klasör kartları ("Klasörler"), görseller
// ve diğer dosyalar; ızgara⇄liste görünümü, ada göre arama ve tür filtresi.
// Kitaplık (depo/R2), klasör gezme, sürükle-bırak ve klasör oluşturma; tam
// ekran inceleme MediaLightbox'tadır.

import { t } from "@/lib/i18n";
import { useStore } from "@nanostores/react";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui-react/alert";
import { Badge } from "@/components/ui-react/badge";
import { Button } from "@/components/ui-react/button";
import { Input } from "@/components/ui-react/input";
import { SkeletonGrid } from "@/components/ui-react/skeleton";
import {
	createMediaFolder,
	loadMoreMedia,
	mediaKindOf,
	mediaPreviewUrl,
	setMediaFolder,
	setMediaLibrary,
	uploadMedia,
	type MediaItem,
	type MediaKind,
} from "@/lib/admin/media";
import { IMAGE_EXT } from "@/lib/admin/format";
import {
	$media,
	$mediaFolder,
	$mediaLibrary,
	$mediaListView,
	$mediaLoading,
	$mediaNotice,
	$mediaR2More,
	mediaRelPath,
	mediaStorage,
} from "@/lib/admin/store";
import { Icon } from "../parts";
import { MediaCard } from "../parts/MediaCard";
import { MediaLightbox } from "../parts/MediaLightbox";
import { MediaList } from "../parts/MediaList";
import { MediaDetailsDialog } from "../dialogs/MediaDetailsDialog";

/** Tür filtresi seçenekleri — dil değişince tazelensin diye fonksiyon
 *  (modül düzeyinde t() çağrısı dili sabitlerdi). */
const kindOptions = (): { value: "all" | MediaKind; label: string }[] => [
	{ value: "all", label: t("media.kindAll") },
	{ value: "image", label: t("media.kindImage") },
	{ value: "video", label: t("media.kindVideo") },
	{ value: "audio", label: t("media.kindAudio") },
	{ value: "doc", label: t("media.kindDoc") },
	{ value: "other", label: t("media.kindOther") },
];

function SectionTitle({ label, count }: { label: string; count: number }) {
	return (
		<h3 className="mb-2 mt-5 flex items-center gap-2 text-sm font-semibold first:mt-0">
			{label}
			<Badge variant="secondary" shape="pill" size="sm" className="px-1.5 py-0 font-normal tabular-nums">
				{count}
			</Badge>
		</h3>
	);
}

export default function MediaView() {
	const files = useStore($media);
	const loading = useStore($mediaLoading);
	const folder = useStore($mediaFolder);
	const library = useStore($mediaLibrary);
	const listView = useStore($mediaListView);
	const notice = useStore($mediaNotice);
	const hasMore = useStore($mediaR2More);
	const st = mediaStorage();
	const fileInput = useRef<HTMLInputElement>(null);
	const [dragging, setDragging] = useState(false);
	const [newFolder, setNewFolder] = useState<string | null>(null);
	const [lightbox, setLightbox] = useState<number | null>(null);
	const [details, setDetails] = useState<MediaItem | null>(null);
	const [query, setQuery] = useState("");
	const [kind, setKind] = useState<"all" | MediaKind>("all");

	// Tasarruf özeti birkaç saniye görünür kalır.
	useEffect(() => {
		if (!notice) return;
		const timer = setTimeout(() => $mediaNotice.set(""), 6000);
		return () => clearTimeout(timer);
	}, [notice]);

	// Klasörler + dosyalar (liste bellekte, gezme istemsiz).
	// .gitkeep yalnız boş klasörü ayakta tutar; dosya olarak gösterilmez.
	const folderPrefix = folder ? `${folder}/` : "";
	const folders = new Set<string>();
	const listed: MediaItem[] = [];
	for (const item of files) {
		const rel = mediaRelPath(item.path);
		if (!rel.startsWith(folderPrefix)) continue;
		const rest = rel.slice(folderPrefix.length);
		const slash = rest.indexOf("/");
		if (slash === -1) listed.push(item);
		else folders.add(rest.slice(0, slash));
	}
	// Arama + tür filtresi (GitCMS: "Search by filename" + "All types").
	const needle = query.trim().toLocaleLowerCase("tr");
	const current = listed.filter((item) => {
		if (item.path.endsWith("/.gitkeep")) return false;
		if (needle && !(item.path.split("/").pop() ?? "").toLocaleLowerCase("tr").includes(needle)) return false;
		if (kind !== "all" && mediaKindOf(item.path).kind !== kind) return false;
		return true;
	});
	const images = current.filter((item) => IMAGE_EXT.test(item.path));
	const others = current.filter((item) => !IMAGE_EXT.test(item.path));
	const filtering = needle !== "" || kind !== "all";

	const segments = folder ? folder.split("/") : [];
	const gridCls = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
	const submitFolder = () => {
		const name = (newFolder ?? "").trim();
		setNewFolder(null);
		if (name) void createMediaFolder(name);
	};
	const openListFile = (item: MediaItem) => {
		if (IMAGE_EXT.test(item.path)) setDetails(item);
		else window.open(mediaPreviewUrl(item.path), "_blank");
	};

	return (
		<div className="mx-auto w-full max-w-4xl p-6">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
				<h2 className="flex items-baseline gap-2 text-lg font-semibold">
					Medya
					<span className="font-mono text-xs font-normal text-muted-foreground">
						{st.kind === "repo" ? `${st.root}/ · depo` : st.root ? `${st.root}/ · R2` : "R2"}
					</span>
				</h2>
				<div className="flex items-center gap-2">
					{st.r2Enabled && (
						<div className="flex rounded-lg border border-border p-0.5 text-xs">
							{(["repo", "r2"] as const).map((kind) => (
								<button
									key={kind}
									type="button"
									onClick={() => setMediaLibrary(kind)}
									className={`rounded-md px-2.5 py-1 ${
										library === kind ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
									}`}
								>
									{kind === "repo" ? t("media.libraryRepo") : t("media.libraryR2")}
								</button>
							))}
						</div>
					)}
					<input
						ref={fileInput}
						type="file"
						className="hidden"
						multiple
						onChange={(event) => {
							// FileList canlıdır; value="" onu anında boşaltır — önce yakala.
							const picked = event.target.files ? Array.from(event.target.files) : [];
							event.target.value = "";
							if (picked.length) void uploadMedia(picked);
						}}
					/>
					<Button variant="ghost" size="sm" onClick={() => setNewFolder("")}>
						+ Klasör
					</Button>
					<Button size="sm" disabled={loading} onClick={() => fileInput.current?.click()}>
						{loading ? t("media.uploading") : t("media.upload")}
					</Button>
				</div>
			</div>

			{/* Araç çubuğu — ara / tür / görünüm (GitCMS üst satırı). */}
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<div className="relative min-w-44 flex-1 sm:max-w-64">
					<Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
					<Input
						size="sm"
						placeholder={t("media.searchPlaceholder")}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						// data-[size=sm]:px-2.5 specificity'sini yalnız inline geçebiliriz.
						style={{ paddingLeft: 32 }}
					/>
				</div>
				<select
					aria-label="Tür filtresi"
					value={kind}
					onChange={(event) => setKind(event.target.value as "all" | MediaKind)}
					className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{kindOptions().map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
				<div className="flex rounded-lg border border-border p-0.5">
					<button
						type="button"
						title={t("media.viewGrid")}
						aria-pressed={!listView}
						onClick={() => $mediaListView.set(false)}
						className={`flex size-7 items-center justify-center rounded-md ${
							!listView ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
						}`}
					>
						<Icon name="grid" className="size-3.5" />
					</button>
					<button
						type="button"
						title={t("media.viewList")}
						aria-pressed={listView}
						onClick={() => $mediaListView.set(true)}
						className={`flex size-7 items-center justify-center rounded-md ${
							listView ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
						}`}
					>
						<Icon name="list" className="size-3.5" />
					</button>
				</div>
			</div>

			{/* Klasör yol göstergesi */}
			<div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
				<button
					type="button"
					className={folder ? "hover:text-foreground" : "font-medium text-foreground"}
					onClick={() => setMediaFolder("")}
				>
					{st.kind === "repo" ? `${st.root}/` : t("media.rootLabel")}
				</button>
				{segments.map((segment, index) => (
					<span key={index} className="flex items-center gap-1">
						<span>›</span>
						<button
							type="button"
							className={index === segments.length - 1 ? "font-medium text-foreground" : "hover:text-foreground"}
							onClick={() => setMediaFolder(segments.slice(0, index + 1).join("/"))}
						>
							{segment}/
						</button>
					</span>
				))}
			</div>

			{notice && (
				<Alert className="mb-3 py-2">
					<AlertDescription className="col-start-1 text-xs">{notice}</AlertDescription>
				</Alert>
			)}

			<p className="mb-3 text-xs text-muted-foreground">
				Sürükle-bırak ya da yapıştır; dosya adı temizlenir (My Image (1).png → my-image-1.png),
				PNG/JPEG WebP'ye çevrilir. Git LFS desteklenmez — büyük dosyalar için R2 kullanın.
			</p>

			<div
				className={dragging ? "rounded-xl ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					const dropped = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
					if (dropped.length) void uploadMedia(dropped);
				}}
			>
				{loading && files.length === 0 ? (
					<SkeletonGrid count={8} className={gridCls} />
				) : (
					<>
						{(folders.size > 0 || newFolder !== null) && (
							<section>
								<SectionTitle label={t("media.folders")} count={folders.size} />
								<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
									{[...folders].map((name) => (
										<button
											key={`folder:${name}`}
											type="button"
											onClick={() => setMediaFolder(folder ? `${folder}/${name}` : name)}
											className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-left transition-colors hover:border-primary/40"
										>
											<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
												<Icon name="folder" className="size-5" />
											</span>
											<span className="truncate text-sm font-medium">{name}/</span>
										</button>
									))}
									{newFolder !== null && (
										<div className="flex items-center gap-2 rounded-xl border border-primary/40 px-3 py-2">
											<Input
												autoFocus
												size="sm"
												placeholder={t("media.folderNamePlaceholder")}
												value={newFolder}
												onChange={(event) => setNewFolder(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === "Enter") submitFolder();
													if (event.key === "Escape") {
														event.stopPropagation();
														setNewFolder(null);
													}
												}}
											/>
											<Button size="sm" variant="ghost" onClick={submitFolder}>
												Oluştur
											</Button>
										</div>
									)}
								</div>
							</section>
						)}

						{listView ? (
							current.length > 0 && (
								<div className={folders.size > 0 ? "mt-5" : ""}>
									<MediaList items={current} onOpen={openListFile} />
								</div>
							)
						) : (
							<>
								{images.length > 0 && (
									<section>
										<SectionTitle label={t("media.sectionImages")} count={images.length} />
										<div className={gridCls}>
											{images.map((item) => (
												<MediaCard key={item.path} item={item} onOpen={() => setDetails(item)} />
											))}
										</div>
									</section>
								)}

								{others.length > 0 && (
									<section>
										<SectionTitle label={t("media.sectionOthers")} count={others.length} />
										<div className={gridCls}>
											{others.map((item) => (
												<MediaCard
													key={item.path}
													item={item}
													onOpen={() => window.open(mediaPreviewUrl(item.path), "_blank")}
												/>
											))}
										</div>
									</section>
								)}
							</>
						)}

						{folders.size === 0 && current.length === 0 && newFolder === null && (
							<p className="py-10 text-center text-sm text-muted-foreground">
								{filtering ? t("media.emptySearch") : t("media.emptyFolder")}
							</p>
						)}
					</>
				)}
			</div>

			{hasMore && !loading && (
				<div className="mt-3 text-center">
					<Button variant="ghost" size="sm" onClick={() => void loadMoreMedia()}>Daha fazla</Button>
				</div>
			)}

			{lightbox !== null && images[lightbox] && (
				<MediaLightbox items={images} index={lightbox} onIndex={setLightbox} onClose={() => setLightbox(null)} />
			)}

			{details && (
				<MediaDetailsDialog
					item={details}
					onClose={() => setDetails(null)}
					onZoom={() => {
						const index = images.indexOf(details);
						if (index >= 0) setLightbox(index);
						else window.open(mediaPreviewUrl(details.path), "_blank");
					}}
				/>
			)}
		</div>
	);
}
