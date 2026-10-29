// Bul & Değiştir + kelime sayımı testleri.

import { describe, expect, it } from "vitest";
import { countMatches, countWords, replaceAllMatches, replaceFirst } from "./find-replace";

describe("countMatches", () => {
	it("büyük/küçük harf duyarsız sayar", () => {
		expect(countMatches("Merhaba merhaba MERHABA", "merhaba")).toBe(3);
	});

	it("duyarlı modda yalnız birebir eşleşir", () => {
		expect(countMatches("Merhaba merhaba", "merhaba", true)).toBe(1);
	});

	it("örtüşmeyen sayar; boş sorgu 0", () => {
		expect(countMatches("aaaa", "aa")).toBe(2);
		expect(countMatches("metin", "")).toBe(0);
	});
});

describe("replaceFirst", () => {
	it("ilk eşleşmeyi değiştirir", () => {
		const result = replaceFirst("bir iki bir", "bir", "üç");
		expect(result.text).toBe("üç iki bir");
		expect(result.replaced).toBe(true);
	});

	it("bulunamazsa aynen döner", () => {
		expect(replaceFirst("metin", "yok", "x")).toEqual({ text: "metin", replaced: false });
	});
});

describe("replaceAllMatches", () => {
	it("tümünü değiştirir ve sayar", () => {
		const result = replaceAllMatches("bir iki bir", "bir", "üç");
		expect(result.text).toBe("üç iki üç");
		expect(result.count).toBe(2);
	});

	it("Türkçe İ/I duyarsızlığı locale ile çalışır", () => {
		expect(replaceAllMatches("İSTANBUL istanbul", "istanbul", "x").count).toBe(2);
	});
});

describe("countWords", () => {
	it("boş metin 0, çok boşluk tek sayılır", () => {
		expect(countWords("")).toBe(0);
		expect(countWords("   ")).toBe(0);
		expect(countWords("bir   iki\nüç")).toBe(3);
	});
});
