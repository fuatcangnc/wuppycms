// Eylem → adres köprüsü — iş katmanı yalnız goTo() çağırır; yönlendirme
// fiilini react-router yürütür (bağlayıcı router.tsx'te). Uygulama sırasında
// (URL → mağaza projeksiyonu) geri yazım yapılmaz.

import type { NavState } from "./url";
import { viewUrl } from "./url";
import {
	$collection,
	$doc,
	$entriesView,
	$mediaFolder,
	$mediaLibrary,
	$pagePath,
	$site,
	$sites,
	$view,
} from "./store";

type To = { pathname: string; search: string };
type Navigator = (to: To, options?: { replace?: boolean }) => void;

let navigator: Navigator | null = null;
let applying = false;

export function bindNavigator(fn: Navigator): void {
	navigator = fn;
}

/** URL→durum uygulaması sürüyor; bu sırada goTo sessizdir. */
export function setApplying(value: boolean): void {
	applying = value;
}

/** Mağazadaki görünüm durumundan tam adres durumu üretir. */
export function storeNav(overrides: Partial<NavState> = {}): NavState {
	const repo = overrides.repo ?? $site.get();
	return {
		repo,
		siteId: $sites.get().find((s) => s.repoFullName === repo)?.id ?? repo,
		view: $view.get(),
		collection: $collection.get() || undefined,
		docPath: $doc.get()?.path,
		pagePath: $pagePath.get(),
		folder: $mediaFolder.get(),
		library: $mediaLibrary.get() === "r2" ? "r2" : "repo",
		entriesView: $entriesView.get(),
		...overrides,
	};
}

/** Görünüm durumunu (veya verilen parçayı) adres çubuğuna yazar. */
export function goTo(overrides: Partial<NavState> = {}, options?: { replace?: boolean }): void {
	if (applying || !navigator) return;
	navigator(viewUrl(storeNav(overrides)), options);
}

/** Mevcut durumun kanonik adresi — normalizasyon/geri alma karşılaştırması. */
export function canonicalUrl(): To {
	return viewUrl(storeNav());
}
