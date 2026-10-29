# 0014 — Ajan hızlı düzenleme ve hedef ölçüsünde skeleton

Durum: Kabul edildi (2026-10-29)

## Bağlam

Küçük bir metin düzenlemesi (ör. sonuna bir kelime eklemek) ajanın gereksiz
`grep`/`read_file` turları yüzünden dakikalar sürebiliyordu. Skeleton da hedef
elementin boyutundan bağımsız sabit 170px yüksekliğindeydi; küçük bir element
için büyük, büyük bir bölüm için yanlış görünüyordu.

## Karar

1. **Hedef ölçüsü.** `placeSkeleton`, seçili elementin
   `getBoundingClientRect()` ölçüsünü alır; skeleton genişliği/yüksekliği bu
   ölçüye ayarlanır (min. 80×56, `overflow:hidden`). Hedef yoksa 100%×170
   varsayılanı kullanılır.
2. **Hızlı düzenleme istemi.** Sistem istemi, seçili element üzerindeki basit
   metin/renk değişikliklerinde yalnızca önizleme sayfasını veya metnin sahibi
   tek bileşeni okumayı; repo genelinde grep/list yapmamayı; ilk iki araç
   turunda yazmayı söyler.
3. **Okuma turu nudge'ı.** Kısa istemlerde (240 karakterden az) üç tur sonunda
   hâlâ yazma yoksa modele "yeterli bağlam var; okumayı bırak, en küçük
   düzenlemeyi yap ve commit et" sistem mesajı eklenir. `WRITE_TOOLS` başarılı
   çalışınca nudge eklenmez.
4. **Görünürlük.** Canlı süre ve Thinking durumu (ADR 0013) korunur; model
   gecikmesi şeffaf gösterilir.

## Sonuçlar

- Skeleton, seçilen bölüm/elementin kapladığı alanı temsil eder.
- Basit düzenlemelerde araç turu ve bekleme azalır; karmaşık görevlerde nudge
  yalnızca kısa istemlerde ve 3 turdan sonra devreye girer.
- Gerçek hız yine sağlayıcı/modelin yanıt süresine bağlıdır; UI bunu gizlemez.
