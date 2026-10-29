# 0018 — Teknik kimliklerin WuppyCMS'e taşınması

Durum: Kabul edildi (2026-10-29)

## Bağlam

0009 marka adını WuppyCMS yaptı ancak geriye uyumluluk için bir grup teknik
adı eski markada bıraktı. Ürünün erken aşamasında bu istisnalar kullanıcıya
ve kaynak ağacına eski markayı taşımaya devam etti. Marka artık tüm ürün
yüzeylerinde ve teknik sözleşmelerde WuppyCMS olacaktır.

## Karar

Aşağıdaki adlar WuppyCMS'e taşındı; eski adlar için geriye uyumluluk katmanı
tutulmayacak:

- Site yapılandırma klasörü: `.wuppycms/`
- Paket kapsamı: `@wuppycms/*`
- Tarayıcı mesaj protokolü ve depolama anahtarları: `wuppycms:`
- İçerik seçim işaretleri: `data-wuppycms-*`
- Önizleme köprüsü bileşeni: `WuppycmsBridge.astro`
- Ortam değişkenleri: `WUPPYCMS_*`
- Yerel test hesapları: `@wuppycms.local`
- D1 veritabanı: `wuppycms`
- R2 kovası: `wuppycms-media`

Eski marka adları üretim kodunda, dokümanlarda, şablonlarda ve paketlerde
kullanılmaz. `pnpm check:brand` bunu denetler.

## Geçiş

- Demo, site şablonu ve With AI starter repoları yeni klasör, köprü ve
  işaret adlarına geçirildi.
- Mevcut müşteri repoları için ayrı bir içerik göçü gerekir: eski
  yapılandırma klasörünün `.wuppycms/` olarak yeniden adlandırılması ve
  sayfalardaki eski seçim işaretlerinin yeni adlara çevrilmesi. Bu göç otomatik geriye
  uyumluluk ile değil, açık bir migration adımıyla yapılır.
- Yerel tarayıcı depolamasındaki eski anahtarlar okunmaz; kullanıcı seçimi
  ve panel tercihleri yeni anahtarlarla yeniden oluşur.
- Uzak D1/R2 kaynakları yeni adlarla oluşturulmalı ve veri taşınmalıdır.
  Yerel geliştirme veritabanı kimliği korunduğu için yerel veri yerinde kalır.

## Sonuçlar

- Marka tek bir adla aranabilir hale geldi.
- Eski sözleşmelerle kurulmuş repolar için migration zorunlu; bu bilinçli bir
  kırıcı değişikliktir.
- 0009 tarihsel kayıt olarak kalır; bu ADR onun teknik istisnalarını geçersiz
  kılar.
