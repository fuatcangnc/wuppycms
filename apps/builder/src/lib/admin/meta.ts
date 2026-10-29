// P1 meta yardımcıları — durum iş akışı, hazırlık skoru ve ön izlemeler için
// saf hesaplar. UI (MetaPanel/DocView) bunları tüketir; testleri yanında.

import type { ControlSpec } from "./form";
import { isMediaField } from "./fields";

// Durum seçenekleri — etiketler i18n anahtarıdır (render'da t() ile çözülür);
// meta.ts saf kalır, çeviri çekirdeğine dokunmaz.
export const STATUS_OPTIONS = [
	{ value: "draft", labelKey: "status.draft" },
	{ value: "review", labelKey: "status.review" },
	{ value: "ready", labelKey: "status.ready" },
] as const;

export type StatusValue = (typeof STATUS_OPTIONS)[number]["value"];

/** Bilinmeyen/boş değer taslak sayılır; dosyaya ancak kullanıcı yazınca girer. */
export function normalizeStatus(raw: string | undefined): StatusValue {
	const value = (raw ?? "").trim().toLowerCase();
	return value === "review" || value === "ready" ? value : "draft";
}

/** Durum etiketinin i18n anahtarı — çağıran taraf t() ile çevirir. */
export function statusLabel(value: StatusValue): string {
	return STATUS_OPTIONS.find((option) => option.value === value)?.labelKey ?? "status.draft";
}

export type ReadinessItem = { key: string; label: string; done: boolean; weight: number };

/** Hazırlık: alanlar + gövde uzunluğu üzerinden ağırlıklı skor (0–100).
 *  `label` alanı i18n anahtarıdır; UI t() ile çevirir. */
export function readiness(
	values: Record<string, string>,
	body: string,
): { score: number; items: ReadinessItem[] } {
	const text = (name: string) => (values[name] ?? "").trim();
	const items: ReadinessItem[] = [
		{ key: "title", label: "meta.readyTitle", weight: 25, done: text("title").length > 0 },
		{
			key: "description",
			label: "meta.readyDescription",
			weight: 20,
			done: (text("description") || text("excerpt") || text("ozet")).length > 0,
		},
		{
			key: "date",
			label: "meta.readyDate",
			weight: 15,
			done: (text("date") || text("publishDate")).length > 0,
		},
		{
			key: "status",
			label: "meta.readyStatus",
			weight: 20,
			done: normalizeStatus(values["status"]) === "ready",
		},
		{
			key: "body",
			label: "meta.readyBody",
			weight: 20,
			done: body.trim().length >= 120,
		},
	];
	const score = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
	return { score, items };
}

/** Arama sonucu önizlemesi (Google benzeri) için başlık/URL/açıklama. */
export function searchPreview({
	siteUrl,
	docPath,
	values,
}: {
	siteUrl?: string;
	docPath: string;
	values: Record<string, string>;
}): { title: string; url: string; description: string } {
	const slug = docPath.split("/").pop()?.replace(/\.\w+$/, "") ?? docPath;
	const base = (siteUrl ?? "").replace(/\/+$/, "");
	return {
		title: (values["title"] ?? "").trim() || slug,
		url: base ? `${base}/${slug}` : `/${slug}`,
		description: (values["description"] ?? values["excerpt"] ?? values["ozet"] ?? "").trim(),
	};
}

/** OG görseli için en uygun alan adı (önce bilinen adlar, sonra medya sezgisi). */
export function ogFieldName(controls: ControlSpec[]): string | null {
	const names = controls.map((control) => control.name);
	const preferred = ["ogImage", "og_image", "cover", "hero", "image", "thumbnail", "kapak"];
	for (const candidate of preferred) {
		if (names.includes(candidate)) return candidate;
	}
	const match = controls.find((control) => control.name !== "title" && isMediaField(control.name, ""));
	return match?.name ?? null;
}
