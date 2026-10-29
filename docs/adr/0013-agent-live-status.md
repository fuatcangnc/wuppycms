# 0013 — Ajan canlı durum: süre, “Thinking” ve çağrı grubu

Durum: Kabul edildi (2026-10-29)

## Bağlam

Model + araç döngüsü birkaç saniye ile dakikalar arasında sürebiliyor. Kullanıcı
bu sürede yalnızca araç çağrılarını görüyor, ne kadar sürdüğünü bilmiyordu.
“Calls” grubu ilk anda geliyor, düşünme/çalışma durumu görünmüyordu. Ayrıca
“İLETİŞİM yazısını kaldır” gibi bir metin kaldırma isteğinde ajan yalnızca
dosya okuyup commit yapmadan durabiliyordu.

## Karar

1. **Canlı süre.** `useAgentChat` koşu başlangıcından itibaren her saniye
   `elapsed` üretir; ChatLog “Thinking… · Ns” olarak gösterir. Koşu bitince
   mevcut “Done · Ns” notu korunur.
2. **Thinking durumu.** `busy` iken mesajlardan sonra, araç grubundan **önce**
   üç nokta + “Thinking…” + süre satırı çizilir. Böylece ilk geri bildirim
   çağrılar değil, düşünme durumudur.
3. **Çağrı grubu.** Araç grubu varsayılan kapalıdır; koşu bitince (hata yoksa)
   otomatik kapanır. Kullanıcı chevron ile açıp kapatabilir.
4. **Kaldırma isteği.** Sistem istemi, görünür bir etiket/metin kaldırılırken
   seçili elementin text/html/path’ini kullanarak kaynağı bulmayı, sayfadaki
   tüm görünür tekrarları (nav/header, footer, bölüm başlığı, buton) kaldırmayı
   ve yalnızca dosya okumakla durmadan aynı turda commit etmeyi söyler.
5. **Model hızı.** Gerçek gecikme sağlayıcı/model ve araç turlarına bağlıdır;
   UI süreyi şeffaf gösterir. Kaldırma kuralı gereksiz okumaları azaltmayı
   hedefler.

## Sonuçlar

- Kullanıcı koşunun ne kadar sürdüğünü görür; “takıldı mı?” belirsizliği azalır.
- Çağrı grubu tamamlanınca kendiliğinden kapanır; transkript daha temiz kalır.
- Kaldırma isteğinde ajanın salt okuma turunda kalması engellenir; yine de
  model davranışı garanti değildir, sonuç commit’te doğrulanmalıdır.
