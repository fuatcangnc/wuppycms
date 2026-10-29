# ADR 0006: ReeyCMS (OSS) / Wryte (cloud) ayrımı ve repo-tabanlı içerik yaşam döngüsü

**Durum:** Onaylandı (2026-10-15)

## Bağlam

Ürün SitePins modelini izler: aynı çekirdeğin iki yüzü olacak.

- **ReeyCMS** — açık kaynak sürüm; herkes kendi sunucusunda barındırır.
- **Wryte** — bulut sürümü (wryte.xyz); ReeyCMS'in yönetilen barındırmasıdır,
  ayrı bir ürün değil. Cloudflare tarafı (Workers/D1/R2/Queues/Cron) bu
  barındırma katmanıdır.

Wryte referans setindeki içerik yaşam döngüsü (draft, scheduled, publish,
review/PR, snapshot) Cloudflare-bağımlı veritabanı varsayar (Convex → D1
karşılığı). Bu, OSS sürümü kilitleyeceği için **olduğu gibi port edilmez**.

## Karar

### 1. Yaşam döngüsünün tek doğruluk kaynağı repodur; D1'de içerik
### durum kuyruğu tutulmaz

- **Taslak:** `_drafts/` klasöründe gerçek dosya (konfigürasyonla
  değiştirilebilir). Silinmez, commit'lenir.
- **Zamanlanmış yayın:** frontmatter'da `publishAt` alanı. Bir zamanlayıcı
  (bulutta Cron Trigger; self-host'ta herhangi bir cron) süresi gelen
  dokümanı taşır/işaretler ve commit atar. Kaynak repodur; zamanlayıcı
  yalnızca yürütücüdür, durum taşımaz.
- **Durum (draft/review/ready):** frontmatter `status` alanı; pano/kata
  görünümleri bundan türetilir.
- **Snapshot/rollback:** git geçmişi (daha ileride gerekirse yayın anında
  ek dosya kopyası).
- D1 yalnızca **kimlik ve platform** verisidir: kullanıcı/proje/üyelik,
  media alt-yazı metadata'sı, oturumlar. Doküman durumu, sürekliliği veya
  içeriği D1'de tutulmaz.

### 2. Çekirdek Cloudflare-bağımsızdır; bulut adaptördür

- ReeyCMS çekirdeği depolama/zamanlama/AI'yi arayüzler üzerinden tüketir.
  Cloudflare yığını (D1/R2/Queues/Cron/AI Gateway) **Wryte'ın referans
  adaptörüdür**; self-host sürümü SQLite/dosya/yerel cron/ister kendi LLM
  sağlayıcısı ile çalışabilir.
- Yeni kod yazılırken "bu D1'e özel mi, çekirdeğe mi?" sorusu sorulur;
  platforma özel her şey adaptör sınırının arkasına itilir.

## Sonuçlar

- Olumlu: OSS sürümü sıfır Cloudflare hesabıyla kurulabilir; Wryte, aynı
  kodun ticari yüzüdür; wryte.xyz'nin Convex'e bağlı akışları (draft inbox,
  scheduled queue) repo-üzerinden eşdeğerlenir.
- Olumsuz/ödev: mevcut media alt-yazı metadata'sı (alt/caption) D1'de
  duruyor — OSS portability için repo-içi JSON manifest'a taşınması
  gereken bilinen sapmadır (P4 işi). Cron'suz self-host'ta zamanlanmış
  yayın kullanıcı cron kurmasına bağlıdır (kabul edildi).
- Etkilenen dosyalar: tüm `lib/admin/*` yazma yolları (git = durum),
  ileride `do-*.ts` adaptör soyması.

## Uygulama notu (2026-10-16)

- ✅ Media alt/caption `.reeyai/media.json` manifestine taşındı (P4) — sapma kapandı.
- ✅ Platform arayüzleri tanımlandı: `apps/builder/src/lib/platform/index.ts`
  (`SqlDatabase`, `BlobStore`, `platformFromBindings`); Cloudflare uyumu ve
  bellek-içi sahte adaptörle çekirdek akış testlidir (`platform.test.ts`).
  Pilot geçiş: `projectRole` arayüz tipiyle çalışır.
- ⏳ Kalan D1/R2 çağrıları kademeli olarak arayüze bağlanacak; durum ve
  self-host kontrol listesi: `docs/portability.md`.
