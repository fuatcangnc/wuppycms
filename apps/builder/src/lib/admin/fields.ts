// Alan-tipi kayıt defteri — tip → widget + sınıflama bilgisi tek yerde.
// Sveltia'nın `contents/fields/` kayıt defteri deseninin bizdeki karşılığı
// (docs/sveltia-analysis.md): form (DocView), tip sezimi ve P1 frontmatter
// paneli aynı tanımdan türetir. Widget karşılıkları Bejamas portlarıdır
// (input → Input, select → native select, switch → checkbox…).
//
// Dönüşümler (rawToDisplay/displayToRaw) bilinçli olarak frontmatter.ts'te
// kalır: serileştirme bir YAML sorunudur, widget bir görünüm sorunu.

import type { FieldType } from "@wuppycms/content-schema";

/** Formda kullanılacak kontrol türü. */
export type FieldWidget =
	| "input" // tek satır (Input)
	| "textarea" // çok satır (richtext/json)
	| "select" // enum
	| "switch" // boolean
	| "date" // tarih
	| "datetime" // tarih + saat
	| "number" // sayısal giriş
	| "tags"; // string[] (virgülle ayrılmış)

export type FieldTypeSpec = {
	/** İnsan etiketi (panel başlıkları, hazırlık özetleri). */
	label: string;
	widget: FieldWidget;
	/** Yeni alanın boş değeri (görüntü biçimi). */
	empty: string;
	/** Panel/özet satırında kısaltılan çok satırlı içerik mi. */
	multiline: boolean;
};

/** Yerleşik alan tipleri — content-schema `FieldType` ile birebir. */
export const FIELD_TYPES: Record<FieldType, FieldTypeSpec> = {
	string: { label: "Metin", widget: "input", empty: "", multiline: false },
	richtext: { label: "Zengin metin", widget: "textarea", empty: "", multiline: true },
	number: { label: "Sayı", widget: "number", empty: "", multiline: false },
	boolean: { label: "Evet/Hayır", widget: "switch", empty: "false", multiline: false },
	date: { label: "Tarih", widget: "date", empty: "", multiline: false },
	datetime: { label: "Tarih-saat", widget: "datetime", empty: "", multiline: false },
	enum: { label: "Seçim", widget: "select", empty: "", multiline: false },
	"string[]": { label: "Liste", widget: "tags", empty: "", multiline: false },
	json: { label: "JSON", widget: "textarea", empty: "{}", multiline: true },
};

/** Tipin tanımı; bilinmeyen/boş tip metin kabul edilir. */
export function specFor(type: FieldType | undefined): FieldTypeSpec {
	return (type && FIELD_TYPES[type]) || FIELD_TYPES.string;
}

/** Şemada olmayan frontmatter anahtarlarının tip sezimi. */
export function inferFieldType(raw: string): FieldType {
	const value = raw.trim();
	if (/^(true|false)$/.test(value)) return "boolean";
	if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?$/.test(value)) return "date";
	if (value.startsWith("[")) return "string[]";
	if (value.startsWith("{")) return "json";
	return "string";
}

/** Adı görsel çağrıştıran alanlar (GitCMS "is image" sezgisi). */
const IMAGE_NAME_RE = /(image|img|cover|hero|banner|avatar|photo|picture|logo|thumb)/i;
/** Değeri görsel uzantısıyla biten alanlar. */
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

/** Medya alanı mı: ad ya da değer görsel mi (seçici/önizleme buna bakar). */
export function isMediaField(name: string, value: string): boolean {
	return IMAGE_NAME_RE.test(name) || IMAGE_EXT_RE.test(value.trim());
}
