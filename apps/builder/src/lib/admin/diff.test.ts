// Diff modülü testleri.

import { describe, expect, it } from "vitest";
import { diffLines, diffStats } from "./diff";

describe("diffLines", () => {
	it("aynı metinde tüm satırlar 'same'", () => {
		const rows = diffLines("a\nb", "a\nb");
		expect(rows.map((r) => r.type)).toEqual(["same", "same"]);
		expect(diffStats(rows)).toEqual({ added: 0, removed: 0 });
	});

	it("değişen satırı del + add olarak gösterir", () => {
		const rows = diffLines("başlık: A\ngövde", "başlık: B\ngövde");
		expect(rows.map((r) => r.type)).toEqual(["del", "add", "same"]);
		expect(rows[0]).toMatchObject({ type: "del", oldLine: 1, text: "başlık: A" });
		expect(rows[1]).toMatchObject({ type: "add", newLine: 1, text: "başlık: B" });
		expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
	});

	it("eklenen satırı yakalar", () => {
		const rows = diffLines("a\nc", "a\nb\nc");
		expect(diffStats(rows)).toEqual({ added: 1, removed: 0 });
		expect(rows.find((r) => r.type === "add")?.text).toBe("b");
	});

	it("silinen satırı yakalar", () => {
		const rows = diffLines("a\nb\nc", "a\nc");
		expect(diffStats(rows)).toEqual({ added: 0, removed: 1 });
		expect(rows.find((r) => r.type === "del")?.text).toBe("b");
	});

	it("satır numaralarını iki tarafta da izler", () => {
		const rows = diffLines("a\nb\nc", "a\nc");
		const lastSame = rows.at(-1)!;
		expect(lastSame).toMatchObject({ type: "same", oldLine: 3, newLine: 2 });
	});

	it("tamamen farklı metinlerde hepsi del+add", () => {
		const rows = diffLines("x\ny", "1\n2");
		expect(diffStats(rows)).toEqual({ added: 2, removed: 2 });
	});

	it("çok büyük dosyada kaba moda düşer ama ortak önek/sonek korunur", () => {
		const bigOld = ["baş", ...Array.from({ length: 1600 }, (_, i) => `eski-${i}`), "son"];
		const bigNew = ["baş", ...Array.from({ length: 1600 }, (_, i) => `yeni-${i}`), "son"];
		const rows = diffLines(bigOld.join("\n"), bigNew.join("\n"));
		expect(rows[0]).toMatchObject({ type: "same", text: "baş" });
		expect(rows.at(-1)).toMatchObject({ type: "same", text: "son" });
		expect(diffStats(rows)).toEqual({ added: 1600, removed: 1600 });
	});
});
