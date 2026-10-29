// Medya çekirdeği — ortak tipler, tür sınıflandırma, manifest meta'sı
// (alt/caption/odak/genişlik) ve bağ/önizleme üretimi.
// Bağımlılık sırası: core ← list ← write ← media.ts.

import * as api from "./api";
import { contentTypeOf, mediaLink } from "./imaging";
import {
	$collection,
	$doc,
	$mediaAlts,
	$mediaCaptions,
	$mediaFocals,
	$mediaWidths,
	currentSite,
	mediaRelPath,
	mediaStorage,
	showError,
} from "./store";

export type MediaItem = { path: string; size?: number; uploaded?: string };
export type UploadOutcome = { path: string; name: string; link: string };

/** Dosyanın tür sınıfı (filtre çubuğu) + mime etiketi (liste görünümü). */
export type MediaKind = "image" | "video" | "audio" | "doc" | "other";

export function mediaKindOf(path: string): { kind: MediaKind; mime: string } {
	const mime = contentTypeOf(path);
	const head = mime.split("/")[0] ?? "";
	let kind: MediaKind = "other";
	if (mime.startsWith("image/")) kind = "image";
	else if (head === "video") kind = "video";
	else if (head === "audio") kind = "audio";
	else if (mime === "application/pdf" || head === "text") kind = "doc";
	return { kind, mime };
}

/** Kayıtlı alt metni döner (liste kolonu ve içeriğe yazarken). */
export function mediaAltFor(path: string): string {
	return $mediaAlts.get()[path] ?? "";
}

/** Kayıtlı başlığı (caption) döner. */
export function mediaCaptionFor(path: string): string {
	return $mediaCaptions.get()[path] ?? "";
}

/** Meta veriyi (alt/caption/odak/genişlik) manifeste yazar; boşalan alan silinir. */
export async function saveMediaMeta(
	path: string,
	fields: {
		alt?: string;
		caption?: string;
		focal?: { x: number; y: number } | null;
		width?: number | null;
	},
): Promise<void> {
	const site = currentSite();
	if (!site) return;
	if (fields.alt !== undefined) $mediaAlts.set({ ...$mediaAlts.get(), [path]: fields.alt.trim() });
	if (fields.caption !== undefined) {
		$mediaCaptions.set({ ...$mediaCaptions.get(), [path]: fields.caption.trim() });
	}
	if (fields.focal !== undefined) {
		const next = { ...$mediaFocals.get() };
		if (fields.focal) next[path] = fields.focal;
		else delete next[path];
		$mediaFocals.set(next);
	}
	if (fields.width !== undefined) {
		const next = { ...$mediaWidths.get() };
		if (typeof fields.width === "number") next[path] = fields.width;
		else delete next[path];
		$mediaWidths.set(next);
	}
	try {
		await api.putMediaAlt(site.repoFullName, path, fields);
	} catch (error) {
		showError(error instanceof Error ? error.message : "Medya bilgisi kaydedilemedi.");
	}
}

/** Alt metni D1'e yazar; boş değer kaydı siler. İyimser güncelleme. */
export function setMediaAlt(path: string, alt: string): Promise<void> {
	return saveMediaMeta(path, { alt });
}

export function r2RawUrl(key: string): string {
	return `/api/media/r2/raw?key=${encodeURIComponent(key)}`;
}

/** İçeriğe/kopyalamaya giden bağ — "nasıl görünsün" ayarına göre (GitCMS). */
export function mediaLinkFor(path: string): string {
	const st = mediaStorage();
	if (st.kind === "r2") {
		const rel = mediaRelPath(path);
		return st.publicBaseUrl ? `${st.publicBaseUrl}/${rel}` : r2RawUrl(path);
	}
	return mediaLink(st.linkFormat, path, st.root, st.siteUrl);
}

/** Görsel önizleme adresi — depo: raw.githubusercontent, R2: public URL/akış. */
export function mediaPreviewUrl(path: string): string {
	const site = currentSite();
	const st = mediaStorage();
	if (st.kind === "r2") {
		const rel = mediaRelPath(path);
		return st.publicBaseUrl ? `${st.publicBaseUrl}/${rel}` : r2RawUrl(path);
	}
	return `https://raw.githubusercontent.com/${site?.repoFullName}/${site?.branch}/${path}`;
}

/**
 * Editördeki <img> için yükleme adresi — mdxeditor'ın imagePreviewHandler'ı
 * bunu çağırır; yalnızca görüntüleme katmanıdır, düğümün src'si (dışa
 * aktarılan markdown) değişmez (ADR repo-only). Çözülen biçimler:
 * - media://depo/yolu → doğrudan önizleme
 * - /göreli (site kökü) ve site URL'li tam bağ → medya kökünden depo yolu
 * - R2 public URL → kök göreli yolu
 * Bilinmeyen/dış bağlar olduğu gibi döner (eski davranış korunur).
 */
export function mediaSrcForEditor(src: string): string {
	if (!src) return src;
	if (src.startsWith("media://")) return mediaPreviewUrl(src.slice("media://".length));
	const st = mediaStorage();
	const trim = (u: string) => u.replace(/\/+$/, "");
	const siteUrl = trim((st.kind === "r2" ? st.publicBaseUrl : st.siteUrl) ?? "");
	let rel: string | undefined;
	if (src.startsWith("/")) rel = src.slice(1);
	else if (siteUrl && src.startsWith(`${siteUrl}/`)) rel = src.slice(siteUrl.length + 1);
	if (!rel) return src;
	const root = st.root.replace(/\/+$/, "");
	return mediaPreviewUrl(root ? `${root}/${rel}` : rel);
}

/** Düzenlenen dokümana ilişkili alt klasör (GitCMS posts/hello-world karşılığı). */
export function entryMediaScope(): string | undefined {
	const doc = $doc.get();
	const collection = $collection.get();
	if (!doc || !collection) return undefined;
	const slug = (doc.path.split("/").pop() ?? "").replace(/\.(mdx?|md|json|ya?ml)$/i, "");
	return slug ? `${collection}/${slug}` : undefined;
}
