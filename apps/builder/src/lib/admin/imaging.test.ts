import { describe, expect, it } from "vitest";
import { cleanFileName, contentTypeOf, mediaLink } from "./imaging";
import { cleanFolderName } from "./media-write";

describe("cleanFileName", () => {
	it("GitCMS kuralı: küçük harf, aksan indirgeme, tire", () => {
		expect(cleanFileName("My Image (1).png")).toBe("my-image-1.png");
		expect(cleanFileName("Türkçe Başlık photos.JPG")).toBe("turkce-baslik-photos.jpg");
	});
	it("boş ad dosya, boş gövde 'dosya' olur", () => {
		expect(cleanFileName("")).toBe("dosya");
		expect(cleanFileName("!!!.pdf")).toBe("dosya.pdf");
	});
	it("gizli dosyada nokta uzantı sayılmaz", () => {
		expect(cleanFileName(".gitkeep")).toBe("gitkeep");
	});
});

describe("cleanFolderName", () => {
	it("klasör adında uzantı hevesi silinir, sonda nokta kalmaz", () => {
		expect(cleanFolderName("Yeni Klasör")).toBe("yeni-klasor");
		expect(cleanFolderName("resimler.")).toBe("resimler");
	});
});

describe("mediaLink", () => {
	it("full: site adresiyle tam bağ, sonda tire yok", () => {
		expect(mediaLink("full", "public/blog/kapak.webp", "public", "https://site.com/")).toBe(
			"https://site.com/blog/kapak.webp",
		);
	});
	it("folder: köke göre göreli; tanımsız: kökten mutlak", () => {
		expect(mediaLink("folder", "public/a.webp", "public")).toBe("a.webp");
		expect(mediaLink(undefined, "public/a.webp", "public")).toBe("/a.webp");
		expect(mediaLink(undefined, "assets/a.png", "public")).toBe("/assets/a.png");
	});
});

describe("contentTypeOf", () => {
	it("uzantıyı tanım olarak çözer", () => {
		expect(contentTypeOf("a.png")).toBe("image/png");
		expect(contentTypeOf("foto.WEBP")).toBe("image/webp");
	});
});
