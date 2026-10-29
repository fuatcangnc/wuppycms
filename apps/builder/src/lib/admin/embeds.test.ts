// Embed tanıma testleri — 12 sağlayıcı + tanınmayanlar.

import { describe, expect, it } from "vitest";
import { detectEmbed } from "./embeds";

describe("detectEmbed", () => {
	it("YouTube: watch, kısa ve nocookie", () => {
		expect(detectEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.provider).toBe("youtube");
		expect(detectEmbed("https://youtu.be/dQw4w9WgXcQ")?.html).toContain("/embed/dQw4w9WgXcQ");
		expect(detectEmbed("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")?.provider).toBe("youtube");
		expect(detectEmbed("https://youtube.com/shorts/dQw4w9WgXcQ")?.html).toContain("/embed/dQw4w9WgXcQ");
	});

	it("Vimeo", () => {
		expect(detectEmbed("https://vimeo.com/123456789")?.html).toContain("player.vimeo.com/video/123456789");
		expect(detectEmbed("https://vimeo.com/kanal")).toBeNull();
	});

	it("X ve Instagram blok alıntı üretir", () => {
		expect(detectEmbed("https://x.com/wuppycms/status/1234567890")?.html).toContain("twitter-tweet");
		expect(detectEmbed("https://www.instagram.com/p/ABC123/")?.html).toContain("instagram-media");
	});

	it("TikTok, Spotify, SoundCloud", () => {
		expect(detectEmbed("https://www.tiktok.com/@a/video/1234567890")?.html).toContain("tiktok-embed");
		expect(detectEmbed("https://open.spotify.com/track/abc123")?.html).toContain("open.spotify.com/embed/track/abc123");
		expect(detectEmbed("https://soundcloud.com/sanatci/parca")?.html).toContain("w.soundcloud.com/player");
	});

	it("CodePen, CodeSandbox, Gist, Figma, Maps", () => {
		expect(detectEmbed("https://codepen.io/kullanici/pen/abcDEF")?.html).toContain("codepen.io/kullanici/embed/abcDEF");
		expect(detectEmbed("https://codesandbox.io/s/harika-proje")?.html).toContain("codesandbox.io/embed/harika-proje");
		expect(detectEmbed("https://gist.github.com/kullanici/abc123")?.html).toContain("gist.github.com/kullanici/abc123.js");
		expect(detectEmbed("https://www.figma.com/file/abc123/Tasarim")?.html).toContain("figma.com/embed/abc123");
		expect(detectEmbed("https://www.google.com/maps/place/Istanbul")?.html).toContain("google.com/maps");
	});

	it("tanınmayan bağlantı ve boş girdi", () => {
		expect(detectEmbed("https://example.com/yazi")).toBeNull();
		expect(detectEmbed("")).toBeNull();
		expect(detectEmbed("https://youtube.com/watch")).toBeNull();
	});

	it("protokolsüz girdiyi de dener", () => {
		expect(detectEmbed("youtu.be/dQw4w9WgXcQ")?.provider).toBe("youtube");
	});
});
