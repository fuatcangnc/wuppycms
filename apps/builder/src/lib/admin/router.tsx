// Admin yönlendiricisi — adres sahipliği react-router'da (history, popstate,
// navigate); iş katmanı yalnız navigate.ts üzerinden goTo() çağırır. Adres
// sözleşmesi ve çözümleme SAF taraftadır: url.ts (testler orada).
//
// akış: tık → action (state set + goTo) → URL PUSH → RouteApplier projeksiyonu
//       (idempotent, çoğu dalda no-op) → kanonik değilse replace
// derin bağlantı / popstate → RouteApplier → selectSite/openCollection/openDoc…
//
// Eski adres biçimleri (/admin/c/…, /admin/d/…, ?site=repo%2Fad, ?folder=)
// okunur ve ilk uygulamada kanonik biçime normalleştirilir.

import { createBrowserRouter } from "react-router-dom";
import AdminShell from "@/components/admin/AdminShell";
import RouteApplier from "@/components/admin/RouteApplier";
import {
	openCollection,
	openContentMd,
	openDoc,
	openMedia,
	openReviews,
	openTrash,
	refreshEntries,
	selectSite,
	setMediaFolder,
	setMediaLibrary,
	showOverview,
} from "./actions";
import { canonicalUrl, bindNavigator, setApplying } from "./navigate";
import {
	$collection,
	$doc,
	$entries,
	$entriesView,
	$mediaFolder,
	$mediaLibrary,
	$pagePath,
	$site,
	$sites,
	$view,
} from "./store";
import {
	docSlug,
	LIBRARY_PARAM,
	parseAdminPath,
	resolveSiteCode,
	siteSlug,
} from "./url";

const shell = (
	<>
		<RouteApplier />
		<AdminShell />
	</>
);

let instance: ReturnType<typeof createBrowserRouter> | null = null;

/**
 * Router örneği TEMBEL yaratılır — workerd SSR'da `document`/`window` yoktur
 * ve client:only adacıkların modülleri sunucuda import edilir; bu yüzden
 * createBrowserRouter modül kapsamında çağrılamaz. İlk istek yalnız
 * istemciden gelir (AdminApp render'ı).
 */
export function getAdminRouter() {
	if (!instance) {
		instance = createBrowserRouter([
			{ path: "/admin", element: shell },
			{ path: "/admin/:slug", element: shell },
			{ path: "/admin/:slug/content-md", element: shell },
			{ path: "/admin/:slug/content/:col", element: shell },
			{ path: "/admin/:slug/content/:col/*", element: shell },
			{ path: "/admin/:slug/media", element: shell },
			{ path: "/admin/:slug/media/*", element: shell },
			{ path: "/admin/:slug/trash", element: shell },
			{ path: "/admin/:slug/reviews", element: shell },
			{ path: "/admin/:slug/settings", element: shell },
			{ path: "/admin/:slug/pages/*", element: shell },
			{ path: "/admin/c/:col", element: shell },
			{ path: "/admin/d/:col/*", element: shell },
			{ path: "*", element: shell },
		]);
		bindNavigator((to, options) => void instance?.navigate(to, options));
	}
	return instance;
}

/** Adresi okuyup mağazaya uygula; sonda kanonik adrese normalleştir. */
export async function applyRoute(url: URL): Promise<void> {
	setApplying(true);
	try {
		const target = parseAdminPath(url.pathname);
		let repo = resolveSiteCode(
			url.searchParams.get("site") ?? url.searchParams.get("repo"),
			$sites.get(),
		);
		const slug = "slug" in target ? target.slug : undefined;
		if (!repo && slug) {
			// site kimliği olmadan tek eşleşmeyle çöz (eski davranış).
			const matches = $sites.get().filter((s) => siteSlug(s.repoFullName) === slug);
			if (matches.length === 1) repo = matches[0].repoFullName;
		}
		if (!repo) {
			// Eski `/admin/c/...` ve `/admin/d/...` adreslerinde slug yoktur.
			// Önce aktif siteyi kullan; yoksa tek siteli kurulumda onu seç.
			// Aksi hâlde applyRoute erken döner ve legacy bağlantı genel bakışa düşer.
			const sites = $sites.get();
			repo = $site.get() || (sites.length === 1 ? sites[0]!.repoFullName : "");
		}
		if (repo && repo !== $site.get()) await selectSite(repo);
		if (!repo) return;

		switch (target.kind) {
			case "entries":
				if ($collection.get() !== target.collection || $view.get() !== "entries")
					await openCollection(target.collection);
				{
					// P3: liste görünümü adresten okunur (liste varsayılan).
					const raw = url.searchParams.get("view");
					const want = raw === "board" || raw === "calendar" ? raw : "list";
					if ($entriesView.get() !== want) $entriesView.set(want);
				}
				break;
			case "doc": {
				const already =
					$view.get() === "doc" &&
					$doc.get()?.collectionKey === target.collection &&
					docSlug($doc.get()?.path ?? "") === target.docSlug;
				if (!already) {
					if ($collection.get() !== target.collection) $collection.set(target.collection);
					await openCollection(target.collection);
					const entry = $entries.get().find((row) => docSlug(row.path) === target.docSlug);
					if (entry) await openDoc(entry.path);
					else void refreshEntries();
				}
				break;
			}
			case "contentmd":
				if ($view.get() !== "contentmd") await openContentMd();
				break;
			case "trash":
				if ($view.get() !== "trash") openTrash();
				break;
			case "review":
				if ($view.get() !== "review") openReviews();
				break;
			case "settings":
				if ($view.get() !== "settings") $view.set("settings");
				break;
			case "page":
				if ($view.get() !== "page" || $pagePath.get() !== target.pagePath) {
					$pagePath.set(target.pagePath);
					$view.set("page");
				}
				break;
			case "media": {
				if ($view.get() !== "media") await openMedia();
				const library = url.searchParams.get("mediaLibrary");
				const want =
					library === LIBRARY_PARAM.r2 || library === "r2"
						? "r2"
						: library === LIBRARY_PARAM.repo || library === "repo"
							? "repo"
							: null;
				if (want && $mediaLibrary.get() !== want) setMediaLibrary(want);
				const folder = target.folder || url.searchParams.get("folder") || "";
				if (folder && $mediaFolder.get() !== folder) setMediaFolder(folder);
				break;
			}
			case "legacy-collection":
				if ($collection.get() !== target.collection || $view.get() !== "entries")
					await openCollection(target.collection);
				break;
			case "legacy-doc":
				if (!($view.get() === "doc" && $doc.get()?.path === target.path)) {
					if ($collection.get() !== target.collection) $collection.set(target.collection);
					await openDoc(target.path);
					void refreshEntries();
				}
				break;
			case "overview":
				if ($view.get() !== "overview" && $view.get() !== "empty" && $view.get() !== "hint")
					showOverview();
				break;
			default:
				break;
		}
	} finally {
		setApplying(false);
		// Eylem iptal edildiyse (ör. kaydedilmemiş değişiklik) veya adres
		// kanonik değilse mağaza durumunun adresine düzelt.
		const want = canonicalUrl();
		if (want.pathname !== window.location.pathname || want.search !== window.location.search) {
			getAdminRouter().navigate(want, { replace: true });
		}
	}
}
