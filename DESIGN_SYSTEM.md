# WuppyCMS — Design System

WuppyCMS'in tasarım sözleşmesi iki yüzeyden oluşur. **Token'ların tek kaynağı
her uygulamanın `src/styles/global.css` dosyasıdır**; bu belge onların nasıl
kullanılacağını tanımlar, değerleri kopyalamaz.

| Yüzey | Karakter | Token kaynağı | Detay |
| --- | --- | --- | --- |
| Admin / builder | Kumo mavisi, Inter, yumuşak radius, dark-capable | `apps/builder/src/styles/global.css` | [`docs/design-system.md`](docs/design-system.md) |
| Müşteri sitesi | Endüstriyel, açık zemin, `#dd641e` turuncu, Space Grotesk, keskin köşe | `apps/site-template/src/styles/global.css` | [`apps/site-template/DESIGN_SYSTEM.md`](apps/site-template/DESIGN_SYSTEM.md) |

Site şablonunun tasarım referansı `karakas/cantaproje` projesidir; header,
footer, hero, iki sütunlu paneller, süreç bandı, blog kartları ve Bejamas
navigasyon/accordion/tabs/carousel bileşenleri bu referanstan uyarlanmıştır.

## Değişmez kurallar

1. **Tailwind 4.** Stil utility'lerle yazılır. Custom CSS yalnız `@theme` token
   tanımları, `@layer base` temel kuralları ve belgelenmiş bileşen desenleri
   için kullanılır.
2. **Token'lar tek kaynaktır.** Renk, tipografi, radius ve spacing
   `global.css`teki `:root` / `@theme` bloğundan gelir. Bileşene gömülü hex,
   `style=""` veya sistem dışı palet yazılmaz.
3. **Bejamas UI.** Buton, navigasyon, accordion, tab, carousel, input ve dialog
   gibi primitifler [Bejamas UI](https://ui.bejamas.com/components)
   registry'sinden kurulur (`npx bejamas add <ad>`); elle yazılmaz, başka
   kütüphaneden kopyalanmaz. Kurulu primitif tekrar kurulmaz.
4. **İki karakter, tek marka.** Admin yoğun ve mavidir; site açık, turuncu ve
   endüstriyeldir. İki yüzeyin token'ları karıştırılmaz; siteye admin'in koyu
   Kumo teması, admin'e sitenin endüstriyel turuncusu uygulanmaz.
5. **Erişilebilirlik.** Görünür odak, `aria-label`, anlam taşıyan kontrast;
   renk tek başına bilgi taşımaz. `prefers-reduced-motion` desteklenir.

## Admin çekirdeği

- **Marka rengi:** Kumo mavisi — light `oklch(0.5772 0.2324 260)`,
  dark `oklch(0.5195 0.2324 260)`.
- **Radius:** 6 / 8 / 10 / 14 / 18 px (`sm` → `2xl`).
- **Tipografi:** Inter Variable (sans), JetBrains Mono (kod).
- **Buton primary:** token'lardan türeyen degrade + ring + üst parlama
  (`--button-primary-*`).
- Detay: [`docs/design-system.md`](docs/design-system.md).

## Site çekirdeği

- **Marka rengi:** `#dd641e` turuncu; hover `#b84d12`; koyu `#111`.
- **Radius:** 0 (keskin). İstisnalar: carousel kartı `19px`, pill/trust çipleri
  `rounded-full` / `rounded-xl`.
- **Tipografi:** Space Grotesk Variable 300–700; display uppercase ve negatif
  tracking.
- **Spacing:** Tailwind 4px ölçeği; bölümler `py-20 lg:py-28`, kabuk `.shell`.
- **Görsel dil:** dot matrix, skew'li etiketler, numaralı kareler, monospace
  teknik etiketler, turuncu ince çizgiler.
- Detay: [`apps/site-template/DESIGN_SYSTEM.md`](apps/site-template/DESIGN_SYSTEM.md).

Yeni bir tasarım kararı iki `global.css`ten birini değiştiriyorsa önce
`docs/adr/` altına kayıt yazılır; bileşen sınıfları token'lardan türetilir.
