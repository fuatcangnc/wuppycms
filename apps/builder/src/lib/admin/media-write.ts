// Medya yazma işlemleri — yükleme hattı, silme/taşıma/değiştirme, kırpılmış
// kopya, "kullanılan yer" taraması ve klasör oluşturma. Depo = tek commit,
// R2 = kovaya doğrudan yazım. Bağımlılık sırası: core ← list ← write ← media.ts.

import * as api from "./api";
import { formatSize } from "./format";
import { blobToBase64, cleanFileName, contentTypeOf, optimizeImage } from "./imaging";
import { mediaLinkFor, type UploadOutcome } from "./media-core";
import { refreshMedia } from "./media-list";
import {
	$collections,
	$mediaAlts,
	$mediaCaptions,
	$mediaFolder,
	$mediaLoading,
	$mediaNotice,
	$mediaUpload,
	currentSite,
	mediaRelPath,
	mediaStorage,
	showError,
	type UploadFileState,
	type UploadSession,
} from "./store";

/**
 * Yükleme hattı: ad temizleme → tarayıcıda optimizasyon → tasarruf onayı →
 * çakışma son eki → kitaplığa yazım (commit ya da R2 PUT).
 */
export async function uploadMedia(
	files: File[] | FileList,
	options?: { entryScope?: string },
): Promise<UploadOutcome[]> {
	const site = currentSite();
	if (!site) return [];
	if ($mediaUpload.get()) {
		showError("Başka bir yükleme sürüyor; bitince tekrar deneyin.");
		return [];
	}
	const list = Array.from(files);
	if (!list.length) return [];
	const st = mediaStorage();
	$mediaLoading.set(true);
	$mediaUpload.set({
		files: list.map((file) => ({ name: cleanFileName(file.name), size: file.size, phase: "prepare", frac: 0 })),
		startedAt: Date.now(),
	});
	const patchFile = (
		index: number,
		patch: Partial<UploadFileState>,
		extra?: Partial<UploadSession>,
	) => {
		const session = $mediaUpload.get();
		if (!session) return;
		const rows = session.files.slice();
		rows[index] = { ...rows[index], ...patch };
		$mediaUpload.set({ ...session, ...extra, files: rows });
	};
	try {
		const prepared: { name: string; blob: Blob }[] = [];
		let originalTotal = 0;
		let finalTotal = 0;
		for (let i = 0; i < list.length; i += 1) {
			const result = await optimizeImage(list[i]);
			let name = cleanFileName(list[i].name);
			if (result.convertedToWebp) name = name.replace(/\.\w+$/, ".webp");
			originalTotal += result.originalSize;
			finalTotal += result.finalSize;
			prepared.push({ name, blob: result.blob });
			patchFile(i, { name, size: result.finalSize, phase: "queue" });
		}
		const savedPct = originalTotal > 0 ? Math.round((1 - finalTotal / originalTotal) * 100) : 0;
		if (savedPct > 0) {
			const ok = window.confirm(
				`${prepared.length} dosya yüklenecek · ${formatSize(originalTotal)} → ${formatSize(finalTotal)} (%${savedPct} tasarruf). Onaylıyor musun?`,
			);
			if (!ok) {
				$mediaUpload.set(null);
				return [];
			}
		}

		const dir = [st.root, options?.entryScope ?? $mediaFolder.get()].filter(Boolean).join("/");
		const targetPrefix = dir ? `${dir}/` : "";
		const existing = new Set<string>(
			st.kind === "repo"
				? (await api.getTree(site.repoFullName)).entries.map((e) => e.path)
				: (await api.r2List(targetPrefix)).objects.map((o) => o.key),
		);

		const outcomes: UploadOutcome[] = [];
		for (let i = 0; i < prepared.length; i += 1) {
			const item = prepared[i];
			let path = `${targetPrefix}${item.name}`;
			let n = 2;
			while (existing.has(path)) {
				path = `${targetPrefix}${item.name.replace(/(\.\w+)?$/, `-${n}$1`)}`;
				n += 1;
			}
			existing.add(path);
			const base64 = await blobToBase64(item.blob);
			patchFile(i, { name: path.split("/").pop() ?? item.name, phase: "send", frac: 0 });
			const onProgress = (frac: number) =>
				patchFile(i, { frac, phase: frac >= 1 ? "server" : "send" }, {
					sendStartedAt: $mediaUpload.get()?.sendStartedAt ?? Date.now(),
				});
			if (st.kind === "repo") {
				await api.requestWithProgress(
					"/api/git/upload",
					{
						full_name: site.repoFullName,
						branch: site.branch,
						path,
						content: base64,
						message: `cms: ${item.name} yüklendi (via WuppyCMS)`,
					},
					onProgress,
				);
			} else {
				await api.requestWithProgress(
					"/api/media/r2",
					{ key: path, content: base64, contentType: contentTypeOf(path) },
					onProgress,
				);
			}
			patchFile(i, { frac: 1, phase: "done" });
			outcomes.push({ path, name: path.split("/").pop() ?? path, link: mediaLinkFor(path) });
		}
		$mediaUpload.set(null);
		if (outcomes.length) {
			$mediaNotice.set(
				savedPct > 0
					? `${outcomes.length} dosya yüklendi · ${formatSize(originalTotal)} → ${formatSize(finalTotal)} (%${savedPct} daha küçük)`
					: `${outcomes.length} dosya yüklendi`,
			);
			await refreshMedia();
		}
		return outcomes;
	} catch (error) {
		// Hangi dosyada takıldığını banner birkaç saniye daha göstererek söyler.
		const session = $mediaUpload.get();
		const active = session?.files.findIndex((f) => f.phase !== "done") ?? -1;
		if (active >= 0) patchFile(active, { phase: "error" });
		showError(error instanceof Error ? error.message : "Yükleme başarısız.");
		window.setTimeout(() => $mediaUpload.set(null), 4000);
		return [];
	} finally {
		$mediaLoading.set(false);
	}
}

