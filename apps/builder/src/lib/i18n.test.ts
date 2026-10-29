// i18n çekirdeği testleri — açılış dili en, kaynak dil tr, düşme zinciri.

import { afterEach, describe, expect, it } from "vitest";
import {
	$localeOverride,
	AVAILABLE_LOCALES,
	DEFAULT_LOCALE,
	flattenKeys,
	interpolate,
	localeCatalog,
	SOURCE_LOCALE,
	t,
} from "./i18n";

afterEach(() => $localeOverride.set(null));

describe("katalog yükleme", () => {
	it("tr ve en derlemeye girer; varsayılan ilk sırada", () => {
		expect(AVAILABLE_LOCALES[0]).toBe(DEFAULT_LOCALE);
		expect(AVAILABLE_LOCALES).toContain(SOURCE_LOCALE);
	});

	it("tr.yaml beklenen anahtarları taşır", () => {
		const keys = flattenKeys(localeCatalog("tr"));
		expect(keys).toContain("sidebar.media");
		expect(keys).toContain("review.approve");
		expect(keys).toContain("status.ready");
	});
});

describe("t()", () => {
	it("açılış dilinde (varsayılan en) çeviriyi döndürür", () => {
		expect(t("sidebar.media")).toBe("Media");
		expect(t("status.draft")).toBe("Draft");
	});

	it("seçili dilde çeviriyi döndürür", () => {
		$localeOverride.set("en");
		expect(t("sidebar.media")).toBe("Media");
		expect(t("status.draft")).toBe("Draft");
	});

	it("eksik anahtar kaynak dile düşer, o da yoksa anahtarı döndürür", () => {
		$localeOverride.set("en");
		expect(t("sidebar.trash")).toBe("Trash");
		// en.yaml'da olmayan bir anahtar tr'den gelir:
		const fakeKey = "sidebar.media";
		expect(t(fakeKey)).toBe("Media");
		expect(t("yok.böyle.anahtar")).toBe("yok.böyle.anahtar");
	});
});

describe("interpolate", () => {
	it("yer tutucuları doldurur, eksikleri olduğu gibi bırakır", () => {
		expect(interpolate("Merhaba {name}!", { name: "Fuat" })).toBe("Merhaba Fuat!");
		expect(interpolate("{a} + {b}", { a: 1 })).toBe("1 + {b}");
		expect(interpolate("düz metin")).toBe("düz metin");
	});
});

describe("flattenKeys", () => {
	it("iç içe ağacı nokta yollarına çevirir", () => {
		expect(flattenKeys({ a: { b: "x", c: "y" }, d: "z" })).toEqual(["a.b", "a.c", "d"]);
	});
});
