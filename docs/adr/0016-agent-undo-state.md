# 0016 — Ajan Undo: tek istek, kalıcı durum ve F5'siz önizleme

Durum: Kabul edildi (2026-10-29)

## Bağlam

Undo düğmesi istek sürerken de etkin kalıyor, art arda tıklanabiliyordu. Ayrıca
geri alınan değişiklik F5/session reload sonrası Undo olarak geri geliyor;
önizleme ise undo commit'ini F5 atmadan göstermiyordu. Soft-refresh'in
başarısız olmasının bir nedeni, sticky header'ın runtime `data-sticky`/aktif
sınıflarının sunucudan gelen HTML ile birebir karşılaştırılmasıydı.

## Karar

1. **Tek uçuş.** `undoInFlight` ref'i ve `undoing` state'i; istek sürerken tüm
   Undo düğmeleri `disabled`, ilgili düğme **“Undoing…”** gösterir. İkinci
   tıklama yeni istek üretmez; hata/başarı sonunda tekrar etkinleşir.
2. **Kalıcı reverted filtresi.** `loadMessages`, `agent_changes.reverted=1`
   olan `change_ids`leri filtreler; undo API'si ve `undo_last_change` aracı
   `removeChangeIdFromMessages` ile mesaj kaydını temizler. F5 sonrası Undo
   görünmez.
3. **F5'siz önizleme.** `WuppycmsBridge` soft-refresh shell karşılaştırması
   `outerHTML` yerine **görünür metin + link href'leri** üzerinden yapılır;
   sticky header, aktif menü ve runtime sınıfları yenilemeyi engellemez.
   Yerel preview'de `git pull` döngüsü commit'i alır; bridge `<main>`i
   yerinde değiştirir, scroll korunur.
4. **Bir kerelik köprü yenilemesi.** Eski sayfada yüklü köprü yeni shell
   imzasını bilmez; yeni köprü için bir kez sayfa yenilenir. Sonraki undo'lar
   F5'siz güncellenir.

## Sonuçlar

- Undo çift tıklama/çift commit riski kalkar.
- Reverted change F5 sonrası geri gelmez; 400 generic hata yerine gerçek mesaj
  görünür.
- Sticky header açıkken de soft-refresh çalışır; undo commit'i F5'siz yansır.
- Header/footer metni veya linkleri değişirse güvenli fallback tam reload'dur.