export async function deleteMedia(path: string): Promise<boolean> {
	const site = currentSite();
	if (!site) return false;
	const st = mediaStorage();
	const label = st.kind === "repo" ? path : mediaRelPath(path);
	if (!window.confirm(st.kind === "repo" ? `“${label}” repodan silinsin mi?` : `“${label}” R2 kovasından silinsin mi?`)) return false;
	try {
		if (st.kind === "repo") {
			await api.commitFiles(site.repoFullName, site.branch, `cms: ${path} silindi (via WuppyCMS)`, [
				{ path, delete: true },
			]);
		} else {
			await api.r2Delete(path);
		}
		await refreshMedia();
		return true;
	} catch (error) {
		showError(error instanceof Error ? error.message : "Silinemedi.");
		return false;
	}
}

/**
 * Yeniden adlandır / taşı — depo: blobu okuyup tek commit'te ekle+sil,
 * R2: kova içi kopyala+sil. Alt/caption meta'sı yeni yola taşınır.
 */
export async function moveMediaTo(from: string, to: string): Promise<boolean> {
	const site = currentSite();
	if (!site || from === to) return from === to;
	const st = mediaStorage();
	try {
		if (st.kind === "repo") await api.moveMedia(site.repoFullName, site.branch, from, to);
		else await api.moveR2(from, to);
		const alt = $mediaAlts.get()[from] ?? "";
		const caption = $mediaCaptions.get()[from] ?? "";
		if (alt || caption) {
			await api.putMediaAlt(site.repoFullName, from, { alt: "", caption: "" }).catch(() => undefined);
			await api.putMediaAlt(site.repoFullName, to, { alt, caption }).catch(() => undefined);
			$mediaAlts.set({ ...$mediaAlts.get(), [from]: "", [to]: alt });
			$mediaCaptions.set({ ...$mediaCaptions.get(), [from]: "", [to]: caption });
		}
		await refreshMedia();
		return true;
	} catch (error) {
		showError(error instanceof Error ? error.message : "Taşınamadı.");
		return false;
	}
}

