// Alan-tipi kayıt defteri testleri.

import { describe, expect, it } from "vitest";
import { FIELD_TYPES, inferFieldType, isMediaField, specFor } from "./fields";

describe("specFor", () => {
	it("bilinen tipleri tanımlarıyla döndürür", () => {
		expect(specFor("boolean").widget).toBe("switch");
		expect(specFor("enum").widget).toBe("select");
		expect(specFor("datetime").widget).toBe("datetime");
		expect(specFor("string[]").widget).toBe("tags");
		expect(specFor("json").multiline).toBe(true);
	});

	it("bilinmeyen/boş tipte metne düşer", () => {
		expect(specFor(undefined)).toBe(FIELD_TYPES.string);
		expect(specFor("yok-böyle-tip" as never)).toBe(FIELD_TYPES.string);
	});

	it("her yerleşik tipin tanımı var", () => {
		const types = [
			"string",
			"richtext",
			"number",
			"boolean",
			"date",
			"datetime",
			"enum",
			"string[]",
			"json",
		] as const;
		for (const type of types) {
			expect(FIELD_TYPES[type]).toBeTruthy();
		}
	});
});

describe("inferFieldType", () => {
	it("boolean sezer", () => {
		expect(inferFieldType("true")).toBe("boolean");
		expect(inferFieldType("false")).toBe("boolean");
		expect(inferFieldType("evet")).toBe("string");
	});

	it("tarih ve tarih-saat sezer", () => {
		expect(inferFieldType("2026-10-15")).toBe("date");
		expect(inferFieldType("2026-10-15T12:30")).toBe("date");
		expect(inferFieldType("2026-10-15 12:30")).toBe("date");
	});

	it("liste ve JSON sezer", () => {
		expect(inferFieldType("[a, b]")).toBe("string[]");
		expect(inferFieldType("{ a: 1 }")).toBe("json");
	});

	it("varsayılan metin", () => {
		expect(inferFieldType("merhaba")).toBe("string");
		expect(inferFieldType("")).toBe("string");
	});
});

describe("isMediaField", () => {
	it("adı görsel çağrıştıran alanlar", () => {
		expect(isMediaField("cover", "")).toBe(true);
		expect(isMediaField("heroImage", "")).toBe(true);
		expect(isMediaField("thumbnail", "")).toBe(true);
	});

	it("değeri görsel uzantılı alanlar", () => {
		expect(isMediaField("path", "/uploads/kapak.webp")).toBe(true);
		expect(isMediaField("path", "https://x.dev/a.PNG")).toBe(true);
	});

	it("alakasız alanlar", () => {
		expect(isMediaField("title", "Merhaba dünya")).toBe(false);
		expect(isMediaField("description", "düz metin")).toBe(false);
	});
});
