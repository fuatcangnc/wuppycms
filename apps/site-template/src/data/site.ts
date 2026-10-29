export const siteSettings = {
	brandName: "WuppyCMS",
	tagline: "Git tabanlı içerik yönetimi",
	description:
		"Astro sitenizi GitHub deposuna bağlayan, AI ile içerik düzenlemenizi sağlayan ve her değişikliği gerçek bir commit olarak saklayan içerik yönetim sistemi.",
	email: "merhaba@wuppycms.dev",
	location: "İstanbul, Türkiye",
	workHours: "Hafta içi 09:00 – 18:00",
	github: "https://github.com/fuatcangnc/wuppycms-demo-site",
};

export const navItems = [
	{ label: "Ana Sayfa", href: "/" },
	{
		label: "Ürün",
		href: "/#ozellikler",
		children: [
			["AI editör", "/#ozellikler"],
			["Git içerik", "/#ozellikler"],
			["Sayfa ağacı", "/#ozellikler"],
			["Ekip akışı", "/#akis"],
		],
	},
	{
		label: "Kaynaklar",
		href: "/blog",
		children: [
			["Blog", "/blog"],
			["Nasıl çalışır", "/#akis"],
			["Sık sorulanlar", "/#sss"],
		],
	},
	{ label: "Blog", href: "/blog" },
	{ label: "İletişim", href: "/#iletisim" },
];

export interface Feature {
	number: string;
	title: string;
	shortTitle: string;
	summary: string;
	benefits: string[];
	href: string;
	buttonText: string;
	visual: "ai" | "git" | "panel" | "astro" | "team" | "selfhost";
}

export const features: Feature[] = [
	{
		number: "01",
		title: "AI ile düzenle | Doğal dil, diff onayı",
		shortTitle: "AI editör",
		summary:
			"Türkçe doğal dille içerik yazın, bölüm ekleyin, metni yeniden yazın. Her öneri commit öncesi diff olarak gelir.",
		benefits: ["Doğal dil ile düzenleme", "Bölüm bazlı değişiklik", "Diff önizleme"],
		href: "/#ozellikler",
		buttonText: "AI editörü gör",
		visual: "ai",
	},
	{
		number: "02",
		title: "Git içerik | Markdown ve MDX",
		shortTitle: "Git içerik",
		summary:
			"İçerik müşterinin reposunda markdown/MDX olarak yaşar. Her kayıt gerçek bir commit, her commit geri alınabilir.",
		benefits: ["Markdown + MDX", "SHA çakışma kontrolü", "Sürüm geçmişi"],
		href: "/#ozellikler",
		buttonText: "Git akışını gör",
		visual: "git",
	},
	{
		number: "03",
		title: "Tek panel | Sayfa, blog, medya",
		shortTitle: "Tek panel",
		summary:
			"Astro sayfaları, blog yazıları, medya ve commit geçmişi aynı yerde. Sayfa ağacından doğrudan kaynağa gidin.",
		benefits: ["src/pages ağacı", "Medya kütüphanesi", "Commit geçmişi"],
		href: "/#ozellikler",
		buttonText: "Paneli keşfet",
		visual: "panel",
	},
	{
		number: "04",
		title: "Astro + Tailwind 4 | Bejamas UI",
		shortTitle: "Astro altyapısı",
		summary:
			"Tailwind 4 token'ları, Bejamas UI bileşenleri ve statik Astro çıktısı. Cloudflare'da hızlı ve güvenli yayın.",
		benefits: ["Tailwind 4 token'ları", "Bejamas UI", "Cloudflare dağıtımı"],
		href: "/#teknoloji",
		buttonText: "Teknolojiyi gör",
		visual: "astro",
	},
	{
		number: "05",
		title: "Ekip akışı | Davet, rol, onay",
		shortTitle: "Ekip akışı",
		summary:
			"Editör, yazar ve yönetici rolleri; davet akışı; yayın öncesi onay. Kim neyi değiştirdi, her zaman görünür.",
		benefits: ["Rol bazlı erişim", "Onay akışı", "Denetim kaydı"],
		href: "/#akis",
		buttonText: "Akışı incele",
		visual: "team",
	},
	{
		number: "06",
		title: "Self-host | Veri sende kalsın",
		shortTitle: "Self-host",
		summary:
			"Kendi Cloudflare hesabında çalıştır. D1, R2 ve Workers senin kontrolünde; vendor lock-in yok.",
		benefits: ["D1 + R2", "Açık kaynak", "Vendor lock-in yok"],
		href: "/#sss",
		buttonText: "Dağıtım detayı",
		visual: "selfhost",
	},
];