/** Aynı yola yeni baytlar commit et ("Görseli değiştir" / "Orijinali değiştir"). */
export async function replaceMedia(path: string, blob: Blob): Promise<boolean> {
	const site = currentSite();
	if (!site) return false;
	const st = mediaStorage();
	try {
		const base64 = await blobToBase64(blob);
		const name = path.split("/").pop() ?? path;
		if (st.kind === "repo") {
			await api.uploadFile(site.repoFullName, site.branch, path, base64, `cms: ${name} güncellendi (via WuppyCMS)`);
		} else {
			await api.r2Upload(path, base64, contentTypeOf(path));
		}
		$mediaNotice.set(`${name} değiştirildi`);
		await refreshMedia();
		return true;
	} catch (error) {
		showError(error instanceof Error ? error.message : "Değiştirilemedi.");
		return false;
	}
}

/** Kırpma çıktısını "<ad>-crop.<uzantı>" olarak aynı klasöre kopyalar. */
export async function uploadCroppedCopy(sourcePath: string, blob: Blob): Promise<UploadOutcome[]> {
	const name = sourcePath.split("/").pop() ?? "gorsel";
	const ext = blob.type === "image/webp" ? "webp" : (name.split(".").pop() ?? "webp");
	const file = new File([blob], `${name.replace(/\.\w+$/, "")}-crop.${ext}`, {
		type: blob.type || "image/webp",
	});
	const rel = mediaRelPath(sourcePath);
	const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : undefined;
	return uploadMedia([file], { entryScope: dir });
}

/** "Kullanılan yer" taraması — hangi içerik dosyaları bu yola işaret ediyor. */
export type MediaUsageScan = {
	uses: (api.MediaUse & { collectionKey?: string })[];
	scanned: number;
	truncated: boolean;
};

export async function scanUsage(path: string): Promise<MediaUsageScan | null> {
	const site = currentSite();
	if (!site) return null;
	try {
		const result = await api.usageScan(site.repoFullName, path, site.branch);
		const uses = result.uses.map((use) => ({
			...use,
			collectionKey: $collections.get().find((col) => use.path.startsWith(`${col.base}/`))?.key,
		}));
		return { ...result, uses };
	} catch (error) {
		showError(error instanceof Error ? error.message : "Kullanımlar taranamadı.");
		return null;
	}
}

/** Klasör adı: dosya adı kuralları ama uzantı yok (GitCMS klasör sezgisi). */
export function cleanFolderName(name: string): string {
	const dot = name.lastIndexOf(".");
	return cleanFileName(dot > 0 ? name.slice(0, dot) : name).replace(/\.+$/, "");
}

/**
 * Boş klasör git'te var olamaz — `.gitkeep` ile oluşturulur ve listelenmez.
 * R2'de aynı işaret nesnesi kullanılır (davranış parity'si).
 */
export async function createMediaFolder(name: string): Promise<void> {
	const site = currentSite();
	if (!site) return;
	const clean = cleanFolderName(name);
	if (!clean) return;
	const st = mediaStorage();
	const dir = [st.root, $mediaFolder.get(), clean].filter(Boolean).join("/");
	$mediaUpload.set({ files: [], message: `${clean}/ klasörü oluşturuluyor…`, startedAt: Date.now() });
	try {
		if (st.kind === "repo") {
			const { entries } = await api.getTree(site.repoFullName);
			if (entries.some((e) => e.type === "blob" && e.path.startsWith(`${dir}/`))) {
				showError(`${clean}/ klasörü zaten var.`);
				return;
			}
			await api.commitFiles(
				site.repoFullName,
				site.branch,
				`cms: ${dir}/ klasörü eklendi (via WuppyCMS)`,
				[{ path: `${dir}/.gitkeep`, content: "" }],
			);
		} else {
			const listed = await api.r2List(`${dir}/`);
			if (listed.objects.length) {
				showError(`${clean}/ klasörü zaten var.`);
				return;
			}
			await api.r2Upload(`${dir}/.gitkeep`, "", "text/plain");
		}
		await refreshMedia();
	} catch (error) {
		showError(error instanceof Error ? error.message : "Klasör oluşturulamadı.");
		window.setTimeout(() => $mediaUpload.set(null), 3000);
		return;
	}
	$mediaUpload.set(null);
}
