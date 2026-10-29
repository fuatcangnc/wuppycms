// P1 meta yardımcıları testleri — durum, hazırlık, arama önizlemesi, OG alanı.

import { describe, expect, it } from "vitest";
import type { ControlSpec } from "./form";
import { normalizeStatus, ogFieldName, readiness, searchPreview, statusLabel } from "./meta";

const control = (name: string): ControlSpec => ({
	name,
	label: name,
	type: "string",
	required: false,
});

describe("durum iş akışı", () => {
	it("bilinen değerleri korur", () => {
		expect(normalizeStatus("review")).toBe("review");
		expect(normalizeStatus("Ready")).toBe("ready");
		expect(normalizeStatus(" draft ")).toBe("draft");
	});

	it("bilinmeyen/boş değeri taslağa çeker", () => {
		expect(normalizeStatus(undefined)).toBe("draft");
		expect(normalizeStatus("yayında")).toBe("draft");
	});

	it("etiketler i18n anahtarı (UI t() ile çevirir)", () => {
		expect(statusLabel("draft")).toBe("status.draft");
		expect(statusLabel("review")).toBe("status.review");
		expect(statusLabel("ready")).toBe("status.ready");
	});
});

describe("hazırlık skoru", () => {
	it("boş doküman 0 verir", () => {
		const { score } = readiness({}, "");
		expect(score).toBe(0);
	});

	it("tam doküman 100 verir", () => {
		const { score } = readiness(
			{
				title: "Merhaba",
				description: "Kısa açıklama",
				date: "2026-10-15",
				status: "ready",
			},
			"x".repeat(130),
		);
		expect(score).toBe(100);
	});

	it("parça parça ağırlıklarla artar", () => {
		expect(readiness({ title: "Başlık" }, "").score).toBe(25);
		expect(readiness({ title: "Başlık", description: "Açıklama" }, "").score).toBe(45);
		expect(readiness({ title: "Başlık", description: "Açıklama", date: "2026-01-01" }, "").score).toBe(60);
		expect(readiness({}, "x".repeat(120)).score).toBe(20);
	});

	it("excerpt/ozet açıklama yerine geçer", () => {
		expect(readiness({ excerpt: "özet" }, "").items.find((i) => i.key === "description")?.done).toBe(true);
		expect(readiness({ ozet: "özet" }, "").items.find((i) => i.key === "description")?.done).toBe(true);
	});
});

describe("arama önizlemesi", () => {
	it("site adresi + slug ile URL üretir", () => {
		const preview = searchPreview({
			siteUrl: "https://demo.wuppycms.dev/",
			docPath: "src/content/blog/merhaba-dunya.mdx",
			values: { title: "Merhaba dünya", description: "İlk yazı" },
		});
		expect(preview.title).toBe("Merhaba dünya");
		expect(preview.url).toBe("https://demo.wuppycms.dev/merhaba-dunya");
		expect(preview.description).toBe("İlk yazı");
	});

	it("başlık yoksa slug'a düşer; site adresi yoksa yol gösterir", () => {
		const preview = searchPreview({ docPath: "a/b/yazi.md", values: {} });
		expect(preview.title).toBe("yazi");
		expect(preview.url).toBe("/yazi");
	});
});

describe("OG alanı seçimi", () => {
	it("bilinen adları önceler", () => {
		expect(ogFieldName([control("title"), control("cover"), control("heroImage")])).toBe("cover");
		expect(ogFieldName([control("ogImage")])).toBe("ogImage");
	});

	it("medya sezgisiyle bulur", () => {
		expect(ogFieldName([control("title"), control("heroBanner")])).toBe("heroBanner");
		expect(ogFieldName([control("banner")])).toBe("banner");
	});

	it("yoksa null", () => {
		expect(ogFieldName([control("title"), control("description")])).toBeNull();
	});
});
