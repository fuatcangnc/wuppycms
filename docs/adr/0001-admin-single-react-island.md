# 0001 — Admin tek React adacığı, durum `lib/admin/store.ts`te

Durum: Kabul edildi (blueprint yapısını bilinçli olarak değiştirir)

## Bağlam

Blueprint (`structure.md`) admin ekranlarını `src/islands/` altına, durumu
`src/stores/` altına öneriyordu. Uygulamada admin tek bir Astro sayfasıdır
(`admin.astro` + `admin/[...path].astro`) ve tek bir `client:only="react"`
adacığı (`AdminApp.tsx`) render eder. Görünümler durumunu adacıklara bölmek
Astro'da adacıklar arası durum paylaşımını `localStorage`/custom-event gibi
gecikmeli kanallara taşır; oysa `$view`, `$doc`, `$mediaFolder` gibi atomlar
yönlendiriciyle (0003) iki yönlü ve anlık eşitlenmek zorundadır.

## Karar

- Admin arayüzü tek React adacığı olarak kalır; tüm ekranlar bu ağacın
  içindeki bileşenlerdir (`src/components/admin/…`).
- Durum Nanostores atomları olarak `src/lib/admin/store.ts`te yaşar; iş
  mantığı `actions.ts` ve `media*.ts` katmanlarındadır.
- `src/islands/` ve `src/stores/` `.gitkeep` iskeletleri silinmiştir.
- Adacık büyüdükçe React `lazy()` ile parçalanır (ör. kırpma paneli
  `MediaCropPanel` yalnız "Görseli düzenle" sekmesinde yüklenir); intent
  bazlı adacık bölünmesi teknik borç olarak izlenir.

## Sonuçlar

- Durum paylaşımı sıfır maliyetli, URL eşitlemesi tek noktada deterministik.
- Yeni bir ekran "yeni island" değil "yeni bileşen + store atomu"dur.
- Tek adacık derleme boyutunu büyütür; `lazy()` disiplini bunun panzehiridir.
