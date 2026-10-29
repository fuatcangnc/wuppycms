# 0011 — Ajan: öncesine/sonrasına ekleme ve hedef skeleton'ı

Durum: Kabul edildi (2026-10-28)

## Bağlam

Ajan, seçili bir elementin bağlamını alıyordu; ancak yeni bir bölümün **seçili
elementin önüne mi sonuna mı** ekleneceği arayüzde belirtilemiyordu. Model
çoğu zaman bölümü sayfanın sonuna ekliyor, kullanıcı da değişikliğin nereye
gittiğini ancak commit sonrası görebiliyordu.

Kullanıcı ayrıca bölüm eklenirken önizlemenin hedefe gitmesini ve o noktada
skeleton/loading göstergesi görmesini istedi.

## Karar

1. **Konum seçimi.** Her seçili element için `before | after` konumu tutulur
   (`PickedElement.position`, `SelectionContext.position`). Composer'daki
   seçim çipinde **Sonrasına / Öncesine** select'i bulunur; varsayılan
   `after`'dır.
2. **İstem bağlamı.** Konum `[SELECTED ELEMENTS]` bloğuna `insert: before` /
   `insert: after` olarak eklenir. Sistem istemi, yeni bölümü seçili elementin
   hemen önüne/sonrasına kardeş olarak eklemeyi, sayfa sonuna eklememeyi ve
   seçili elementi değiştirmemeyi söyler.
3. **Köprü protokolü.** `WuppycmsBridge.astro` yeni mesajları destekler:
   - `wuppycms:place {path,label,position,scroll}` → hedefte turuncu ekleme
     çizgisi; `scroll` true ise hedefe kaydır.
   - `wuppycms:skeleton {path,label,position,message}` → hedefin hemen
     önüne/sonrasına shimmer skeleton; hedefe kaydır.
   - `wuppycms:skeleton-clear` → skeleton ve çizgiyi kaldır.
   Mesajlar yalnızca üst pencere `wuppycms:hello` dedikten sonra işlenir; normal
   ziyaretçi etkilenmez.
4. **Yaşam döngüsü.** Widget, prompt gönderilmeden önce skeleton'ı yerleştirir;
   içerik değişince `onContentChanged` skeleton'ı temizleyip canvas'ı yeniler.
   Koşu hatasız biterse veya kullanıcı durdurursa `busy=false` etkisi temizler.
   Yeni sohbet, oturum değişimi ve panel kapanışı da temizler.
5. **Mesaj metni.** İstemde `ekle/section/bölüm/add/insert` varsa
   "Yeni bölüm hazırlanıyor", aksi halde "Değişiklik hazırlanıyor" gösterilir.
6. **Geriye uyumluluk.** Eski köprüler yeni mesajları yok sayar; konum yine
   istem bağlamında gönderildiği için modelin ekleme davranışı çalışır. Skeleton
   yalnızca güncel köprüde görünür.

## Sonuçlar

- Ekleme hedefi görsel olarak önceden görülür; kullanıcı yanlış yere
  eklenmesini fark edip konumu değiştirebilir.
- Skeleton, AI çalışırken hedef bölgede bekleme hissi verir; commit sonrası
  yeniden yüklemede kaybolur.
- Konum `SelectionContext`'in parçasıdır; oturum/olay şeması değişmez.
- Eski müşteri repolarında skeleton için `WuppycmsBridge.astro` güncellenmelidir.
