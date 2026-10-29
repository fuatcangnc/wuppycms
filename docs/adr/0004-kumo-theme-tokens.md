# 0004 — Tema bileşenleri: Kumo mavisi + imleç restorasyonu

Durum: Kabul edildi

## Bağlam

Marka rengi Kumo mavisi olarak sabitlendi; butonlar degrade/cilalı/ringli
görsel dili kullanıyor ve silme eylemi aynı biçimin kırmızısı. Tailwind v4
preflight'ı `button { cursor: pointer }` kuralını kaldırdığından tüm
buton/link yüzeylerinde imleç bozuluyordu.

## Karar

- `src/styles/global.css` `@theme` bloğu:
  - light `--color-primary: oklch(57.72% 0.2324 260)`
  - dark `--color-primary: oklch(51.948% 0.2324 260)`
- Buton varyantları (degrade + parlaklık + ring) yalnız
  `src/components/ui-react/button/` portunda tanımlıdır; destructive aynı
  biçimin kırmızısıdır (0002 kapsamı).
- `@layer base` içindeki `cursor: pointer` restorasyon bloğu Tailwind v4
  sürüldüğü sürece korunur.

## Sonuçlar

- Tema değişikliği yalnız `global.css` tokenlarından yapılır; bileşen sınıfı
  değiştirmeyi gerektirmez.
- İmleç restorasyonu silinirse "butonlar tıklanabilir hissettirmiyor" hatası
  geri gelir; blok bilinçli bir restorasyondur, gereksiz süsleme değildir.
