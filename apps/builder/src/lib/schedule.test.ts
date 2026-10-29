// Zamanlama kuralları testleri — saf yürütücü mantığı.

import { describe, expect, it } from "vitest";
import { isDue, parsePublishAt, pickDueDocs, publishMessage } from "./schedule";

const now = new Date("2026-10-15T12:00:00");

describe("parsePublishAt", () => {
	it("ISO tarih-saat, boşluklu biçim ve salt tarihi çözer (yerel saat)", () => {
		const iso = parsePublishAt("2026-11-01T09:00")!;
		expect([iso.getFullYear(), iso.getMonth() + 1, iso.getDate(), iso.getHours(), iso.getMinutes()]).toEqual([
			2026, 11, 1, 9, 0,
		]);
		const spaced = parsePublishAt("2026-11-01 09:00")!;
		expect([spaced.getDate(), spaced.getHours()]).toEqual([1, 9]);
		const dateOnly = parsePublishAt("2026-11-01")!;
		expect([dateOnly.getDate(), dateOnly.getHours()]).toEqual([1, 0]);
		const quoted = parsePublishAt('"2026-11-01"')!;
		expect([quoted.getFullYear(), quoted.getMonth() + 1, quoted.getDate()]).toEqual([2026, 11, 1]);
	});

	it("boş/bozuk değerde null", () => {
		expect(parsePublishAt(undefined)).toBeNull();
		expect(parsePublishAt("")).toBeNull();
		expect(parsePublishAt("yakında")).toBeNull();
	});
});

describe("isDue", () => {
	it("zamanı geçmiş ve hazır değilse yürütülür", () => {
		expect(isDue({ publishAt: "2026-10-15T11:00", status: "draft" }, now)).toBe(true);
		expect(isDue({ publishAt: "2026-10-01", status: "review" }, now)).toBe(true);
		expect(isDue({ publishAt: "2026-10-15T11:00" }, now)).toBe(true);
	});

	it("gelecek zaman yürütülmez", () => {
		expect(isDue({ publishAt: "2026-10-16T09:00", status: "draft" }, now)).toBe(false);
		expect(isDue({ publishAt: "2026-11-01" }, now)).toBe(false);
	});

	it("zaten hazır olan yürütülmez (idempotent)", () => {
		expect(isDue({ publishAt: "2026-10-01", status: "ready" }, now)).toBe(false);
		expect(isDue({ publishAt: "2026-10-01", status: "READY" }, now)).toBe(false);
	});

	it("publishAt yoksa yürütülmez", () => {
		expect(isDue({ status: "draft" }, now)).toBe(false);
	});
});

describe("pickDueDocs / publishMessage", () => {
	it("yalnız zamanı gelenleri seçer, sırayı korur", () => {
		const docs = pickDueDocs(
			[
				{ path: "a.mdx", fm: { publishAt: "2026-10-15T11:00" } },
				{ path: "b.mdx", fm: { publishAt: "2026-12-01" } },
				{ path: "c.mdx", fm: { publishAt: "2026-10-14", status: "ready" } },
				{ path: "d.mdx", fm: { publishAt: "2026-10-15T00:00" } },
			],
			now,
		);
		expect(docs.map((d) => d.path)).toEqual(["a.mdx", "d.mdx"]);
		expect(docs[0]!.nextStatus).toBe("ready");
	});

	it("mesaj yürütücüyü belli eder", () => {
		expect(publishMessage("merhaba-dunya")).toBe(
			"cms: merhaba-dunya zamanı geldi — yayına hazır (via WuppyCMS)",
		);
	});
});
