// sites.jsonc şema doğrulaması testleri — OSS self-host için net hatalar.

import { describe, expect, it } from "vitest";
import { validateSitesFile } from "@wuppycms/shared";

const validEntry = {
	key: "root",
	name: "demo",
	url: "https://demo.example",
	media: "public",
	mediaLink: "relative",
	publishing: "immediate",
};

describe("validateSitesFile", () => {
	it("geçerli dosyayı aynen kabul eder", () => {
		const result = validateSitesFile({ version: 1, sites: [validEntry] });
		expect(result.ok).toBe(true);
		expect(result.issues).toEqual([]);
		expect(result.file.sites[0]?.key).toBe("root");
	});

	it("kök nesne değilse tek net hata", () => {
		const result = validateSitesFile("bozuk");
		expect(result.ok).toBe(false);
		expect(result.file.sites).toEqual([]);
		expect(result.issues[0]?.message).toContain("Kök bir nesne");
	});

	it("key/name zorunlu; geçersiz girdi korunmaz, diğerleri korunur", () => {
		const result = validateSitesFile({
			version: 1,
			sites: [{ name: "eksik-key" }, validEntry],
		});
		expect(result.ok).toBe(false);
		expect(result.issues.some((issue) => issue.path === "sites[0].key")).toBe(true);
		expect(result.file.sites).toHaveLength(1);
		expect(result.file.sites[0]?.key).toBe("root");
	});

	it("tekrarlayan anahtarı yakalar", () => {
		const result = validateSitesFile({ version: 1, sites: [validEntry, { ...validEntry }] });
		expect(result.ok).toBe(false);
		expect(result.issues.some((issue) => issue.message.includes("tekrar ediyor"))).toBe(true);
	});

	it("enum ve tip hatalarını alan adıyla raporlar", () => {
		const result = validateSitesFile({
			version: 1,
			sites: [{ ...validEntry, mediaLink: "bilinmeyen", publishing: "hemen", mediaR2: { prefix: 5 } }],
		});
		const paths = result.issues.map((issue) => issue.path);
		expect(paths).toContain("sites[0].mediaLink");
		expect(paths).toContain("sites[0].publishing");
		expect(paths).toContain("sites[0].mediaR2.prefix");
	});

	it("bilinmeyen alanları İLERİ UYUMLULUK için hata saymaz", () => {
		const result = validateSitesFile({ version: 1, sites: [{ ...validEntry, gelecekAlan: true }] });
		expect(result.ok).toBe(true);
	});

	it("media-uri dahil dört bağ biçimini kabul eder", () => {
		for (const mediaLink of ["relative", "full", "folder", "media-uri"]) {
			expect(validateSitesFile({ version: 1, sites: [{ ...validEntry, mediaLink }] }).ok).toBe(true);
		}
	});

	it("version farklıysa uyarır ama girdileri korur", () => {
		const result = validateSitesFile({ version: 2, sites: [validEntry] });
		expect(result.ok).toBe(false);
		expect(result.file.sites).toHaveLength(1);
	});
});
