// Zamanlanmış yayın — ADR 0006: durumun tek kaynağı repo; bu modül yalnız
// YÜRÜTÜCÜNÜN saf parçası. `publishAt` (ISO, ör. "2026-11-01T09:00") geçmiş ve
// `status` henüz "ready" değilse doküman yayına hazırdır. Zamanlayıcı (Cron ya
// da elle POST /api/schedule/run) yalnız bu kuralı uygular ve commit atar.

export type ScheduledDoc = {
	path: string;
	/** Ham frontmatter sözlüğü (parseFrontmatterScalars çıktısı). */
	fm: Record<string, string>;
	/** Yürütücünün uygulayacağı yeni durum. */
	nextStatus: "ready";
};

/** `publishAt` değerini tarihe çevirir; bozuk/boşsa null.
 *  Değer yerel saat kabul edilir (datetime-local girdisi); Workers'ta
 *  çalışma zamanı UTC olduğundan üretimde "duvar saati = UTC" olur. */
export function parsePublishAt(raw: string | undefined): Date | null {
	const value = (raw ?? "").trim().replace(/^["']|["']$/g, "");
	if (!value) return null;
	// "2026-11-01T09:00", "2026-11-01 09:00", "2026-11-01" — hepsi geçerli.
	const normalized = value.replace(" ", "T");
	const date = new Date(/T\d{2}:\d{2}$/.test(normalized) ? normalized : `${normalized}T00:00`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Doküman yayına alınmalı mı: zamanı geçmiş ve durum hazır değil. */
export function isDue(fm: Record<string, string>, now: Date): boolean {
	const at = parsePublishAt(fm.publishAt);
	if (!at || at.getTime() > now.getTime()) return false;
	const status = (fm.status ?? "").trim().toLowerCase();
	return status !== "ready";
}

/** Dosya listesinden yürütülecekleri seçer (saf; giriş sırası korunur). */
export function pickDueDocs(
	files: { path: string; fm: Record<string, string> }[],
	now: Date,
): ScheduledDoc[] {
	return files
		.filter((file) => isDue(file.fm, now))
		.map((file) => ({ path: file.path, fm: file.fm, nextStatus: "ready" as const }));
}

/** Yürütücü mesajı — commit geçmişinde ayırt edilebilsin. */
export function publishMessage(slug: string): string {
	return `cms: ${slug} zamanı geldi — yayına hazır (via WuppyCMS)`;
}
