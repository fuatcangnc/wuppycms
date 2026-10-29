// Embed desteği (parity) — yapıştırılan bağlantıyı sağlayıcıya göre gömme
// HTML'ine çevirir. Saf fonksiyonlar; editör araç çubuğu "Embed" diyaloğu
// kullanır. Desteklenenler: YouTube, Vimeo, X, Instagram, TikTok, Spotify,
// SoundCloud, CodePen, CodeSandbox, GitHub Gist, Figma, Google Maps.

export type EmbedProvider =
	| "youtube"
	| "vimeo"
	| "x"
	| "instagram"
	| "tiktok"
	| "spotify"
	| "soundcloud"
	| "codepen"
	| "codesandbox"
	| "gist"
	| "figma"
	| "maps";

export type Embed = { provider: EmbedProvider; label: string; html: string };

/** iframe tabanlı gömme — ortak görünüm (16:9, tam genişlik). */
function iframe(src: string, title: string, extra = ""): string {
	return `<iframe src="${src}" title="${title}" loading="lazy" allowfullscreen style="width: 100%; aspect-ratio: 16 / 9; border: 0"${extra} />`;
}

/**
 * Bağlantıyı tanır ve gömme HTML'i üretir; tanınmazsa null.
 * Girdi: tam URL ya da çıplak video kimliği olabilir (YouTube için).
 */
export function detectEmbed(raw: string): Embed | null {
	const input = raw.trim();
	if (!input) return null;
	const url = /^https?:\/\//i.test(input) ? input : `https://${input}`;
	let host = "";
	let path = "";
	let params = new URLSearchParams();
	try {
		const parsed = new URL(url);
		host = parsed.hostname.replace(/^www\./, "").toLowerCase();
		path = parsed.pathname;
		params = parsed.searchParams;
	} catch {
		return null;
	}

	if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
		const id =
			host === "youtu.be"
				? path.slice(1)
				: (params.get("v") ?? path.split("/").filter(Boolean).pop() ?? "");
		if (!/^[\w-]{6,}$/.test(id)) return null;
		return {
			provider: "youtube",
			label: "YouTube",
			html: iframe(`https://www.youtube.com/embed/${id}`, "YouTube video", ' allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"'),
		};
	}

	if (host.endsWith("vimeo.com")) {
		const id = path.split("/").filter(Boolean).pop() ?? "";
		if (!/^\d+$/.test(id)) return null;
		return { provider: "vimeo", label: "Vimeo", html: iframe(`https://player.vimeo.com/video/${id}`, "Vimeo video") };
	}

	if (host === "x.com" || host.endsWith("twitter.com")) {
		const id = path.split("/").filter(Boolean).pop() ?? "";
		if (!/^\d+$/.test(id)) return null;
		return {
			provider: "x",
			label: "X (Twitter)",
			html: `<blockquote class="twitter-tweet"><a href="https://twitter.com/i/status/${id}"></a></blockquote>\n<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>`,
		};
	}

	if (host.endsWith("instagram.com")) {
		const parts = path.split("/").filter(Boolean);
		const kind = parts[0] ?? "";
		const code = parts[1] ?? "";
		if (!["p", "reel", "tv"].includes(kind) || !code) return null;
		return {
			provider: "instagram",
			label: "Instagram",
			html: `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/${kind}/${code}/"></blockquote>\n<script async src="https://www.instagram.com/embed.js"></script>`,
		};
	}

	if (host.endsWith("tiktok.com")) {
		const id = path.split("/").filter(Boolean).pop() ?? "";
		if (!/^\d+$/.test(id)) return null;
		return {
			provider: "tiktok",
			label: "TikTok",
			html: `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${id}"></blockquote>\n<script async src="https://www.tiktok.com/embed.js"></script>`,
		};
	}

	if (host.endsWith("spotify.com")) {
		const type = path.split("/").filter(Boolean)[0] ?? "";
		const id = path.split("/").filter(Boolean)[1] ?? "";
		if (!["track", "album", "playlist", "episode", "show"].includes(type) || !id) return null;
		return {
			provider: "spotify",
			label: "Spotify",
			html: iframe(`https://open.spotify.com/embed/${type}/${id}`, "Spotify", ' allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"'),
		};
	}

	if (host.endsWith("soundcloud.com")) {
		return {
			provider: "soundcloud",
			label: "SoundCloud",
			html: iframe(
				`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&show_comments=false`,
				"SoundCloud",
				' style="width: 100%; height: 166px; border: 0;"',
			),
		};
	}

	if (host === "codepen.io") {
		const parts = path.split("/").filter(Boolean);
		const pen = parts.at(-1) ?? "";
		const user = parts.at(-3) ?? "";
		if (!user || !pen) return null;
		return {
			provider: "codepen",
			label: "CodePen",
			html: iframe(`https://codepen.io/${user}/embed/${pen}?default-tab=result`, "CodePen", ' style="width: 100%; height: 420px; border: 0;"'),
		};
	}

	if (host === "codesandbox.io") {
		const id = path.replace(/^\/s\//, "").split("/")[0] ?? "";
		if (!id) return null;
		return { provider: "codesandbox", label: "CodeSandbox", html: iframe(`https://codesandbox.io/embed/${id}`, "CodeSandbox", ' style="width: 100%; height: 500px; border: 0;"') };
	}

	if (host === "gist.github.com") {
		const parts = path.split("/").filter(Boolean);
		const id = parts[1] ?? "";
		if (!id) return null;
		const user = parts[0] ?? "";
		return {
			provider: "gist",
			label: "GitHub Gist",
			html: `<script src="https://gist.github.com/${user}/${id}.js"></script>`,
		};
	}

	if (host.endsWith("figma.com")) {
		const kind = path.startsWith("/file/") ? "embed" : path.startsWith("/proto/") ? "proto" : "";
		const id = path.split("/").filter(Boolean)[1] ?? "";
		if (!kind || !id) return null;
		return { provider: "figma", label: "Figma", html: iframe(`https://www.figma.com/${kind}/${id}`, "Figma", ' style="width: 100%; height: 480px; border: 0;"') };
	}

	if (host.endsWith("google.com") || host.endsWith("google.com.tr")) {
		if (!path.startsWith("/maps")) return null;
		return { provider: "maps", label: "Google Maps", html: iframe(url, "Google Maps", ' style="width: 100%; height: 360px; border: 0;"') };
	}

	return null;
}

/** Tanınan sağlayıcı listesi (diyalog ipuçları için). */
export const EMBED_PROVIDERS = [
	"YouTube",
	"Vimeo",
	"X (Twitter)",
	"Instagram",
	"TikTok",
	"Spotify",
	"SoundCloud",
	"CodePen",
	"CodeSandbox",
	"GitHub Gist",
	"Figma",
	"Google Maps",
] as const;