export const pillars = [
	{
		number: "01",
		accent: "primary" as const,
		title: "AI ile düzenle",
		subtitle: "Doğal dil, gerçek diff",
		description:
			"Sayfayı seçin, ne değiştirmek istediğinizi yazın. AI yalnızca ilgili bölümü önerir; değişiklik önizlemesini görmeden commit oluşmaz.",
		bullets: ["Türkçe doğal dil", "Bölüm bazlı üretim", "SHA çakışma kontrolü"],
		href: "/#ozellikler",
		cta: "AI editörü incele",
	},
	{
		number: "02",
		accent: "emerald" as const,
		title: "Git ile sakla",
		subtitle: "Markdown / MDX + commit",
		description:
			"İçerik müşterinin GitHub reposunda kalır. Her kayıt anlamlı bir commit mesajıyla saklanır; geçmiş, diff ve geri alma her zaman elinizin altındadır.",
		bullets: ["Repo sahipliği sende", "Anlamlı commit mesajı", "Kolay geri alma"],
		href: "/blog/wuppycms-nasil-calisir",
		cta: "Git akışını oku",
	},
];

export const supported = [
	{ name: "Astro", note: "Statik çıktı, ada mimarisi", badge: "Çekirdek" },
	{ name: "MDX", note: "Bileşenli içerik", badge: "İçerik" },
	{ name: "Markdown", note: "Sade ve taşınabilir", badge: "İçerik" },
	{ name: "Tailwind 4", note: "Token tabanlı stil", badge: "Tasarım" },
	{ name: "TypeScript", note: "Tip güvenli şablon", badge: "Kod" },
	{ name: "Cloudflare", note: "Workers, D1, R2", badge: "Altyapı" },
	{ name: "Bejamas UI", note: "Erişilebilir primitifler", badge: "Tasarım" },
	{ name: "GitHub", note: "Repo, PR, commit", badge: "Kaynak" },
];

export const whyFeaturesLeft = [
	{
		title: "İÇERİK REPODA, KONTROL SENDE",
		description:
			"Markdown ve MDX dosyaları müşterinin GitHub reposunda kalır. Veritabanı kilidi yok; istediğiniz zaman başka bir araçla devam edebilirsiniz.",
	},
	{
		title: "AI ÖNERİR, SEN ONAYLARSIN",
		description:
			"Her AI değişikliği diff olarak gösterilir. Commit ancak siz onayladığınızda oluşur; yayın akışı her adımda şeffaftır.",
	},
];

export const whyFeaturesRight = [
	{
		title: "ASTRO + TAILWIND 4",
		description:
			"Bejamas UI bileşenleri ve token tabanlı tasarım sistemiyle üretime hazır sayfalar. Tasarım kararları global.css'te tek yerde.",
	},
	{
		title: "GERÇEK COMMIT, GERÇEK GEÇMİŞ",
		description:
			"Kim, ne zaman, neyi değiştirdi? Commit geçmişi, SHA kontrolü ve denetim kaydı her zaman görünür.",
	},
];

export const stats = [
	{ target: 100, suffix: "%", label: "GIT DESTEKLİ", description: "İçerik ve geçmiş repoda." },
	{ target: 0, suffix: "", label: "VENDOR LOCK-IN", description: "Veriniz sizde kalır." },
	{ target: 1, suffix: "", label: "TEK PANEL", description: "Sayfa, blog, medya, ekip." },
	{ target: 24, suffix: "/7", label: "AI EDITÖR", description: "Doğal dille üretim." },
];

