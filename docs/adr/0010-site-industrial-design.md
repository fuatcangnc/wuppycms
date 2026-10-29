# 0010 — Site şablonu: endüstriyel tasarım (cantaproje portu)

Durum: Kabul edildi (2026-10-28)

## Bağlam

`apps/site-template` müşteri sitelerinin başlangıç iskeletiydi; tasarımı koyu
zeminli, mavi vurgulu ve jenerik bir blog görünümündeydi. Müşteri/ürün sahibi
boilerplate tasarımının yetersiz olduğunu belirterek
`karakas/cantaproje/cantaproje-astro` projesindeki Astro + Tailwind 4 +
Bejamas tasarımının birebir uyarlanmasını istedi.

Referansın karakteri: açık/beyaz zemin, `#dd641e` turuncu, Space Grotesk,
keskin (0) köşe, dot-matrix ve skew'li endüstriyel etiketler; Bejamas
NavigationMenu, Accordion, Tabs ve Carousel primitifleri.

## Karar

1. Site şablonunun görsel sistemi referanstan uyarlanır:
   - `#dd641e` primary, `#b84d12` hover, `#111` koyu, `#fff` zemin,
     `#e5e5e5` çizgi.
   - Space Grotesk Variable (latin + latin-ext) yerel font olarak.
   - Global radius **0**; yalnız carousel kartı `19px`, pill/trust çipleri
     `rounded-full` / `rounded-xl`.
   - Bölümler `py-20 lg:py-28`, kabuk `.shell`; dot-matrix ve skew'li
     etiketler ortak görsel dil.
2. Bejamas UI primitifleri `src/ui/` altına alınır; `components.json`,
   `@` alias ve `@data-slot/navigation-menu` eklenir. Yeni primitifler
   `npx bejamas add` ile kurulur.
3. Site yüzeyi adminden ayrı bir token kaynağı kullanır:
   `apps/site-template/src/styles/global.css`. Admin Kumo mavisi/Inter
   temasında kalır; iki tema karıştırılmaz.
4. Ajan, `load_agent_instructions` ile `DESIGN_SYSTEM.md`i okur ve site
   şablonunda eski koyu Kumo temasını geri getirmez; yeni UI değişiklikleri
   endüstriyel sistemin token ve sınıflarını kullanır.
5. Demo reposu (`wuppycms-demo-site`) aynı tasarımla güncellenir; yeni siteler
   `apps/site-template`ten tohumlanır.

## Sonuçlar

- Site şablonu 5 sayfa üretir: landing, blog indeksi, 3 makale (içerik sayısına
  göre). `astro check` 0 hata; build başarılı.
- Yeni bağımlılıklar: `bejamas`, `tw-animate-css`, `@data-slot/navigation-menu`,
  `@lucide/astro`, `astro-icon`, `@iconify-json/lucide`,
  `@iconify-json/simple-icons`, `class-variance-authority`, `clsx`,
  `tailwind-merge`.
- Demo reposu `a5dd247`–`0b6a37a` commit'leriyle
  yeni tasarıma geçti; preview `:4324` bu tasarımı gösterir.
- Eski koyu site teması tarihseldir; geri dönmek istenirse yeni bir ADR
  gerekir.
- Admin ve site artık iki ayrı tasarım karakteri taşır; ortak nokta
  Tailwind 4 + Bejamas UI + token disiplinidir.
