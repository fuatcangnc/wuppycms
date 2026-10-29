# WuppyCMS Admin — Design System

> Global sözleşme: [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md). Site yüzeyi:
> [`../apps/site-template/DESIGN_SYSTEM.md`](../apps/site-template/DESIGN_SYSTEM.md).

Kaynak: `apps/builder/src/styles/global.css` (token'lar) + Bejamas UI React
portları (`src/components/ui-react/*`). Tek doğruluk kaynağı token'lardır;
bu belgedeki hex değerleri oklch token'larının yaklaşık karşılığıdır.

> **Kural:** Buton, input, dialog, tab gibi her primitif Bejamas UI'dan gelir.
> Elle primitif yazılmaz, başka kütüphaneden kopyalanmaz. Renkler token'lardan
> (`bg-background`, `text-primary`, `border-border`…) kullanılır; bileşene
> gömülü renk/`style`/ayrı `.css` yazılmaz. Tema değişikliği yalnız
> `global.css`teki `@theme`/`:root`/`.dark` bloklarından yapılır.

---

## 1. Renk token'ları

### Marka

| Token | Light | Dark | Kullanım |
| --- | --- | --- | --- |
| `--primary` | `#056dff` | `#005aeb` | Ana eylem, aktif durum, link, seçim |
| `--primary-foreground` | `#f2f8ff` | `#f2f8ff` | Primary üzerindeki metin/ikon |

Kumo mavisi. Light `oklch(0.5772 0.2324 260)`, dark `oklch(0.5195 0.2324 260)`.

### Yüzeyler ve metin

| Token | Light | Dark | Kullanım |
| --- | --- | --- | --- |
| `--background` | `#ffffff` | `#0a0a0a` | Sayfa zemini |
| `--foreground` | `#0a0a0a` | `#fafafa` | Ana metin |
| `--card` / `--popover` | `#ffffff` | `#171717` | Kart, dialog, menü |
| `--card-foreground` | `#0a0a0a` | `#fafafa` | Kart metni |
| `--muted` | `#f5f5f5` | `#262626` | Sessiz zemin, skeleton, kod bloğu |
| `--muted-foreground` | `#737373` | `#a1a1a1` | İkincil metin, açıklama |
| `--accent` | `#f5f5f5` | `#404040` | Hover, aktif menü satırı |
| `--accent-foreground` | `#171717` | `#fafafa` | Accent üzerindeki metin |
| `--secondary` | `#f4f4f5` | `#27272a` | İkincil yüzey |
| `--secondary-foreground` | `#18181b` | `#fafafa` | İkincil metin |

### Durum ve çizgiler

| Token | Light | Dark | Kullanım |
| --- | --- | --- | --- |
| `--destructive` | `#df2225` | `#ea3c3f` | Silme, hata, yıkıcı eylem |
| `--border` | `#e5e5e5` | `white / 10%` | Ayraç, kart kenarı |
| `--input` | `#e5e5e5` | `white / 15%` | Form kenarı |
| `--ring` | `#a1a1a1` | `#737373` | Odak halkası |

### Sidebar

| Token | Light | Dark |
| --- | --- | --- |
| `--sidebar` | `#fafafa` | `#171717` |
| `--sidebar-foreground` | `#0a0a0a` | `#fafafa` |
| `--sidebar-accent` | `#f5f5f5` | `#262626` |
| `--sidebar-border` | `#e5e5e5` | `white / 10%` |
| `--sidebar-primary` | `#056dff` | `#005aeb` |

### Grafikler

`--chart-1…5` mavi tonları: `oklch(0.729 0.132 267.96)` …
`oklch(0.373 0.213 261.56)`.

---

## 2. Tipografi

| Alan | Değer |
| --- | --- |
| Sans | `Inter Variable` (`--font-sans`) |
| Mono | `JetBrains Mono Variable` (`--font-mono`) |
| Heading | `--font-heading` = sans |
| Gövde (admin) | `text-sm` (14px), `leading-relaxed` |
| Küçük etiket | `text-xs` (12px), `text-muted-foreground` |
| Mikro | `text-[10px]` / `text-[11px]` — yalnız rozet/ipucu |
| Başlık | `text-lg font-semibold`, `tracking-tight` |
| Ağırlıklar | `font-medium` (etiket), `font-semibold` (başlık) |

---

## 3. Yarıçap (radius)

`--radius: 0.625rem` (10px).

| Token | Değer |
| --- | --- |
| `rounded-sm` / `--radius-sm` | ~6px |
| `rounded-md` | ~8px |
| `rounded-lg` / `--radius-lg` | 10px |
| `rounded-xl` | 14px |
| `rounded-2xl` | 18px |
| `rounded-3xl` | 22px |
| `rounded-4xl` | 26px |
| `rounded-full` | 9999px (pill, avatar, badge) |

Kullanım: buton/input `rounded-lg`, kart/dialog `rounded-xl`, sayfa kabuğu
`rounded-xl`, çipler/rozetler `rounded-full`.

---

## 4. Button

Kaynak: `src/components/ui-react/button/Button.tsx` (Bejamas portu + Kumo
degrade kararı, ADR 0004).

### Varyantlar

| Varyant | Görünüm | Kullanım |
| --- | --- | --- |
| `default` | Kumo degrade (primary → primary+%15 beyaz), üst iç parlama, koyu ring | Ana eylem: Kaydet, Publish, Gönder |
| `secondary` | Şeffaf zemin + `border-input` kenar | İkincil eylem: Vazgeç, Kapat |
| `outline` | `border-border` + `bg-background` | Nötr eylem, filtre |
| `ghost` | Zemin yok, hover'da `bg-muted` | İkon butonları, araç çubuğu |
| `destructive` | Kırmızı degrade + ring | Sil, kalıcı işlem |
| `link` | `text-primary`, alt çizgi hover | Satır içi bağlantı |

DeGrade token'ları: `--button-primary-grad-top/bottom`,
`--button-primary-grad-top-hover`, `--button-primary-ring`,
`--button-primary-gloss`; kırmızı karşılıkları `--button-danger-*`.

### Boyutlar

| Boyut | Yükseklik | Kullanım |
| --- | --- | --- |
| `sm` | `h-8` (32px) | Yoğun araç çubukları, tablo satırı |
| `default` | `h-9` (36px) | Standart form/eylem |
| `lg` | `h-10` (40px) | Landing, birincil CTA |
| `icon-sm` | 32×32 | Widget/araç çubuğu ikonları |
| `icon` | 36×36 | Standart ikon butonu |
| `icon-lg` | 40×40 | Büyük ikon butonu |

### Örnek

```tsx
<Button>Kaydet</Button>
<Button variant="secondary" size="sm">Vazgeç</Button>
<Button variant="destructive" size="sm">Sil</Button>
<Button variant="ghost" size="icon-sm" aria-label="Yenile"><Icon name="refresh" /></Button>
```

---

## 5. Input / Textarea

### Input (`ui-react/input`)

- Yükseklik: `default` 36px, `sm` 32px, `lg` 40px.
- `rounded-lg`, `border-input`, `bg-transparent` (dark: `bg-input/30`).
- Odak: `focus-visible:border-ring` + `ring-3` (`ring-ring/50`).
- Hata: `aria-invalid` → `border-destructive` + `ring-destructive/20`.
- Placeholder `muted-foreground`; metin `text-sm` (mobilde `text-base`).

```tsx
<Input placeholder="ornek@site.com" aria-label="E-posta" />
<Input size="sm" aria-invalid />
```

### Textarea (`ui-react/textarea`)

- `min-h-16`, `field-sizing-content`, `rounded-md` (port sınıfı), `border-input`.
- Aynı odak/hata halkası; `resize` gerekiyorsa Tailwind ile (`resize-none`,
  `resize-y`) verilir.
- Widget composer'ı `resize-none` + `bg-muted/30` kullanır.

### Form kuralları

- Her alanın görünür `Label`'ı veya `aria-label`'ı olmalı.
- Hata mesajı alanın altında `text-destructive text-sm`.
- İpucu/yardım metni `text-muted-foreground text-xs`.

---

## 6. Badge

Kaynak: `ui-react/badge`.

| Varyant | Görünüm | Kullanım |
| --- | --- | --- |
| `default` | `bg-primary text-primary-foreground` | Aktif/yeni |
| `secondary` | `bg-secondary` | Nötr etiket |
| `destructive` | `bg-destructive/10 text-destructive` | Hata/risk |
| `outline` | Kenarlıklı | Kategori, filtre |

Boyut: `default` h-6, `sm` h-5. Şekil: `rounded-full` (pratikte varsayılan),
`rounded-xs` seçeneği. Örnek: durum rozetleri (Taslak/İnceleme/Hazır),
"bridge ✓", medya etiketleri.

---

## 7. Tabs

Kaynak: `ui-react/tabs`.

| Varyant | Görünüm |
| --- | --- |
| `indicator` | `bg-muted` kapsül + hareketli gösterge (varsayılan) |
| `default` | `bg-muted` kapsül |
| `line` / `line-animated` | Alt çizgi, arka plansız |

Boyut: `default` h-9, `sm` h-8, `lg` h-10. Örnek: Site | Admin, Draft | Live,
frontmatter/meta sekmeleri.

---

## 8. Dialog

Kaynak: `ui-react/dialog`.

- Portal: gövde `body`ye taşınır.
- `role="dialog"`, `aria-modal`, `aria-labelledby`.
- Odak tuzağı + açılışta ilk odaklanabilir öğe + kapanışta geri yükleme.
- Arka plan `inert`; Escape yığın sırasıyla yalnız üst diyaloğu kapatır.
- Dışa tıklama varsayılan kapatır; kaydırma kilitlenir.
- Yüzey: `bg-popover text-popover-foreground border-border rounded-xl shadow-lg`.
- Genişlikler: `sm:max-w-md/lg/xl/2xl`; uzun içerik `max-h-[86vh] overflow-y-auto`.

---

## 9. Diğer primitifler

| Bileşen | Not |
| --- | --- |
| `Table` | `text-sm`; başlık h-10, satır `border-b`, hover `bg-muted/50` |
| `Skeleton` | `bg-muted animate-pulse rounded-md`; `SkeletonRows`/`SkeletonGrid` |
| `Alert` | `rounded-xl border-border bg-card`; `destructive` varyantı |
| `Avatar` | `rounded-full`; fallback `bg-primary/15 text-primary` |
| `Label` | `text-sm font-medium`; form alanıyla `htmlFor` |
| `Spinner` (Astro) | Yükleme göstergesi; buton içinde `size-4` |

---

## 10. İkonlar

- Admin'de `Icon` (`components/admin/parts.tsx`) — 24×24 `viewBox`, inline SVG,
  `stroke="currentColor"`, `strokeWidth={2}`.
- Varsayılan boyut `size-4` (16px); buton içinde `size-3.5`/`size-4`.
- Renk daima `currentColor`; ikona ayrı renk verilmez.
- Mevcut isimler: `globe, plus, file, book, image, folder, chevron-right,
  link, external, trash, check, search, grid, list, x, sparkles, sliders,
  logout, panel, eye, code, arrow-up, stop, clock, cursor, refresh,
  chevron-down, terminal, undo, copy, pencil, message`.
- Yeni ikon gerekiyorsa aynı haritaya Lucide path'i eklenir.

---

## 11. Yerleşim ve boşluk

| Alan | Değer |
| --- | --- |
| Top bar | `h-14` (56px), alt `border-b` |
| Sidebar | `w-64` (256px), sağ `border-r` |
| Ana içerik | `px-4/6`, dikey `py-4/6`, kart arası `gap-4` |
| Form satırı | `gap-1.5` etiket–alan, `gap-3` alanlar arası |
| Araç çubuğu | `h-9/10`, ikonlar arası `gap-1` |
| Widget çekmecesi | 340–760px, varsayılan 460px |
| Canvas | 12–16px boşluk, `rounded-xl` pencere |

Kırılma noktaları Tailwind varsayılanları: `sm 640`, `md 768`, `lg 1024`,
`xl 1280`, `2xl 1536`.

---

## 12. Koyu tema

- `.dark` sınıfı `<html>`e eklenir; `color-scheme: dark`.
- Token'lar `.dark` bloğunda override edilir; bileşen sınıfları değişmez.
- Native kontroller (select popup, scrollbar) `color-scheme` ile temaya uyar.
- Dark'ta `border`/`input` yarı saydam beyazdır (`white / 10%`, `white / 15%`).

---

## 13. Erişilebilirlik ve etkileşim

- Odak görünür olmalı: `focus-visible:ring-3 ring-ring/50` (portlarda hazır).
- İkon-only butonlarda `aria-label` + `title`.
- Dialog: odak tuzağı, Escape, `aria-modal`, başlık referansı.
- Tabs: `role="tablist"`, `aria-selected`, klavye gezinmesi.
- Kontrast: metin `foreground`, ikincil `muted-foreground`; `primary` üzerinde
  `primary-foreground`.
- Tailwind v4 preflight imleci kaldırdığı için `global.css`te
  `button/a/[role=button]/select/summary… { cursor: pointer }` restorasyonu
  vardır; silinmez.

---

## 14. Bileşen envanteri

**React portları (`ui-react/`):** Alert, Avatar, Badge, Button, Dialog, Input,
Label, Skeleton, Table, Tabs, Textarea.

**Astro kaynakları (`ui/`):** badge, breadcrumb, button, collapsible, command,
dialog, field, input, input-group, item, label, separator, skeleton, spinner,
tabs, textarea, tooltip.

Yeni ihtiyaç: `node scripts/bejamas.mjs <ad>` ile registry'den çekilir,
`ui-react/<ad>/` altına sınıf paritesiyle port edilir; elle yazılmaz.

---

## 15. Hızlı referans

```tsx
// Ana eylem
<Button>Kaydet</Button>
// İkincil
<Button variant="secondary">Vazgeç</Button>
// Yıkıcı
<Button variant="destructive">Sil</Button>
// Form
<Label htmlFor="email">E-posta</Label>
<Input id="email" placeholder="ornek@site.com" />
// Rozet
<Badge variant="secondary">Taslak</Badge>
<Badge variant="destructive">Hata</Badge>
// Sekme
<Tabs value={tab} onValueChange={setTab}>
  <TabsList><TabsTrigger value="site">Site</TabsTrigger></TabsList>
</Tabs>
// Yüzey
<div className="rounded-xl border border-border bg-card p-4 text-card-foreground" />
```

Renk/token değişikliği: yalnız `apps/builder/src/styles/global.css`.
Bileşen sınıfı değişikliği: ilgili `ui-react/<ad>` portu (Bejamas paritesi
korunarak).
