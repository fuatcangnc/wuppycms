// Bağımlılıksız biçimlendirme yardımcıları (React bileşenleri de kullanır).

export function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const min = Math.floor(diff / 60_000);
	if (min < 1) return "az önce";
	if (min < 60) return `${min} dk önce`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h} sa önce`;
	const d = Math.floor(h / 24);
	if (d < 30) return `${d} gün önce`;
	return new Date(iso).toLocaleDateString("tr-TR");
}

export function formatSize(bytes?: number): string {
	if (!bytes) return "";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** https:// öneki ve yol sonu olmadan alan adı. */
export function hostOf(url: string): string {
	return url
		.trim()
		.replace(/^https?:\/\//, "")
		.replace(/\/.*$/, "");
}

export const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg|avif|ico)$/i;
