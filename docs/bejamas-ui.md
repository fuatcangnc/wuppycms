# Bejamas UI — bileşen politikası

**Kural:** Arayüz primitifleri (buton, girdi, diyalog, tablo…) hiçbir zaman elle
yazılmaz ve üçüncü bir arayüz kütüphanesinden beslenmez. İhtiyaç doğan her
bileşen **Bejamas UI registry'sinden** (`https://ui.bejamas.com/r/<ad>.json`)
alınır ve sınıf paritesiyle `src/components/ui-react/<ad>/` altına React portu
olarak eklenir. Registry yalnız `.astro` dağıttığı için port zorunludur;
sitillerin kaynağı her zaman registry'nin kendisidir.

Portlama iş akışı:

1. `node scripts/bejamas.mjs <ad>` — kaynak `.astro` dosyalarını getirir
   (`list` ile tüm kayıt görülebilir).
2. `class={cn(...)}` ve `cva(...)` sabitleri **birebir** taşınır; davranış
   (Astro `<script>` denetleyicileri) React'te kontrollü props ile kurulur.
3. Port başlığına parite kaynağı yorumu yazılır; registry bileşeni değişirse
   port da güncellenir.
4. Tema token'ları (`--primary`, `--muted`…) ortak olduğu için koyu/açık tema
   ve marka degradesi portlara otomatik işler.

## Kayıt durumu

Port edilmiş (kullanımda): **Alert · Avatar · Badge · Button · Dialog · Input ·
Label · Skeleton · Table · Tabs · Textarea**

İhtiyaç doğduğunda aynı yöntemle port edilecekler (registry'de mevcut):

| Bileşen | Not |
| --- | --- |
| Accordion, Collapsible | ayar grupları için aday |
| Toast, Spinner | geri bildirim gerektiğinde |
| Breadcrumb, Card, Item | kabuk/içerik yüzeyleri aday |
| Button Group | split-buton gerektiğinde (Deploy benzeri) |
| Carousel, Marquee | pazarlama blokları |
| Checkbox, Radio Group, Switch, Slider | formlar — Field ile birlikte |
| Combobox, Command, Dropdown Menu, Navigation Menu, Popover, Hover Card, Tooltip | yüzey bileşenleri |
| Date, Drawer, Field, Hamburger Menu | editör genişlemeleri |
| Input Group, Kbd, Link Group, Native Select | giriş varyantları |
| Pagination, Resizable, Sticky Surface | kabuk |
| Separator | ihtiyaç doğunca 5 dakikalık port |
| Toggle, Toggle Group | bkz. bilinen boşluk |

**Bilinen boşluk:** `Toggle` / `Toggle Group` sınıfları `@bejamas/ui` npm
paketinin `lib/toggle-shared` modülünde duruyor ve paket yayında değil; bu iki
bileşen port edilirken cva sabitleri registry demo çıktısından elle doğrulanıp
portun içine gömülecek (parite yorumuyla). O zamana dek ikili anahtarlar
(Depo/R2, ızgara/liste) mevcut yerel kontrollerle idare eder.

## Tema

Marka rengi ve vurgu buton degrade mekanizması (Kumo tarzı) `global.css`'teki
`--primary` + `--button-primary-*` / `--button-danger-*` token'larından türer;
portlar bu token'ları kullandığı için renk değişimi tüm bileşenlere yansır.
Ayrıntı: `docs/media-management.md` ve tema bölümü.
