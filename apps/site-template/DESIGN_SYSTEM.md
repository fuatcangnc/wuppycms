# WuppyCMS Site — Design System

Bu dosya **müşteri sitesinin** tasarım sözleşmesidir. Tek doğruluk kaynağı
`src/styles/global.css` içindeki `:root` / `@theme` token'larıdır. Bu belge
değerleri tekrar tanımlamaz; onları **kullanma biçimini** anlatır.

Tasarım referansı: `karakas/cantaproje` (Astro + Tailwind 4 + Bejamas UI).
Endüstriyel, açık zeminli, turuncu vurgulu ve keskin köşeli bir sistem.

> **Kural:** Renk için ham hex, `style=""` veya sistem dışı palet kullanılmaz.
> Yapısal yüzeyler için belgelenmiş `neutral-*` ölçeği kullanılır; vurgu her
> zaman `primary` token'ıdır. Etkileşimli primitifler (NavigationMenu,
> Accordion, Tabs, Carousel, Button) **Bejamas UI**'dan gelir; elle yazılmaz.

---

## 1. Token kaynağı

```
src/styles/global.css   ← :root + @theme (tek kaynak)
```

Token değişikliği yalnız burada yapılır. Yeni bir renk gerekiyorsa önce token
eklenir, sonra utility kullanılır. `@theme` dışında custom CSS yalnız
`@layer base` temel kuralları ve belgelenmiş bileşen stilleri için yazılır.

---

## 2. Renkler

| Token | Değer | Kullanım |
| --- | --- | --- |
| `--background` | `#ffffff` | Sayfa zemini |
| `--foreground` / `--ink` | `#111111` | Ana metin, başlık |
| `--muted` | `#404040` | İkincil metin |
| `--line` | `#e5e5e5` | Kenar, ayraç |
| `--primary` | `#dd641e` | Marka turuncusu; CTA, link, vurgu |
| `--primary-dark` | `#b84d12` | Primary hover |
| `--navy` | `#111111` | Koyu bant, footer |
| `--navy-soft` | `#181818` | Koyu yüzey |
| Emerald | `emerald-600` | Yalnız "Git ile sakla" ikinci sütunu |

