// Admin arayüzünün istemci durumu (Nanostores). React bileşenleri useStore ile
// okur; değişiklikleri yalnız actions.ts yapar — bileşenler sunum + yerel UI
// durumudur.

import { persistentBoolean } from "@nanostores/persistent";
import { atom } from "nanostores";
import type { CollectionDef } from "@wuppycms/content-schema";
import type { CommitInfo, MediaLinkFormat } from "@wuppycms/shared";
import type { EntryRow, PageFile, ScanResult, SiteEntry } from "./api";
import { clearDraftBackup } from "./draft-backup";

export type Site = {
	id: string;
	name: string;
	repoFullName: string;
	branch: string;
};

/** Açık dokümanın parse edilmiş hâli; sıra + ham değerler korunur. */
export type OpenDoc = {
	path: string;
	collectionKey: string;
	order: string[];
	values: Map<string, string>;
	body: string;
	baseSha: string;
};

export type Status = "idle" | "loading" | "saving" | "saved" | "error";
export type View = "empty" | "hint" | "overview" | "entries" | "doc" | "contentmd" | "media" | "trash" | "review" | "settings" | "page";

/** Açık diyaloglar — üst üste binebilir (sihirbazın üstünde ajan modalı gibi). */
export type Dialogs = { new: boolean; site: boolean; ai: boolean; picker: boolean; collection: boolean };

export type WizardStep = "list" | "scan" | "step1" | "step2" | "ready";

/** Sihirbaz durumu component unmount'larından bağımsız yaşar. */
export type WizardState = {
	step: WizardStep;
	repo: string;
	scan: ScanResult | null;
	url: string;
	media: string;
	checked: string[];
	publishing: "review" | "immediate";
};

export const $sites = atom<Site[]>([]);
export const $site = atom<string>("");
export const $user = atom<{ name: string; email: string } | null>(null);
export const $scan = atom<ScanResult | null>(null);
export const $commits = atom<CommitInfo[]>([]);
export const $commitsLoading = atom(false);
export const $collections = atom<CollectionDef[]>([]);
export const $configFound = atom<boolean>(true);
export const $collection = atom<string>("");
export const $entries = atom<EntryRow[]>([]);
export const $doc = atom<OpenDoc | null>(null);
/** `src/pages` altındaki dosyalar (site taramasında yüklenir). */
export const $pages = atom<PageFile[]>([]);
/** Açık Astro sayfası — `src/pages`e göreli yol (ör. blog/index.astro). */
export const $pagePath = atom<string>("");
/** Sayfa kaynak editöründe kaydedilmemiş değişiklik var mı. */
export const $pageDirty = atom(false);
/** Görünür (display) form değerleri; kaydetmede raw'a çevrilir. */
export const $formValues = atom<Record<string, string>>({});
export const $body = atom("");
export const $contentmd = atom({ text: "", existed: false, loading: false });
export const $media = atom<{ path: string; size?: number; uploaded?: string }[]>([]);
export const $mediaLoading = atom(false);
/** Aktif kitaplık: depo (git commit) ya da platform R2'si. */
export const $mediaLibrary = atom<"repo" | "r2">("repo");
/** Kitaplık kökü içinde gezilen alt klasör ("" = kök); yükleme buraya gider. */
export const $mediaFolder = atom("");
/** R2 listesinde sonraki sayfa var mı ("daha fazla" düğmesi). */
export const $mediaR2More = atom(false);
/** Son yüklemenin tasarruf özeti; ekranda kısa süre görünür. */
export const $mediaNotice = atom("");
/**
 * Süren yükleme/klasör oturumu — dosya dosya faz + bayt ilerlemesi.
 * null = boşta. Banner'ı MediaUploadProgress çizdirir.
 */
export type UploadPhase = "queue" | "prepare" | "send" | "server" | "done" | "error";
export type UploadFileState = {
	name: string;
	size: number;
	phase: UploadPhase;
	/** Gönderilen/total oranı (0..1). */
	frac: number;
};
export type UploadSession = {
	files: UploadFileState[];
	/** Dosyasız oturum mesajı (ör. "x/ klasörü oluşturuluyor…"). */
	message?: string;
	startedAt: number;
	sendStartedAt?: number;
};
export const $mediaUpload = atom<UploadSession | null>(null);
/** Depo yolu → alt metni (`.wuppycms/media.json` manifesti, P4). */
export const $mediaAlts = atom<Record<string, string>>({});
/** Depo yolu → başlık (caption; aynı manifest). */
export const $mediaCaptions = atom<Record<string, string>>({});
/** Depo yolu → odak noktası (yüzde; manifest). */
export const $mediaFocals = atom<Record<string, { x: number; y: number }>>({});
/** Depo yolu → gösterim genişliği % (manifest; seçici HTML img ile ekler). */
export const $mediaWidths = atom<Record<string, number>>({});
/** Medya ekranı görünümü: true = liste, false = ızgara (kalıcı tercih). */
export const $mediaListView = persistentBoolean("wuppycms:media:list");
/** Medya seçicinin seçimini teslim edeceği geri çağırma (editör alanları). */
export type MediaPickHandler = (link: string, path: string) => void;
export const $mediaPickTarget = atom<MediaPickHandler | null>(null);
export const $dirty = atom(false);
export const $status = atom<Status>("idle");
export const $error = atom("");
export const $view = atom<View>("hint");

