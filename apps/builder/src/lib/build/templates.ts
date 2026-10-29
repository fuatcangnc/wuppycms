// "With AI" site şablonları — her biri GitHub'da public bir template repo.
//
// İlk sıradaki şablon varsayılandır. `preview` yolu builder'ın public
// dizininden servis edilir; seçim ekranı bu görseli gösterir.

import type { AppEnv } from "../../api/types";

export type SiteTemplate = {
	id: string;
	name: string;
	description: string;
	repo: string;
	preview: string;
	/** Tasarım tokenlarının (renk) yazılacağı stil dosyası. */
	stylesPath: string;
	/** Şablonun öne çıkan özellikleri (kart üzerinde kısa etiketler). */
	tags: string[];
};

export function listSiteTemplates(env: AppEnv): SiteTemplate[] {
	return [
		{
			id: "karakas",
			name: "Karakas",
			description:
				"Mühendislik ve araç projeleri için güçlü, kurumsal tasarım. Hizmet kartları, süreç şeması, blog ve teklif formu hazır.",
			repo: env.SITE_TEMPLATE_KARAKAS_REPO || "fuatcangnc/wuppycms-karakas-starter",
			preview: "/templates/karakas.webp",
			stylesPath: "src/styles/globals.css",
			tags: ["Kurumsal", "Hizmetler", "Blog", "Teklif formu"],
		},
		{
			id: "starter",
			name: "WuppyCMS Starter",
			description:
				"Sade, endüstriyel ve içerik odaklı başlangıç. Hızlı kurulum için temel sayfalar ve koleksiyonlar.",
			repo: env.SITE_TEMPLATE_REPO || "fuatcangnc/wuppycms-tailwind-starter",
			preview: "/templates/starter.webp",
			stylesPath: "src/styles/global.css",
			tags: ["Minimal", "İçerik", "Hızlı"],
		},
	];
}

/** Bilinmeyen/boş kimlikte ilk şablon (Karakas) kullanılır. */
export function resolveSiteTemplate(env: AppEnv, id?: string): SiteTemplate {
	const templates = listSiteTemplates(env);
	return templates.find((entry) => entry.id === id) ?? templates[0]!;
}
