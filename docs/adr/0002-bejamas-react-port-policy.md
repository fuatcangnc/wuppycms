# 0002 — Bejamas UI: registry'den sınıf-sınıf-React portu

Durum: Kabul edildi

## Bağlam

UI primitifleri (button, dialog, tabs…) Bejamas registry'sinde (`ui.bejamas.com`)
yalnız `.astro` kaynak olarak dağıtılıyor; `@bejamas/ui` npm paketi yayınlanmamış
(404). Admin arayüzü ise React (0001). El yazması primitif ya da üçüncü parti
kütüphane (shadcn kopyası dahil) tasarım dilini ve temayı dallandırıyor.

## Karar

- Her primitif `node scripts/bejamas.mjs <ad>` ile registry'den çekilir ve
  `src/components/ui-react/<ad>/` altına **sınıf sınıf** React'e port edilir
  (`Radix → controlled React`, JSX tipleri).
- Kural listesi ve tablo: `docs/bejamas-ui.md`. Elle primitif yazmak ve
  üçüncü parti UI kütüphanesi eklemek yasak.
- Portlanamayan istisna kayda geçer: Toggle/ToggleGroup cva'sı registry'de
  yok; `docs/bejamas-ui.md`de bilinen boşluk olarak durur.

## Sonuçlar

- Tema tokenları ve görsel dil tek kaynaktan beslenir; güncellemede fetcher
  yeniden çalıştırılıp fark alınır.
- Portların bakım maliyeti bilinçli olarak kabul edilmiştir; upstream
  bağımlılığı yoktur.