/** Kayıt listesi görünümü (P3): liste/pano/takvim — adreste taşınır (ADR 0005). */
export const $entriesView = atom<"list" | "board" | "calendar">("list");
/** Açılış yüklemesi bitti; RouteApplier bundan sonra adresi uygular. */
export const $booted = atom(false);
export const $dialogs = atom<Dialogs>({ new: false, site: false, ai: false, picker: false, collection: false });
export const $wizard = atom<WizardState | null>(null);
export const $sidebarCollapsed = persistentBoolean("wuppycms:sidebar");

export function currentSite(): Site | undefined {
	return $sites.get().find((s) => s.repoFullName === $site.get());
}

// --- diyalog yardımcıları -----------------------------------------------------------

export function openDialog(name: keyof Dialogs): void {
	$dialogs.set({ ...$dialogs.get(), [name]: true });
}

export function closeDialog(name: keyof Dialogs): void {
	$dialogs.set({ ...$dialogs.get(), [name]: false });
}

export function closeAllDialogs(): void {
	$dialogs.set({ new: false, site: false, ai: false, picker: false, collection: false });
	$mediaPickTarget.set(null);
}

export function currentCollection(): CollectionDef | undefined {
	return $collections.get().find((c) => c.key === $collection.get());
}

/** sites.jsonc'teki aktif site kaydı (tek sitelik repolarda key "root"). */
export function currentSiteEntry(): SiteEntry | undefined {
	const sites = $scan.get()?.setup?.sites;
	return sites?.find((s) => s.key === "root") ?? sites?.[0];
}

/** Yüklemelerin gittiği repo klasörü (sites.jsonc → scan → "public"). */
export function currentMediaFolder(): string {
	const scan = $scan.get();
	return (currentSiteEntry()?.media ?? scan?.media ?? "public").replace(/\/+$/, "");
}

// --- medya kitaplığı bağlamı --------------------------------------------------------

export type MediaStorage = {
	kind: "repo" | "r2";
	/** Depo: kök klasör ("public"); R2: kova öneki ("" olabilir). */
	root: string;
	linkFormat: MediaLinkFormat;
	siteUrl?: string;
	publicBaseUrl?: string;
	/** sites.jsonc'te mediaR2 ayarlıysa R2 sekmesi görünür. */
	r2Enabled: boolean;
};

/** Aktif kitaplık + bağ biçimi; sites.jsonc kaydı yoksa depo/relative. */
export function mediaStorage(): MediaStorage {
	const entry = currentSiteEntry();
	const r2Enabled = Boolean(entry?.mediaR2);
	const kind = r2Enabled && $mediaLibrary.get() === "r2" ? "r2" : "repo";
	return {
		kind,
		root:
			kind === "repo"
				? currentMediaFolder()
				: (entry?.mediaR2?.prefix ?? "").replace(/^\/+|\/+$/g, ""),
		linkFormat: entry?.mediaLink ?? "relative",
		siteUrl: entry?.url,
		publicBaseUrl: entry?.mediaR2?.publicBaseUrl?.replace(/\/+$/, ""),
		r2Enabled,
	};
}

/** Yolun kitaplık köküne göreli hâli ("public/blog/x.webp" → "blog/x.webp"). */
export function mediaRelPath(path: string): string {
	const { root } = mediaStorage();
	const prefix = root ? `${root}/` : "";
	return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

// --- durum yardımcıları (actions.ts'ten taşındı; medya katmanıyla döngü olmasın) --

export function clearError(): void {
	$error.set("");
}

export function showError(message: string): void {
	$status.set("error");
	$error.set(message);
}

export function confirmDiscard(): boolean {
	if (!$dirty.get() && !$pageDirty.get()) return true;
	const confirmed = window.confirm("Kaydedilmemiş değişiklikler var. Yine de vazgeçilsin mi?");
	if (confirmed) {
		// Vazgeçildi: taslak yedeği de anlamsız — bir sonraki açılışta sormasın.
		const site = currentSite();
		const doc = $doc.get();
		if (site && doc) void clearDraftBackup(site.repoFullName, doc.path);
		$pageDirty.set(false);
	}
	return confirmed;
}
