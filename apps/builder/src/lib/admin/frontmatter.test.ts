import { describe, expect, it } from "vitest";
import { displayToRaw, parseDoc, rawToDisplay, serializeDoc } from "./frontmatter";

describe("parseDoc / serializeDoc", () => {
	it("düz frontmatter'ı sıra + ham değerlerle okur ve birebir geri yazar", () => {
		const raw = "---\ntitle: Merhaba\ndraft: false\n---\nGövde satırı\n";
		const doc = parseDoc(raw);
		expect(doc.hasFrontmatter).toBe(true);
		expect(doc.order).toEqual(["title", "draft"]);
		expect(doc.values.get("title")).toBe("Merhaba");
		expect(doc.values.get("draft")).toBe("false");
		expect(doc.body).toBe("Gövde satırı\n");
		expect(serializeDoc(doc.order, doc.values, doc.body)).toBe(raw);
	});

	it("frontmatter yoksa gövde olduğu gibi kalır", () => {
		const doc = parseDoc("# Başlık\n\nMetin");
		expect(doc.hasFrontmatter).toBe(false);
		expect(doc.order).toEqual([]);
		expect(doc.body).toBe("# Başlık\n\nMetin");
	});

	it("yorum satırlarını atlar, blok diziyi önceki anahtara ekler", () => {
		const doc = parseDoc("---\n# yorum\ntags:\n  - a\n  - b\n---\n");
		expect(doc.order).toEqual(["tags"]);
		expect(doc.values.get("tags")).toBe("\n  - a\n  - b");
		expect(rawToDisplay(doc.values.get("tags") ?? "", "string[]")).toBe("a, b");
	});

	it("Unicode anahtarları üst-seviye sayar (özelNot, yayınTarihi)", () => {
		const doc = parseDoc("---\ntitle: Başlık\nözelNot: deneme\nyayınTarihi: 2026-10-15\n---\n");
		expect(doc.order).toEqual(["title", "özelNot", "yayınTarihi"]);
		expect(doc.values.get("özelNot")).toBe("deneme");
		expect(doc.values.get("yayınTarihi")).toBe("2026-10-15");
	});
});

describe("rawToDisplay", () => {
	it("boolean: true/yes evet, gerisi hayır", () => {
		expect(rawToDisplay("true", "boolean")).toBe("true");
		expect(rawToDisplay("yes", "boolean")).toBe("true");
		expect(rawToDisplay('"false"', "boolean")).toBe("false");
		expect(rawToDisplay("", "boolean")).toBe("false");
	});
	it("date/datetime tarih maskeleri", () => {
		expect(rawToDisplay("'2026-10-01'", "date")).toBe("2026-10-01");
		expect(rawToDisplay("2026-10-01T12:30:00Z", "datetime")).toBe("2026-10-01T12:30");
	});
	it("akış dizisi ve tırnaklı çok satır", () => {
		expect(rawToDisplay("[react, ai]", "string[]")).toBe("react, ai");
		expect(rawToDisplay('"a\\nb"', "string")).toBe("a\nb");
	});
	it("tanımsız alan boş döner", () => {
		expect(rawToDisplay(undefined, "string")).toBe("");
	});
});

describe("displayToRaw", () => {
	it("boolean ve dizi", () => {
		expect(displayToRaw("true", "boolean")).toBe("true");
		expect(displayToRaw("false", "boolean")).toBe("false");
		expect(displayToRaw("a, b", "string[]")).toBe("[a, b]");
		expect(displayToRaw("", "string[]")).toBe("[]");
		expect(displayToRaw("a: b", "string[]")).toBe('["a: b"]');
	});
	it("YAML anahtar sözcüğü gibi görünen metinler tırnaklanır", () => {
		expect(displayToRaw("true", "string")).toBe('"true"');
		expect(displayToRaw("2026", "string")).toBe('"2026"');
		expect(displayToRaw("Merhaba Dünya", "string")).toBe("Merhaba Dünya");
	});
	it("çok satır kaçarak tek satıra katlanır; json boşsa {}", () => {
		expect(displayToRaw("a\nb", "string")).toBe('"a\\nb"');
		expect(displayToRaw("", "json")).toBe("{}");
	});
	it("görüntü → ham → görüntü gidiş-dönüşü korunur", () => {
		for (const value of ["düz metin", "true", "a: b", "a\nb", ""]) {
			expect(rawToDisplay(displayToRaw(value, "string"), "string")).toBe(value);
		}
	});
});
