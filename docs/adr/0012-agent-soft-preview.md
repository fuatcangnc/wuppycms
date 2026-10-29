# 0012 — Ajan önizlemesi: HMR kapalı + yumuşak yenileme

Durum: Kabul edildi (2026-10-28)

## Bağlam

Ajan bir dosyayı değiştirdiğinde önizleme iki kez yenilenebiliyordu:

1. Widget `onContentChanged` içinde `reloadCanvas()` çağırıyordu (iframe reload
   veya `location.reload`).
2. Yerel önizleme bir Vite dev sunucusu olduğu için dosya değişimi HMR/full
   reload'u ayrıca tetikliyordu.

Sonuç kullanıcı için her yazmada F5 gibi görünüyor, scroll ve seçim bağlamı
kayboluyordu. Ayrıca skeleton shimmer'ı repaint sırasında titriyordu.

## Karar

1. **Önizleme modu HMR'sız çalışır.** Yerel önizleme `WUPPYCMS_PREVIEW=1` ile
   başlatılır; `astro.config.mjs` bu durumda `vite.server.hmr = false` yapar.
   Normal geliştirmede HMR açık kalır.
2. **Yumuşak yenileme.** `WuppycmsBridge.astro` `wuppycms:soft-refresh` mesajını
   alınca sayfayı `fetch(..., {cache:"no-store"})` ile çeker; `<main>` ve
   `style[data-vite-dev-id]` bloklarını değiştirir, scroll'u ve hedef seçimi
   korur; `wuppycms:soft-refreshed {ok}` ile yanıtlar. Header/footer/title
   değişmişse veya fetch başarısızsa `ok:false` döner.
3. **Yeteneksiz köprü uyumu.** Yeni köprü `wuppycms:ready` içinde
   `capabilities.softRefresh` gönderir. Widget yalnızca bu bayrak varsa yumuşak
   yeniler; yoksa eski davranışa (tam reload) düşer. 6 sn'lik belirsiz bekleme
   yerine yetenek kontrolü kullanılır.
4. **Çift yenileme kaldırıldı.** `useAgentChat` içindeki `fileOnly` ikinci
   `onContentChanged` çağrısı kaldırıldı; köprü zaten 4 sn'ye kadar fetch
   denemesi yapıyor.
5. **Skeleton sakinleştirildi.** Hareketli shimmer/spinner yerine sabit
   yükseklik, ince çizgiler ve yalnızca opacity pulse kullanan kart; layout
   kayması yok.

## Sonuçlar

- Bölüm ekleme/düzenleme sonrası önizleme F5 olmadan güncellenir; scroll ve
  hedef konum korunur.
- Header/footer gibi kabuk değişikliklerinde güvenli fallback tam reload'dur.
- Eski müşteri repolarında yumuşak yenileme yoktur; köprü güncellenmelidir.
- HMR'sız önizleme yalnızca önizleme modunda geçerlidir; normal geliştirme
  deneyimi değişmez.
