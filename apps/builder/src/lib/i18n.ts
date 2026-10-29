// i18n çekirdeği — kaynak dil tr (docs/i18n.md). Locale dosyaları Vite glob ile
// derlemeye girer; yeni dil eklemek için dosyayı koymak yeterlidir (kayıt yok).
// Eksik anahtar sırayla: istenen dil → tr → anahtarın kendisi (UI'da görünür ki
// eksik çeviri sessizce kaybolmasın).

import { persistentAtom } from "@nanostores/persistent";
import { atom } from "nanostores";
import { parse } from "yaml";

const RAW_LOCALES = import.meta.glob("./locales/*.yaml", { eager: true, query: "?raw", import: "default" }) as Record<
	string,
	string
>;

/** Kaynak dil — eksik anahtarların düştüğü dil (anahtarların yazım dili). */
export const SOURCE_LOCALE = "tr";

/** Ürünün açılış dili — kullanıcı seçimi yoksa arayüz bu dilde doğar. */
export const DEFAULT_LOCALE = "en";

type LocaleTree = Record<string, unknown>;

function parseLocale(raw: string): LocaleTree {
	try {
		const parsed = parse(raw) as unknown;
		return parsed && typeof parsed === "object" ? (parsed as LocaleTree) : {};
	} catch {
		return {};
	}
}

const catalogs: Record<string, LocaleTree> = {};
for (const [path, raw] of Object.entries(RAW_LOCALES)) {
	const code = path.split("/").pop()!.replace(/\.yaml$/, "");
	catalogs[code] = parseLocale(raw);
}

/** Derlemeye giren diller (varsayılan ilk). */
export const AVAILABLE_LOCALES = [
	DEFAULT_LOCALE,
	...Object.keys(catalogs)
		.filter((code) => code !== DEFAULT_LOCALE)
		.sort(),
];

/** Seçili dil — kalıcı; yoksa varsayılan dil (İngilizce). */
export const $locale = persistentAtom<string>("wuppycms:locale", DEFAULT_LOCALE);

/** Test/istem dışı kullanım için dil değiştirici. */
export const $localeOverride = atom<string | null>(null);

function lookup(tree: LocaleTree, key: string): string | undefined {
	let node: unknown = tree;
	for (const part of key.split(".")) {
		if (typeof node !== "object" || node === null) return undefined;
		node = (node as Record<string, unknown>)[part];
	}
	return typeof node === "string" ? node : undefined;
}

/** {ad} yer tutucularını doldurur; eksik parametre olduğu gibi kalır. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in params ? String(params[name]) : match,
	);
}

/**
 * Çeviri: `t("sidebar.media")`. İkinci argüman yer tutucular içindir.
 * Eksik anahtar kaynak dilde aranır; o da yoksa anahtar döner (görünür eksik).
 */
export function t(key: string, params?: Record<string, string | number>): string {
	const requested = $localeOverride.get() ?? $locale.get();
	const fromRequested = lookup(catalogs[requested] ?? {}, key);
	if (fromRequested !== undefined) return interpolate(fromRequested, params);
	const fromSource = lookup(catalogs[SOURCE_LOCALE] ?? {}, key);
	if (fromSource !== undefined) return interpolate(fromSource, params);
	return key;
}

/** Dile göre ağaç (check-locales ve testler için). */
export function localeCatalog(code: string): LocaleTree {
	return catalogs[code] ?? {};
}

/** İç içe anahtarları düz listeye çevirir: ["sidebar.media", …]. */
export function flattenKeys(tree: LocaleTree, prefix = ""): string[] {
	const keys: string[] = [];
	for (const [name, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${name}` : name;
		if (typeof value === "string") keys.push(path);
		else if (value && typeof value === "object") keys.push(...flattenKeys(value as LocaleTree, path));
	}
	return keys;
}
