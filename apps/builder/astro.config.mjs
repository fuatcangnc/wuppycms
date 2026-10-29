// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from '@tailwindcss/vite';
import react from "@astrojs/react";

import cloudflare from '@astrojs/cloudflare';

// bejamas:astro-fonts:start
/** @type {NonNullable<import("astro").AstroUserConfig["fonts"]>} */
const BEJAMAS_ASTRO_FONTS = [
  {
    provider: fontProviders.google(),
    name: "Inter",
    cssVariable: "--font-sans",
    subsets: ["latin"],
  },
];
// bejamas:astro-fonts:end

// https://astro.build/config
export default defineConfig({
  fonts: BEJAMAS_ASTRO_FONTS,
	integrations: [react()],
	// Hono API'si worker girişinde (src/worker.ts) yaşadığı için build çıktısı
	// "server" olmalı; tamamen statik çıktıda adapter worker'ı paketlemez.
	// Statik kalması gereken sayfalar `export const prerender = true` işaretlenir.
	output: 'server',
	adapter: cloudflare(),
	vite: {
		plugins: [tailwindcss()]
	}
});