Yapısal yüzeyler: beyaz + `neutral-50/100/200` + `border-neutral-200`.
Koyu bölüm: `#0d0f10` / `#111415` (CSS'te tanımlı desenlerle).

```astro
<section class="border-y border-neutral-200 bg-white py-20 lg:py-28">
  <p class="text-xs font-black uppercase tracking-[0.16em] text-primary">Etiket</p>
  <h2 class="mt-5 text-3xl font-black uppercase tracking-tight text-neutral-950">Başlık</h2>
</section>
```

---

## 3. Tipografi

| Alan | Değer |
| --- | --- |
| Font | Space Grotesk Variable, 300–700 (`font-sans`) |
| Display / başlık | `font-black uppercase tracking-[-0.04em]` |
| Hero | `clamp`/responsive, 34–44px, `leading-[1.1]` |
| Bölüm başlığı | `text-3xl sm:text-4xl lg:text-5xl`, `leading-tight` |
| Gövde | `text-sm sm:text-base leading-relaxed text-neutral-600` |
| Eyebrow | `text-[11px] font-black uppercase tracking-[0.16em]` |
| Teknik etiket | `font-mono text-[9px]/[10px] uppercase tracking-[0.14em]` |
| Buton | `text-[10px]–text-[13px] font-black uppercase tracking-wider` |

Başlıklarda Türkçe karakterler için `uppercase` kullanılır; harf aralığı
negatif (`-0.03em` … `-0.06em`) tutulur. Uzun başlıklarda `text-balance`
tercih edilir.

---

## 4. Radius

Sistem **keskin köşe** üzerine kuruludur:

| Yüzey | Radius |
| --- | --- |
| Genel kart, panel, buton, input | `rounded-none` (0) |
| Carousel kartları | `rounded-[19px]` (referans istisnası) |
| Pill/rozet, hero trust çipleri | `rounded-full` / `rounded-xl` |
| Process çekirdeği | `rounded-full` |

Yeni bir bileşende keyfî `rounded-*` kullanılmaz; yukarıdaki istisnalar dışında
köşeler keskin kalır.

---

## 5. Spacing ve layout

Tailwind'in 4px ölçeği (`gap-2`, `p-4`, `mt-8`…) esastır.

| Alan | Değer |
| --- | --- |
| Sayfa kabuğu | `.shell` → `min(90rem, calc(100% - 2.5rem))` |
| Geniş içerik | `w-[95vw]` (hero) |
| Bölüm dikey boşluğu | `py-20 lg:py-28` |
| Yoğun bölüm | `py-16 md:py-24` |
| Kart içi | `p-5 sm:p-6` / `p-6 sm:p-8` / `p-8 sm:p-10` |
| Kart arası | `gap-5` / `gap-6` |
| Başlık–metin | `mt-3` / `mt-4` / `mt-5` |
| Buton grubu | `flex flex-wrap gap-3` |

Kurallar:

- Her bölümün bir `id`'si ve isteğe bağlı `data-reveal` sarmalayıcısı vardır.
- Bölüm başlığı: ortalanmış `max-w-4xl` + skew'li etiket + `mt-5` başlık.
- Teknik bölümlerde `font-mono` etiketler ve numaralı kareler kullanılır.
- `shell` dışına taşan dekoratif katmanlar `overflow-hidden` ile kırpılır.

---

## 6. Butonlar

İki kullanım biçimi vardır:

1. **CSS sınıfları** (`global.css`): `.button`, `.button--primary`,
   `.button--outline-light`, `.text-link`.
2. **Tailwind CTA** (bölümlerde yaygın):

```astro
<a class="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-7 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-[#b84d12]">
  Demo talep et
</a>
```

| Varyant | Stil |
| --- | --- |
| Primary | `bg-primary text-white`, hover `#b84d12` veya siyah |
| Outline | `border-2 border-black text-black`, hover siyah zemin/beyaz metin |
| Koyu | `bg-neutral-950 text-white`, hover primary |
| İkincil (Git) | `bg-emerald-600`, hover `emerald-700` |
| Link | `text-primary`, hover `text-neutral-950` |

Tüm butonlar en az 44–48px yüksekliğinde, keskin köşeli ve uppercase'dir.
Primary buton rengi **yalnız** `--primary` token'ından gelir.

---

## 7. Bejamas UI

Kurulu primitifler `src/ui/` altındadır:

| Bileşen | Dosya |
| --- | --- |
| NavigationMenu | `src/ui/navigation-menu/*` |
| Accordion | `src/ui/accordion/*` |
| Tabs | `src/ui/tabs/*` |
| Carousel | `src/ui/carousel/*` |
| Button | `src/ui/button/*` |

- Yeni primitif: `npx bejamas add <ad>` → `src/ui/<ad>/`.
- `components.json` alias'ları: `ui → @/ui`, `utils → @/lib/utils`.
- Elle buton/input/dialog yazılmaz; başka kütüphaneden kopyalanmaz.
- Kurulu primitif tekrar kurulmaz; stiller Tailwind utility + token'lardır.

---

## 8. Bileşen desenleri

| Bileşen | Dosya | Not |
| --- | --- | --- |
| Header | `SiteHeader.astro` | Beyaz nav; scroll > 40px'te siyah sticky; topbar gizlenir |
| Footer | `SiteFooter.astro` | CTA + siyah footer + turuncu başlıklar |
| Hero | `pages/index.astro` + `HeroPipeline.astro` | Dot matrix, turuncu vurgu, adım sekmeleri |
| Feature carousel | `FeatureCarousel.astro` | Bejamas Carousel; 6 kart; 19px radius |
| İki sütun | `Pillars.astro` | AI (turuncu) + Git (emerald) panelleri |
| Teknoloji | `SupportedContent.astro` | 8 kart; monospace wordmark |
| Neden biz | `WhyChooseUs.astro` + `EditorMockup.astro` | 3 sütun + count-up istatistik |
| Süreç | `ProcessSection.astro` | Koyu bant, metalik çekirdek, 4 adım |
| Kullanım | `UseCases.astro` | Filtreli numaralı grid |
| Blog | `LatestPosts.astro`, `pages/blog/*` | Keskin kartlar, turuncu hover |
| İletişim | `ContactSection.astro` + `ProjectForm.astro` | `mailto:` tabanlı demo formu |
| SSS | `SiteFaq.astro` | Bejamas Accordion |
| Floating | `FloatingCta.astro` | Sağ altta turuncu demo CTA |

### Header sticky

`#site-header` üzerinde `data-sticky="true"` + `.is-sticky`; nav
`group-data-[sticky=true]/header:*` sınıflarıyla siyaha döner. Logo
`.brand-logo--light` / `.brand-logo--dark` ile değişir. Bu davranışı bozan
yeni bir header stili eklenmez.

---

## 9. Görsel dil

- **Açık zemin:** beyaz + `neutral-50/100`; koyu bantlar `#0d0f10`.
- **Turuncu vurgu:** `#dd641e`; geniş alanlarda değil, çizgi/etiket/CTA'da.
- **Keskin köşe:** kartlar, paneller, butonlar; carousel ve pill istisnaları.
- **Teknik doku:** dot matrix, ince grid çizgileri, monospace etiketler,
  numaralı kareler, skew'li siyah/turuncu etiketler.
- **Hiyerarşi:** küçük uppercase eyebrow → büyük uppercase başlık →
  `neutral-600` gövde → ince `border-neutral-200` ayraç.
- **Hareket:** scroll reveal (`data-reveal`), carousel scroll, sticky header;
  `prefers-reduced-motion` desteklenir.

---

## 10. Erişilebilirlik

- Odak görünür: `focus-visible:ring-*` / `focus-visible:outline-*`.
- İkon-only kontrollerde `aria-label`.
- Renk tek başına anlam taşımaz; metin/ikonla desteklenir.
- Kontrast: `text-neutral-950` / `text-neutral-600`; primary üzerinde beyaz.
- Formlarda `label`, `required`, `autocomplete` ve hata durumu.
- `prefers-reduced-motion` altında animasyonlar kapanır.

---

## 11. Yapılmaması gerekenler

- Eski koyu Kumo temasını (`bg-zinc-950`, mavi primary, yumuşak radius)
  site şablonuna geri getirmek.
- `bg-zinc-*`, `text-slate-*` gibi sistem dışı paletler.
- `style="color: #..."`, bileşen içi keyfî `<style>` (yalnız global.css).
- Bölüm aralıklarını `mt-[73px]` gibi keyfî değerlerle vermek.
- Aynı işi yapan yeni buton/kart/navigasyon primitifi yazmak.
- Carousel/pill istisnaları dışında `rounded-*` kullanmak.
- Header sticky davranışını, `data-wuppycms-*` içerik hedeflerini veya
  `WuppycmsBridge`'i kaldırmak.
