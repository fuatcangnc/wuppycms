// Medya listesi ve gezinme — depo/R2 kitaplık tazeleme, klasör/dal seçimi ve
// editör medya seçicisi. Bağımlılık sırası: core ← list ← write ← media.ts.

import * as api from "./api";
import type { MediaMeta } from "./boot";
import { takePrefetch } from "./boot";
import { mediaLinkFor } from "./media-core";
import { goTo } from "./navigate";
import {
	$media,
	$mediaAlts,
	$mediaCaptions,
	$mediaFocals,
	$mediaFolder,
	$mediaLibrary,
	$mediaLoading,
	$mediaPickTarget,
	$mediaR2More,
	$mediaWidths,
	$view,
	clearError,
	closeDialog,
	confirmDiscard,
	currentSite,
	mediaStorage,
	openDialog,
	showError,
	type MediaPickHandler,
} from "./store";

/** R2 sayfalama imi — store'da tutulmaz, katman içi detay. */
let r2Cursor: string | null = null;

export async function refreshMedia(loadMore = false): Promise<void> {
	const site = currentSite();
	if (!site) return;
	const st = mediaStorage();
	$mediaLoading.set(true);
	// SSR açılış tohumu: depo kitaplığının ilk listesini ağa çıkmadan kuşan.
	if (st.kind === "repo" && !loadMore) {
		const seeded = takePrefetch<{
			items: { path: string; size?: number }[];
			meta: MediaMeta | null;
		}>(`media:${site.repoFullName}`);
		if (seeded) {
			if (seeded.meta) {
				$mediaAlts.set(seeded.meta.alts);
				$mediaCaptions.set(seeded.meta.captions);
				$mediaFocals.set(seeded.meta.focals);
				$mediaWidths.set(seeded.meta.widths);
			}
			$media.set(seeded.items);
			$mediaR2More.set(false);
			$mediaLoading.set(false);
			return;
		}
	}
	try {
		// Meta (alt/caption/odak/genişlik) ile listeyi PARALEL çek; atomları
		// liste çizilmeden ÖNCE yaz — yoksa seçici kartı, meta gelmeden
		// tıklanabiliyor ve genişlik-farkında ekleme yarışa düşüyor.
		const metaPromise = api
			.getMediaAlts(site.repoFullName)
			.catch(() => null);
		const listPromise =
			st.kind === "repo"
				? api.getTree(site.repoFullName).then(({ entries }) => {
						const prefix = st.root ? `${st.root}/` : "";
						return entries
							.filter((e) => e.type === "blob" && e.path.startsWith(prefix))
							.slice(0, 500)
							.map((e) => ({ path: e.path, size: e.size }));
					})
				: api.r2List(st.root ? `${st.root}/` : "", loadMore ? (r2Cursor ?? undefined) : undefined);

		const [meta, list] = await Promise.all([metaPromise, listPromise]);

		if (meta) {
			$mediaAlts.set(meta.alts);
			$mediaCaptions.set(meta.captions ?? {});
			$mediaFocals.set(meta.focals ?? {});
			$mediaWidths.set(meta.widths ?? {});
		}
		if (st.kind === "repo") {
			$media.set(list as { path: string; size?: number }[]);
			$mediaR2More.set(false);
		} else {
			const page = list as { objects: { key: string; size: number; uploaded: string }[]; cursor: string | null; truncated: boolean };
			r2Cursor = page.cursor;
			const items = page.objects.map((o) => ({ path: o.key, size: o.size, uploaded: o.uploaded }));
			$media.set(loadMore ? [...$media.get(), ...items] : items);
			$mediaR2More.set(loadMore ? Boolean(page.cursor) : Boolean(page.truncated));
		}
	} catch (error) {
		showError(error instanceof Error ? error.message : "Medya listelenemedi.");
	} finally {
		$mediaLoading.set(false);
	}
}

export function loadMoreMedia(): Promise<void> {
	return refreshMedia(true);
}

export async function openMedia(): Promise<void> {
	if (!currentSite() || !confirmDiscard()) return;
	clearError();
	$mediaFolder.set("");
	$view.set("media");
	goTo({ view: "media", folder: "", docPath: undefined, collection: undefined });
	await refreshMedia();
}

export function setMediaLibrary(kind: "repo" | "r2"): void {
	if ($mediaLibrary.get() === kind) return;
	$mediaLibrary.set(kind);
	$mediaFolder.set("");
	goTo({ view: "media", folder: "", docPath: undefined, library: kind });
	void refreshMedia();
}

/** Klasör gezme liste bellekte olduğundan yalnız atom günceller. */
export function setMediaFolder(folder: string): void {
	$mediaFolder.set(folder);
	goTo({ view: "media", folder, docPath: undefined });
}

// --- editör medya seçicisi ------------------------------------------------------------------

/** Seçiciyi açar; seçilen dosyanın bağı `apply`'a teslim edilir. */
export function pickMedia(apply: MediaPickHandler): void {
	$mediaPickTarget.set(apply);
	openDialog("picker");
	if (!$media.get().length && !$mediaLoading.get()) void refreshMedia();
}

export function resolveMediaPick(path: string): void {
	const handler = $mediaPickTarget.get();
	$mediaPickTarget.set(null);
	closeDialog("picker");
	handler?.(mediaLinkFor(path), path);
}

/** Seçiciyi seçim yapmadan kapatır. */
export function closeMediaPicker(): void {
	$mediaPickTarget.set(null);
	closeDialog("picker");
}
