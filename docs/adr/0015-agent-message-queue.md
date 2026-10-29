# 0015 — Ajan mesaj kuyruğu

Durum: Kabul edildi (2026-10-29)

## Bağlam

Bir koşu sürerken Composer yalnızca **Stop** gösteriyordu; kullanıcı yeni bir
istek yazdığında gönderemiyor, beklemesi veya koşuyu durdurması gerekiyordu.
Kullanıcı, çalışan işin arkasına yeni isteklerin sıraya alınmasını ve önceki
bitince sıradakinin otomatik gönderilmesini istedi.

## Karar

1. **Snapshot kuyruğu.** `send` meşgulken metni ve o andaki bağlamı
   (`fullName`, branch, document, pagePath, selections, model, insertMode)
   `QueueEntry` olarak saklar. Seçimler kuyruğa alınırken UI'dan temizlenir;
   ajan bağlamı snapshot'tan alır.
2. **FIFO otomatik drain.** Koşu `done`, `error`, timeout veya prompt hatasıyla
   bittiğinde sıradaki entry otomatik başlatılır. Normal bitişte oturum
   transkripti yüklendikten sonra drain edilir; böylece eski transkript yeni
   kullanıcı mesajını ezmez.
3. **UI.** Meşgulken Composer'da gönder/kuyruk düğmesi + Stop birlikte görünür.
   Kuyruktaki mesajlar ChatLog'da “Queued/Kuyrukta” etiketiyle, ayrıca
   Composer'da “N mesaj kuyrukta” satırıyla gösterilir. Giriş (Enter) meşgulken
   de kuyruğa alır.
4. **Yaşam döngüsü.** Yeni sohbet/oturum değişimi kuyruğu temizler. Kuyruk
   bellekte tutulur; sayfa yenilemede kaybolur. Stop yalnızca çalışan koşuyu
   durdurur; kuyruk normal drain ile devam eder.
5. **Skeleton.** Kuyruktaki bir ekleme istemi gerçekten başladığında
   `onPromptStart` ile hedef skeleton'ı gösterilir; kuyruğa alınırken değil.

## Sonuçlar

- Kullanıcı koşu sürerken birden fazla istek bırakabilir; işler sırayla,
  bağlamları korunarak yürür.
- Kuyruk metinleri ve sayısı görünür; “kayboldu mu?” belirsizliği yok.
- Kuyruk kalıcı değildir; oturumlar arası taşınması istenirse D1'e alınmalıdır.
