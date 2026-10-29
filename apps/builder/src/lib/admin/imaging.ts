// Medya yardımcıları — GitCMS dosya adı kuralları, tarayıcıda görsel
// optimizasyonu ve bağ biçimi üretimi. Saf istemci kodu; sunucuya gitmez.

import type { MediaLinkFormat } from "@wuppycms/shared";

/** `My Image (1).png` → `my-image-1.png` (GitCMS kuralı). */
export function cleanFileName(name: string): string {
	const dot = name.lastIndexOf(".");
	const base = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot).toLowerCase() : "";
	const cleaned = base
		.toLowerCase()
		.replace(/ı/g, "i") // noktasız ı NFD ile inmez; Türkçe adlarda kaybolmasın
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // aksanları indir: ş→s, ü→u
		.replace(/[^a-z0-9]+/g, "-") // boşluk + özel karakter → tire
		.replace(/^-+|-+$/g, "");
	return `${cleaned || "dosya"}${ext}`;
}

export type OptimizationResult = {
	blob: Blob;
	originalSize: number;
	finalSize: number;
	/** Gerçekten WebP'ye çevrildi (ad değiştirilecek). */
	convertedToWebp: boolean;
};

const KEEP_AS_IS = /\.(svg|gif|avif|webp)$/i;
/** Bu genişliği aşan görseller ölçeklenir (GitCMS "web-friendly width"). */
const MAX_WIDTH = 2560;

/** PNG/JPEG/BMP/TIFF → WebP + ölçekleme; küçültmüyorsa orijinal kalır. */
export async function optimizeImage(file: File): Promise<OptimizationResult> {
	const originalSize = file.size;
	const keep = async (): Promise<OptimizationResult> => ({
		blob: file,
		originalSize,
		finalSize: originalSize,
		convertedToWebp: false,
	});
	if (KEEP_AS_IS.test(file.name)) return keep();

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return keep(); // çözemediğimiz format → olduğu gibi
	}
	try {
		const scale = Math.min(1, MAX_WIDTH / bitmap.width);
		const canvas = document.createElement("canvas");
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		const ctx = canvas.getContext("2d");
		if (!ctx) return keep();
		ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

		const webp = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob((blob) => resolve(blob), "image/webp", 0.82),
		);
		if (!webp || webp.size >= originalSize) return keep();
		return { blob: webp, originalSize, finalSize: webp.size, convertedToWebp: true };
	} catch {
		return keep();
	} finally {
		bitmap.close();
	}
}

export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
		reader.onerror = () => reject(new Error("Dosya okunamadı"));
		reader.readAsDataURL(blob);
	});
}

export const EXT_CONTENT_TYPE: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	avif: "image/avif",
	gif: "image/gif",
	svg: "image/svg+xml",
	ico: "image/x-icon",
	mp4: "video/mp4",
	webm: "video/webm",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	pdf: "application/pdf",
	txt: "text/plain",
	json: "application/json",
	css: "text/css",
	js: "text/javascript",
	zip: "application/zip",
};

export function contentTypeOf(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return EXT_CONTENT_TYPE[ext] ?? "application/octet-stream";
}

/**
 * Bağ biçimi (GitCMS "how links should look"):
 * - relative → `/blog/kapak.webp` (site kökünden; Astro `public` eşlemesi)
 * - full     → site URL'i + göreli yol
 * - folder   → medya köküne göreli (`blog/kapak.webp`)
 * mediaRoot örn. "public"; key depo yolu ("public/blog/kapak.webp").
 */
export function mediaLink(
	format: MediaLinkFormat | undefined,
	key: string,
	mediaRoot: string,
	siteUrl?: string,
): string {
	const root = `${mediaRoot.replace(/\/+$/, "")}/`;
	const rel = key.startsWith(root) ? key.slice(root.length) : key;
	switch (format) {
		case "full": {
			const base = (siteUrl ?? "").replace(/\/+$/, "");
			return base ? `${base}/${rel}` : `/${rel}`;
		}
		case "folder":
			return rel;
		case "media-uri":
			// Site şablonu derleme anında çözer (ör. Astro remark eklentisi):
			// repo-göreli, taşımaya dayanıklı bağ. "Bağı çöz" ile relative'e döner.
			return `media://${key}`;
		default:
			return `/${rel}`;
	}
}
