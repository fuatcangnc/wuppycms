import { describe, expect, it } from "vitest";
import { formatSize, hostOf, timeAgo } from "./format";

describe("formatSize", () => {
	it("boş/0 değerde boş metin döner", () => {
		expect(formatSize()).toBe("");
		expect(formatSize(0)).toBe("");
	});

	it("bayt / KB / MB kademeleri", () => {
		expect(formatSize(512)).toBe("512 B");
		expect(formatSize(1536)).toBe("2 KB");
		expect(formatSize(3 * 1024 * 1024)).toBe("3.0 MB");
	});
});

describe("timeAgo", () => {
	const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

	it("bir dakikadan yenisi → az önce", () => {
		expect(timeAgo(ago(30_000))).toBe("az önce");
	});
	it("dakika / saat / gün kademeleri", () => {
		expect(timeAgo(ago(5 * 60_000))).toBe("5 dk önce");
		expect(timeAgo(ago(2 * 3_600_000))).toBe("2 sa önce");
		expect(timeAgo(ago(3 * 86_400_000))).toBe("3 gün önce");
	});
	it("30 günden eskide yerel tarih gösterilir", () => {
		const iso = ago(60 * 86_400_000);
		expect(timeAgo(iso)).toBe(new Date(iso).toLocaleDateString("tr-TR"));
	});
});

describe("hostOf", () => {
	it("şemayı ve yolu atar", () => {
		expect(hostOf("https://ornek.com/a/b")).toBe("ornek.com");
		expect(hostOf("http://ornek.com")).toBe("ornek.com");
		expect(hostOf(" ornek.com/y ")).toBe("ornek.com");
	});
});
