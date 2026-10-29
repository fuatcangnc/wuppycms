// Taslak sekmeleri testleri — saf ad üretimi (IndexedDB kısmı tarayıcıda).

import { describe, expect, it } from "vitest";
import { newDraftId, nextDraftName } from "./draft-tabs";

describe("nextDraftName", () => {
	it("boş listede 1'den başlar", () => {
		expect(nextDraftName([])).toBe("Taslak 1");
	});

	it("çakışan adları atlar", () => {
		expect(nextDraftName(["Taslak 1", "Taslak 2"])).toBe("Taslak 3");
		expect(nextDraftName(["Taslak 1", "Taslak 3"])).toBe("Taslak 2");
	});

	it("özel önek ile çalışır (en)", () => {
		expect(nextDraftName(["Draft 1"], "Draft")).toBe("Draft 2");
	});
});

describe("newDraftId", () => {
	it("benzersiz kimlik üretir", () => {
		const ids = new Set(Array.from({ length: 50 }, () => newDraftId()));
		expect(ids.size).toBe(50);
	});
});
