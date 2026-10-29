import { describe, expect, it } from "vitest";
import {
	docSlug,
	parseAdminPath,
	resolveSiteCode,
	siteSlug,
	viewUrl,
	type NavState,
} from "./url";

const sites = [{ id: "p1", repoFullName: "acme/wuppycms-demo-site" }];

const base: NavState = { repo: "acme/wuppycms-demo-site", siteId: "p1", view: "overview" };

describe("siteSlug / docSlug", () => {
	it("repo kuyruğu ve uzantısız dosya adı", () => {
		expect(siteSlug("acme/wuppycms-demo-site")).toBe("wuppycms-demo-site");
		expect(docSlug("blog/merhaba-dunya.mdx")).toBe("merhaba-dunya");
	});
});

describe("viewUrl", () => {
	it("site yoksa /admin", () => {
		expect(viewUrl({ ...base, repo: "" })).toEqual({ pathname: "/admin", search: "" });
	});
	it("genel bakış: kısa kimlik sorguda", () => {
		expect(viewUrl(base)).toEqual({
			pathname: "/admin/wuppycms-demo-site",
			search: "?site=p1",
		});
	});
	it("koleksiyon listesi", () => {
		expect(viewUrl({ ...base, view: "entries", collection: "blog" })).toEqual({
			pathname: "/admin/wuppycms-demo-site/content/blog",
			search: "?site=p1",
		});
	});
	it("doküman slug'ı yolun sonuna gelir", () => {
		expect(
			viewUrl({
				...base,
				view: "doc",
				collection: "blog",
				docPath: "blog/merhaba-dunya.mdx",
			}),
		).toEqual({
			pathname: "/admin/wuppycms-demo-site/content/blog/merhaba-dunya",
			search: "?site=p1",
		});
	});
	it("medya: klasör yolda, kitaplık sorguda (GitCMS düzeni)", () => {
		expect(viewUrl({ ...base, view: "media", folder: "test altı", library: "r2" })).toEqual({
			pathname: "/admin/wuppycms-demo-site/media/test%20alt%C4%B1",
			search: "?site=p1&mediaLibrary=platform_r2",
		});
	});
	it("medya: depo kitaplığı repo_media olarak işaretlenir", () => {
		expect(viewUrl({ ...base, view: "media" })).toEqual({
			pathname: "/admin/wuppycms-demo-site/media",
			search: "?site=p1&mediaLibrary=repo_media",
		});
	});
});

describe("parseAdminPath", () => {
	it("kök ve site yolu", () => {
		expect(parseAdminPath("/admin")).toEqual({ kind: "overview" });
		expect(parseAdminPath("/admin/wuppycms-demo-site")).toEqual({
			kind: "overview",
			slug: "wuppycms-demo-site",
		});
	});
	it("koleksiyon, doküman, CONTENT.md ve medya", () => {
		expect(parseAdminPath("/admin/site/content/blog")).toEqual({
			kind: "entries",
			slug: "site",
			collection: "blog",
		});
		expect(parseAdminPath("/admin/site/content/blog/merhaba-dunya")).toEqual({
			kind: "doc",
			slug: "site",
			collection: "blog",
			docSlug: "merhaba-dunya",
		});
		expect(parseAdminPath("/admin/site/content-md")).toEqual({
			kind: "contentmd",
			slug: "site",
		});
		expect(parseAdminPath("/admin/site/media/test/alt%C4%B1")).toEqual({
			kind: "media",
			slug: "site",
			folder: "test/altı",
		});
	});
	it("eski biçimler ayrışır", () => {
		expect(parseAdminPath("/admin/c/blog")).toEqual({
			kind: "legacy-collection",
			collection: "blog",
		});
		expect(parseAdminPath("/admin/d/blog/blog%2Fmerhaba.md")).toEqual({
			kind: "legacy-doc",
			collection: "blog",
			path: "blog/merhaba.md",
		});
	});
	it("bilinmeyen yol", () => {
		expect(parseAdminPath("/admin/site/olmayan/sey")).toEqual({ kind: "unknown" });
	});
});

describe("resolveSiteCode", () => {
	it("kimlik veya repo adından çözer; yoksa boş", () => {
		expect(resolveSiteCode("p1", sites)).toBe("acme/wuppycms-demo-site");
		expect(resolveSiteCode("acme/wuppycms-demo-site", sites)).toBe("acme/wuppycms-demo-site");
		expect(resolveSiteCode("yok", sites)).toBe("");
		expect(resolveSiteCode(null, sites)).toBe("");
	});
});

describe("URL gidiş-dönüşü", () => {
	it("ürettiğimiz adres yine aynı duruma ayrışır", () => {
		for (const state of [
			base,
			{ ...base, view: "entries", collection: "blog" },
			{ ...base, view: "doc", collection: "blog", docPath: "blog/merhaba-dunya.mdx" },
			{ ...base, view: "contentmd" },
			{ ...base, view: "media", folder: "test/altı", library: "r2" as const },
		]) {
			const { pathname } = viewUrl(state);
			const parsed = parseAdminPath(pathname);
			if (state.view === "entries") expect(parsed.kind).toBe("entries");
			else if (state.view === "doc") expect(parsed.kind).toBe("doc");
			else if (state.view === "contentmd") expect(parsed.kind).toBe("contentmd");
			else if (state.view === "media") expect(parsed.kind).toBe("media");
			else expect(["overview"]).toContain(parsed.kind);
		}
	});
});

describe("P3 — pano/takvim/çöp adresleri", () => {
	it("çöp yolunu çözer", () => {
		expect(parseAdminPath("/admin/wuppycms-demo-site/trash")).toEqual({
			kind: "trash",
			slug: "wuppycms-demo-site",
		});
	});

	it("çöp adresini üretir", () => {
		const url = viewUrl({ ...base, view: "trash" });
		expect(url.pathname).toBe("/admin/wuppycms-demo-site/trash");
	});

	it("pano/takvim görünümünü sorguya yazar, listeyi yazmaz", () => {
		const board = viewUrl({ ...base, view: "entries", collection: "blog", entriesView: "board" });
		expect(board.pathname).toBe("/admin/wuppycms-demo-site/content/blog");
		expect(board.search).toContain("view=board");
		const list = viewUrl({ ...base, view: "entries", collection: "blog", entriesView: "list" });
		expect(list.search).not.toContain("view=");
	});
});

describe("site ayarları sayfası", () => {
	it("settings yolunu çözer", () => {
		expect(parseAdminPath("/admin/wuppycms-demo-site/settings")).toEqual({
			kind: "settings",
			slug: "wuppycms-demo-site",
		});
	});

	it("settings adresini üretir", () => {
		const url = viewUrl({ ...base, view: "settings" });
		expect(url.pathname).toBe("/admin/wuppycms-demo-site/settings");
	});
});
