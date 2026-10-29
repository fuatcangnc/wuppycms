// Araştırma notları testleri — yol türetme + ayrıştırma/serileştirme turu.

import { describe, expect, it } from "vitest";
import { parseResearchNotes, researchPathFor, serializeResearchNotes } from "./research";

describe("researchPathFor", () => {
	it("src/content kökünü soyar ve uzantıyı .md yapar", () => {
		expect(researchPathFor("src/content/blog/merhaba-dunya.mdx")).toBe(
			".wuppycms/research/blog/merhaba-dunya.md",
		);
	});

	it("src/content dışındaki yolları olduğu gibi korur", () => {
		expect(researchPathFor("notes/taslak.md")).toBe(".wuppycms/research/notes/taslak.md");
	});
});

describe("parseResearchNotes", () => {
	it("madde işaretli satırları sırayla çıkarır; başlığı yok sayar", () => {
		const markdown = "# Araştırma notları (WuppyCMS)\n\n- birinci\n* ikinci\n\nBaşka metin\n- üçüncü\n";
		expect(parseResearchNotes(markdown)).toEqual(["birinci", "ikinci", "üçüncü"]);
	});

	it("boş metinde boş liste döner", () => {
		expect(parseResearchNotes("")).toEqual([]);
	});
});

describe("serializeResearchNotes", () => {
	it("tur: parse(serialize(notlar)) aynı listeyi verir", () => {
		const notes = ["Kaynak: https://örnek.dev", "Alıntı: “kod senin reponda yaşar”"];
		expect(parseResearchNotes(serializeResearchNotes(notes))).toEqual(notes);
	});

	it("satır sonlarını boşluğa indirger", () => {
		expect(parseResearchNotes(serializeResearchNotes(["iki\nsatır"]))).toEqual(["iki satır"]);
	});

	it("boş liste başlık-only dosya üretir; tekrar parse boş döner", () => {
		expect(parseResearchNotes(serializeResearchNotes([]))).toEqual([]);
	});
});