export const processSteps = [
	{
		number: "01",
		title: "Repoyu bağla",
		description:
			"GitHub reposunu WuppyCMS'e bağlayın; Astro sayfaları ve içerik koleksiyonları otomatik taranır.",
	},
	{
		number: "02",
		title: "AI ile düzenle",
		description:
			"Sayfayı seçin, doğal dille isteyin. AI yalnızca ilgili bölümü değiştirir; gerisini korur.",
	},
	{
		number: "03",
		title: "Diff'i incele",
		description:
			"Değişiklik önizlemesini, SHA kontrolünü ve etki alanını görün. Gerekirse geri alın.",
	},
	{
		number: "04",
		title: "Commit & yayınla",
		description:
			"Onaylayın; commit oluşur, CI build alır ve site Cloudflare'a yayınlanır.",
	},
];

export const useCases = [
	{
		number: "01",
		title: "Blog",
		side: "İçerik",
		description: "Yazı, kategori, yazar ve zamanlanmış yayın.",
		href: "/blog",
	},
	{
		number: "02",
		title: "Dokümantasyon",
		side: "İçerik",
		description: "MDX sayfaları, sürüm notları ve kod örnekleri.",
		href: "/#ozellikler",
	},
	{
		number: "03",
		title: "Landing page",
		side: "Ürün",
		description: "Kampanya, lansman ve dönüşüm odaklı sayfalar.",
		href: "/#ozellikler",
	},
	{
		number: "04",
		title: "Portföy",
		side: "İçerik",
		description: "Proje vitrini, vaka çalışmaları ve medya.",
		href: "/#ozellikler",
	},
	{
		number: "05",
		title: "Kurumsal site",
		side: "Ürün",
		description: "Çok sayfalı yapı, ekip ve iletişim akışı.",
		href: "/#iletisim",
	},
	{
		number: "06",
		title: "E-ticaret vitrini",
		side: "Ürün",
		description: "Ürün sayfaları, kampanya ve içerik bir arada.",
		href: "/#ozellikler",
	},
];

export const faqs: [string, string][] = [
	[
		"İçerik gerçekten GitHub'da mı kalıyor?",
		"Evet. Sayfalar ve yazılar müşterinin reposunda markdown/MDX olarak saklanır. WuppyCMS bu dosyaları düzenler ve commit eder; içerik hiçbir zaman yalnızca kapalı bir veritabanında yaşamaz.",
	],
	[
		"AI doğrudan yayınlıyor mu?",
		"Hayır. AI yalnızca öneri üretir. Her değişiklik diff olarak gösterilir; commit ve yayın adımı sizin onayınızla gerçekleşir.",
	],
	[
		"Astro dışındaki framework'ler destekleniyor mu?",
		"Şablon Astro için hazırlanmıştır. Markdown/MDX tabanlı statik çıktı üreten diğer framework'ler için aynı içerik modeli uyarlanabilir.",
	],
	[
		"Medya dosyaları nerede saklanıyor?",
		"Cloudflare R2 üzerinde saklanır ve repo dışında tutulur. Görsel optimizasyonu ve önbellekleme Cloudflare tarafında yapılır.",
	],
	[
		"Ekip üyeleri nasıl eklenir?",
		"Yönetici panelinden e-posta daveti gönderilir; rol ve erişim kapsamı davet sırasında belirlenir.",
	],
	[
		"Kendi sunucumda çalıştırabilir miyim?",
		"Evet. WuppyCMS Cloudflare Workers, D1 ve R2 üzerinde çalışır; kendi Cloudflare hesabınıza dağıtabilirsiniz.",
	],
	[
		"Fiyatlandırma nasıl?",
		"Bu şablon bir demo/başlangıç iskeletidir. Üretim fiyatlandırması için bizimle iletişime geçin; ekip ve içerik hacmine göre planlanır.",
	],
	[
		"Mevcut sitemi taşıyabilir miyim?",
		"Mevcut markdown/MDX içeriğinizi repoya taşıyıp şablonun içerik modeline eşleyebiliriz. Tasarım token'ları ve bileşenler yeniden kullanılır.",
	],
];
