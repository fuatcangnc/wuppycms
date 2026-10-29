// Adres sözleşmesi — saf (mağaza/React yok): react-router'un taşıdığı URL'i
// görünüm durumuna ÇÖZER, görünüm durumundan URL ÜRETİR. Testler buradadır.
//
//   /admin/{site}                        genel bakış
//   /admin/{site}/content/{koleksiyon}   kayıt listesi
//   /admin/{site}/content/{koleksiyon}/{slug}   doküman
//   /admin/{site}/content-md             CONTENT.md
//   /admin/{site}/media/{klasör…}        medya (kitaplık "mediaLibrary"de)
//   ?site={proje-kimliği}&mediaLibrary=repo_media|platform_r2
//
// Eski biçimler okunur ve kanonik adrese normalleştirilir:
//   /admin/c/{koleksiyon}  ·  /admin/d/{koleksiyon}/{yol}  ·  ?folder=

export const LIBRARY_PARAM = { repo: "repo_media", r2: "platform_r2" } as const;

export type NavState = {
	/** repoFullName ("acme/site"); boşsa site hiç yok. */
	repo: string;
	/** Sorguya yazılacak kısa proje kimliği. */
	siteId: string;
	view: "overview" | "entries" | "doc" | "contentmd" | "media" | "trash" | "review" | "settings" | "page" | (string & {});
	collection?: string;
	/** Dokümanın depo yolu ("blog/merhaba.mdx"). */
	docPath?: string;
	/** `src/pages`e göreli Astro sayfası (ör. blog/index.astro). */
	pagePath?: string;
	/** Medya klasörü (köke göreli, boş = kök). */
	folder?: string;
	library?: "repo" | "r2";
	/** Kayıt listesi görünümü (P3): liste/pano/takvim. */
	entriesView?: "list" | "board" | "calendar";
};

export type ParsedAdminPath =
	| { kind: "overview"; slug?: string }
	| { kind: "contentmd"; slug: string }
	| { kind: "entries"; slug: string; collection: string }
	| { kind: "doc"; slug: string; collection: string; docSlug: string }
	| { kind: "media"; slug: string; folder: string }
	| { kind: "trash"; slug: string }
	| { kind: "review"; slug: string }
	| { kind: "settings"; slug: string }
	| { kind: "page"; slug: string; pagePath: string }
	| { kind: "legacy-collection"; collection: string }
	| { kind: "legacy-doc"; collection: string; path: string }
	| { kind: "unknown" };

export function siteSlug(repoFullName: string): string {
	return repoFullName.split("/").pop() ?? repoFullName;
}

function withoutExtension(path: string): string {
	return path.replace(/\.\w+$/, "");
}

/** Yolun uzantısız dosya adı — URL'deki doküman slug'ı budur. */
export function docSlug(path: string): string {
	return withoutExtension(path.split("/").pop() ?? path);
}

/** site sorgusundaki proje kimliğini/temsilî repo adını çözer. */
export function resolveSiteCode(
	code: string | null,
	sites: { id: string; repoFullName: string }[],
): string {
	if (!code) return "";
	return (
		sites.find((s) => s.id === code)?.repoFullName ??
		sites.find((s) => s.repoFullName === code)?.repoFullName ??
		""
	);
}

/** Yolu görünüm niyetine çevirir (uygulama tarafı; react-router yalnız taşır). */
export function parseAdminPath(pathname: string): ParsedAdminPath {
	const segments = pathname
		.replace(/^\/admin\/?/, "")
		.split("/")
		.filter(Boolean)
		.map(decodeURIComponent);
	const [first, ...rest] = segments;
	if (!first) return { kind: "overview" };
	if (segments.length === 1) return { kind: "overview", slug: first };
	if (first === "c" && rest.length === 1) return { kind: "legacy-collection", collection: rest[0]! };
	if (first === "d" && rest.length >= 2)
		return { kind: "legacy-doc", collection: rest[0]!, path: rest.slice(1).join("/") };

	const slug = first;
	const [head, ...tail] = rest;
	if (!head) return { kind: "overview", slug };
	if (head === "content-md") return { kind: "contentmd", slug };
	if (head === "content" && tail.length === 1)
		return { kind: "entries", slug, collection: tail[0]! };
	if (head === "content" && tail.length >= 2)
		return { kind: "doc", slug, collection: tail[0]!, docSlug: tail.slice(1).join("/") };
	if (head === "media") return { kind: "media", slug, folder: tail.join("/") };
	if (head === "trash") return { kind: "trash", slug };
	if (head === "reviews") return { kind: "review", slug };
	if (head === "settings") return { kind: "settings", slug };
	if (head === "pages" && tail.length > 0)
		return { kind: "page", slug, pagePath: tail.join("/").replace(/^src\/pages\//, "") };
	return { kind: "unknown" };
}

/** Görünüm durumundan kanonik adresi üretir. */
export function viewUrl(state: NavState): { pathname: string; search: string } {
	if (!state.repo) return { pathname: "/admin", search: "" };
	const params = new URLSearchParams();
	params.set("site", state.siteId || state.repo);
	const base = `/admin/${encodeURIComponent(siteSlug(state.repo))}`;
	let path = base;
	if (state.view === "contentmd") path = `${base}/content-md`;
	else if (state.view === "entries" && state.collection) {
		path = `${base}/content/${encodeURIComponent(state.collection)}`;
		// P3: liste görünümü adreste taşınır (liste varsayılan, yazılmaz).
		if (state.entriesView && state.entriesView !== "list") params.set("view", state.entriesView);
	} else if (state.view === "doc") {
		if (state.docPath) {
			const collection = state.collection ?? state.docPath.split("/")[0] ?? "";
			path = `${base}/content/${encodeURIComponent(collection)}/${encodeURIComponent(
				docSlug(state.docPath),
			)}`;
		} else if (state.collection) {
			path = `${base}/content/${encodeURIComponent(state.collection)}`;
		}
	} else if (state.view === "media") {
		path = `${base}/media`;
		const folder = state.folder ?? "";
		if (folder) path += `/${folder.split("/").map(encodeURIComponent).join("/")}`;
		params.set("mediaLibrary", LIBRARY_PARAM[state.library === "r2" ? "r2" : "repo"]);
	} else if (state.view === "trash") {
		path = `${base}/trash`;
	} else if (state.view === "review") {
		path = `${base}/reviews`;
	} else if (state.view === "settings") {
		path = `${base}/settings`;
	} else if (state.view === "page" && state.pagePath) {
		path = `${base}/pages/${state.pagePath.split("/").map(encodeURIComponent).join("/")}`;
	}
	return { pathname: path, search: `?${params.toString()}` };
}
