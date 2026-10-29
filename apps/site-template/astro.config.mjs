// @ts-nocheck — Astro font `variants` tuple tipi .mjs dosyasında TS assertion kabul etmiyor.
import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";

// WuppyCMS site şablonu — tasarım referansı karakas/cantaproje.
// Tipografi: Space Grotesk (latin + latin-ext değişken font).
const fonts = [
	{
		provider: fontProviders.local(),
		name: "Space Grotesk",
		cssVariable: "--font-sans",
		options: {
			variants: [
				{
					src: ["./public/font/space-grotesk-latin-variable.woff2"],
					weight: "300 700",
					unicodeRange: [
						"U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
					],
				},
				{
					src: ["./public/font/space-grotesk-latin-ext-variable.woff2"],
					weight: "300 700",
					unicodeRange: [
						"U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
					],
				},
			],
		},
	},
];

const previewMode = process.env.WUPPYCMS_PREVIEW === "1";

export default defineConfig({
	devToolbar: { enabled: false },
	build: { inlineStylesheets: "always" },
	fonts,
	integrations: [
		mdx(),
		icon({
			include: {
				lucide: ["mail", "map-pin", "clock-3", "arrow-right", "check"],
				"simple-icons": ["github", "x", "linkedin", "whatsapp"],
			},
		}),
	],
	vite: {
		// Yerel ajan önizlemesi: HMR kapalı; widget main'i yumuşak yeniler.
		// Normal geliştirmede HMR açık kalır.
		...(previewMode ? { server: { hmr: false } } : {}),
		resolve: {
			alias: {
				"@": decodeURIComponent(new URL("./src", import.meta.url).pathname),
			},
		},
		plugins: [tailwindcss()],
	},
});
