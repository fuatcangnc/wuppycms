# Medya yönetimi — WuppyCMS sürümü

Kaynak: GitCMS medya dokümanları (gitcms.dev/docs/features/media-management).
Bu doküman o özelliğin **WuppyCMS'ye uyarlanmış** hâlidir. Farklarımız:

- WuppyCMS yalnız **Astro** destekler; medya klasörü önerisi tek satırdır: `public`.
  (Next/Nuxt de `public`, Hugo/SvelteKit `static` kullanır — ama bizde konu
  kapanmıştır: Astro → `public`.)
- WuppyCMS zaten Cloudflare'de çalışır. R2 için GitCMS'in "workspace integration /
  API token / CORS / imzalı yükleme URL'i" zincirine gerek yoktur: worker'a
  bağlı **R2 binding** üzerinden, kimlik bilgisi girmeden, aynı oturumla
  yükleme yapılır. Bu, GitCMS'in R2 kurulum sayfasındaki 7 adımın 5'ini siler.
- Depo ilkesi değişmez: her yükleme ve silme repoda gerçek bir commit'tir
  (repo kitaplığı seçiliyse). Medya deponun içindeyken içerikle birlikte
  incelemeye girer ve aynı pipeline ile yayınlanır.

Durum işaretleri: ✅ şu an çalışıyor · 🚧 planlı (M2+) · 💭 kapsam dışına yakın.

## Hangi kitaplık?

| Durum | Önerilen |
|---|---|
| Blog görselleri, doküman ekran görüntüleri, yazar avatarları | Depo (✅) |
| Küçük ekipler; her değişiklik incelensin | Depo (✅) |
| Video, büyük indirmeler, kampanya varlıkları | R2 (✅ binding ile) |
| Zengin CDN'li bir varlık alanı zaten var (`assets.…`) | R2 + public base URL (✅) |
| AWS S3 / S3-uyumlu sağlayıcı | 🚧 M3 — şifreli entegrasyon gerektirir |
| Build pipeline'ı medya referanslarını kendisi çeviriyor | 🚧 `media://` özel URI |

Bir site aynı anda iki kitaplık tutabilir: depo (varsayılan) + R2. Medya
ekranında anahtarla geçilir; hangisinin varsayılan olduğu site ayarından
belirlenir. Editör kitaplık seçebilsin; çoğu site tek kitaplıkla yaşar.

## Yükleme nasıl çalışır

**Depo kitaplığı:** seçilen dosya, ayarlı medya klasörünün altında commit'lenir
(`public/fotograf.jpg`). Medya ekranında bir alt klasördeyken yükleme o klasöre
gidir. Doküman editörü içinde yüklerken (yapıştırma ya da "Medyadan ekle")
dosya içeriğe ilişkili bir yola gider — GitCMS'in `posts/hello-world/`
örneğinin karşılığı:

```txt
public/blog/merhaba-dunya/fotograf.jpg
```

**R2 kitaplığı:** dosya worker üzerinden bağlanmış kovaya `PUT` edilir; aynı
oturum kimliği yeterlidir (imzalı URL/CORS yok). Delme ve listeleme de aynı
uçtandır.

**Dosya adları** GitCMS kurallarıyla temizlenir: küçük harf, boşluk → tire,
özel karakterler atılır:

```txt
My Image (1).png  →  my-image-1.png
```

Aynı adda dosya varsa `-2`, `-3`… soneki eklenir (depo ve R2'de aynı davranış).

## Otomatik görsel optimizasyonu ✅

Yükleme **tarayıcıda**, sunucuya varmadan yapılır (sharp/WASM derdine gerek
yok):

- PNG / JPEG / BMP / TIFF → **WebP** (`canvas.toBlob`, kalite 0.82).
- 2560 px genişliği aşan görseller ölçeklenir.
- SVG ve GIF olduğu gibi kalır; WebP/AVIF genelde dokunulmaz.
- Optimizasyon boyutu küçültmüyorsa orijinal kullanılır.
- Onay penceresinde **orijinal → yüklenecek boyut ve %tasarruf** gösterilir;
  kullanıcı onaylamadan commit atılmaz (GitCMS'in "continue upload" onayı).

## Klasör düzeni

Git sabit bir yapı dayatmaz; medya ekranı **Klasörler / Görseller / Diğer
dosyalar** bölümleriyle açılır (GitCMS düzeni). Görsel kartı karedir ve görsel
kartın tamamını doldurur; ad ile boyut hover'da alt bindirmede, bağlantı/aç/sil
işlemeleri sağ üstte belirir (dokunmatik cihazlarda bindirmeler kalıcı görünür).
"+ Klasör" boş klasör yaratır —
git boş klasör tanımadığı için içine sessizce `.gitkeep` konur ve bu işaret
listede görünmez. Yükleme, gezilen klasöre yapılır. Takımınız için önerilen
kalıplar:

- `blog/` — yazı görselleri · `docs/` — ekran görüntüleri
- `authors/` — avatarlar · `changelog/` — sürüm görselleri

Görsel kartına tıklama lightbox açar: klasör içinde oklarla gezinme, `− / % / +`
yakınlaştırma (`0` sıfırlar), indirme ve `Esc`.

## Yükleme ilerlemesi ✅

Yükleme ve klasör oluşturma sırasında içeriğin üstünde yapışkan bir şerit
görünür: toplam yüzde çubuğu, giden/Toplam MB, hızdan hesaplanan **tahmini
kalan süre** ve dosya dosya durum satırları — `hazırlanıyor…` (tarayıcı
optimizasyonu) → `sırada` → `gönderiliyor %62` (gerçek bayt ilerlemesi, XHR)
→ `commit bekleniyor…` → `yüklendi ✓` ya da `başarısız ✗` (hangi dosyada
takıldığını gösterir, şerit kısa süre açık kalır). Şerit görünümden bağımsızdır;
editörde panodan yapıştırırken de izlenir.

## Medya detay diyaloğu ✅

Görsel kartına/liste küçüğüne tıklama **Medya detayları** diyaloğunu açar
(GitCMS düzeni, üç sekme):

- **Detaylar** — önizleme (tıklama lightbox açar), boyut/boyutlar/yükleme
  tarihi/biçim ve URL kopyalama; dosya adı ve konum (klasör) düzenlenir — depo
  tek commit'te taşır, R2 kova içi taşır; alt metin ve başlık (caption) D1
  `media_meta` tablosuna yazılır. Altta **Sil** ve **Görseli değiştir**
  (seç → optimize et → aynı yola commit).
- **Görseli düzenle** — istemci tarafı kırpma (`react-easy-crop`): en-boy
  oranı ön ayarları, yakınlaştırma, canlı çıktı boyutu. **Kırpılmış kopya
  oluştur** (`ad-crop.webp`, yükleme hattından geçer) ya da **Orijinali
  değiştir** (onaylı). Fokal nokta 🚧.
- **Kullanılan yer** — metin içerikleri taranır (`GET /api/media/usage`, en
  fazla 150 dosya) ve "Merhaba dünya · Blog · gövde" satırları + **Aç** ile
  doğrudan girdi editörüne atlanır.

> Dağıtımda migration'lar: `wrangler d1 migrations apply wuppycms --remote`
> (0003 + 0004).

## Arama, filtre ve görünüm ✅

Araç çubuğu GitCMS ile aynı üçlüğü taşır: **ada göre arama**, **tür filtresi**
(Tüm türler / Görseller / Video / Ses / Belgeler / Diğer — mime sınıfından
türetilir) ve **ızgara ⇄ liste** anahtarı. Görünüm tercihi `localStorage`'da
kalıcıdır. Izgarada kartın alt şeridi dosya adını ve biçim rozetini (WEBP,
JPEG…) kalıcı gösterir; liste görünümü önizleme, dosya adı, tür (mime), boyut
ve alt metin sütunlarını taşır.

## Alt metin (alt text) ✅

Liste görünümündeki **Alt metin** hücresi satır içi düzenlenir; Enter/odak
çıkınca D1'deki `media_meta` tablosuna yazılır (boşaltınca kayıt silinir). Alt
metin repoya yazılmaz — dosyalar repo'da, editör meta verisi D1'de yaşar.
Editör içeriğe ekerken (seçici ya da panodan yapıştırma) kayıtlı alt metin
`![alt](bağ)` olarak kullanılır, yoksa dosya adı düşer.

## Diyaloğun kendisi

Tüm yönetici diyaloqları Bejamas UI Dialog portu üzerinde durur
(`ui-react/dialog` — sınıflar `ui.bejamas.com/r/dialog.json` ile birebir):
merkezlenmiş panel, halka kenarlık, sağ üst X, veri-odaklı aç/kapa animasyonu,
Escape ve dışa tıklama ile kapanma, kaydırma kilidi.

## Editörde medya

- **Panodan yapıştır** ✅: gövde alanına `Ctrl+V` ile görsel yapıştırılır;
  WuppyCMS optimize eder, yükler ve imlecin olduğu yere `![…](/yol)` koyar.
- **Medyadan ekle** ✅: gövdede araç düğmesi ve görsel benzeri alanlarda
  (`image`, `cover`, `hero`, `avatar`, `og`… adlı string alanları) açılan
  seçici; seçim alan değerine / gövde imlecine bağ olarak yazılır.
- `/image` bloğu 🚧: WYSIWYG editör M2'nin konusudur; şimdiki karşılığı
  yapıştır + seçici.

## Bağlantı biçimi ("How links should look") ✅

Site ayarından seçilir, `.wuppycms/sites.jsonc` içinde `mediaLink` alanıyla
saklanır ve "bağlantı kopyala" ile editör eklemeleri bunu kullanır:

| Biçim | Örnek | Ne zaman |
|---|---|---|
| Siteye göreli (varsayılan) ✅ | `/blog/kapak.webp` | Depo medyası; Astro `public/` bunu zaten servis eder |
| Tam URL ✅ | `https://site.com/blog/kapak.webp` | Sosyal önizleme/og etiketi gibi mutlak yol isteyen yerler |
| Klasöre göreli ✅ | `blog/kapak.webp` | Renderer medya tabanını sonra ekliyorsa |
| Özel `media://` URI 🚧 | `media://blog/kapak.webp` | Yalnız build pipeline'ı bu şemayı çeviriyorsa |

R2 medyasında bağ her zaman **public base URL** üzerinden üretilir
(`https://assets.…/onek/blog-kapak.webp`). Public base URL boşsa önizleme
worker'ın ham akış ucundan yapılır ama yayına girecek bağ uyarı üretir.

## R2 kurulumu (WuppyCMS kısayolu)

GitCMS'in 7 adımlık R2 rehberinin bizdeki karşılığı 3 adım:

1. **Kova:** Cloudflare dashboard → R2 → `site-adi-media` kovası.
   (Yerel geliştirmede `wrangler dev` local kovayı kendisi oluşturur.)
2. **Binding:** `wrangler.jsonc` içinde `r2_buckets` zaten tanımlıdır
   (`MEDIA_R2` → `wuppycms-media`). Kovayı yeniden adlandırırsanız burayı
   güncelleyin. Token, access key, CORS **gerekmez** — worker kovayı binding'e
   dokunarak kullanır, istemci yalnız kendi oturumumuzla konuşur.
3. **Site ayarı → Medya:** "R2 kitaplığı"nı açın; isteğe bağlı **ön ek**
   (`assets`) ve **public base URL** (`https://assets.example.com`) girin.
   Public delivery için kovaya özel alan bağlayın (`r2.dev` üretimde kullanılmaz
   — GitCMS ile aynı uyarı geçerli).

Kayıttan sonra `.wuppycms/sites.jsonc` örneği:

```jsonc
{
  "version": 1,
  "sites": [{
    "key": "root",
    "name": "example.com",
    "url": "https://example.com",
    "media": "public",
    "mediaLink": "relative",
    "mediaR2": { "prefix": "assets", "publicBaseUrl": "https://assets.example.com" }
  }]
}
```

## S3 / S3-uyumlu 🚧 (M3)

GitCMS, S3 kimliklerini şifreli workspace entegrasyonunda tutar. WuppyCMS'de bu,
D1'de şifreli kayıt + worker tarafı imzalama demektir; R2 varsayılen iken
öncelik düşük, planlama notu olarak durur. Kurulum yüzeyi R2 ile birebir
aynıdır (endpoint ≠ public URL ayrımı, önek, bağ biçimi).

## Sorun giderme

- **Görsel yükleniyor ama sitede çıkmıyor:** medya klasörü Astro'nun `public`
  klasörüyle eşleşmeli; bağ biçimi siteye göreli seçili olmalı.
- **R2 önizlemesi boş:** public base URL boş ya da `r2.dev`/API endpoint'i
  yazılmıştır; tarayıcıdan açılabilen varlık alanı yazın.
- **Depo şişti:** küçük görseller deponun rahat işidir; video/büyük dosyayı
  R2'ye taşıyın (GitCMS ile aynı öğüt).
- **Git LFS:** GitCMS gibi biz de GitHub API'siyle yazarız; LFS kuralları
  uygulandığı gibi kalmaz. Büyük dosyalar için R2 kullanın. ✅ (uyarı, medya
  ekranında gösterilir)

## Durum tablosu

| Özellik | Durum |
|---|---|
| Depo kitaplığı: listele, yükle (commit), sil, bağlantı | ✅ |
| Alt klasör gezme + seçili klasöre yükleme | ✅ |
| Klasörler/Görseller bölümleri + klasör oluşturma (`.gitkeep`) | ✅ |
| Lightbox: gezinme, yakınlaştırma, indirme | ✅ |
| Bejamas Dialog portu (tüm diyaloqlar) | ✅ |
| Dosya adı temizleme (küçük harf + tire) | ✅ |
| Tarayıcıda WebP/ölçek optimizasyonu + tasarruf onayı | ✅ |
| Sürükle-bırak yükleme | ✅ |
| Bağlantı biçimleri (göreli/tam/klasöre göreli) | ✅ |
| Panodan yapıştır → yükle → gövdeye ek | ✅ |
| Görsel alanlarında medya seçici | ✅ |
| R2 kitaplığı (binding, listele/yükle/sil/önizleme) | ✅ |
| R2 özel alan + public base URL | ✅ (alan sizin; UI yönlendirir) |
| Grid/liste görünüm anahtarı (kalıcı tercih) | ✅ |
| Ada göre arama + tür filtresi (Görseller/Video/Ses/Belgeler/Diğer) | ✅ |
| Alt metin (liste satırından düzenle; D1 `media_meta`) | ✅ |
| Medya detay diyaloğu (Detaylar / Görseli düzenle / Kullanılan yer) | ✅ |
| İstemci tarafı kırpma (react-easy-crop; kopya oluştur / orijinali değiştir) | ✅ |
| "Kullanılan yer" içerik taraması + girdiye atlama | ✅ |
| Yeniden adlandır / klasör taşı / görseli değiştir | ✅ |
| Fokal nokta (focal point) | 🚧 |
| `media://` özel URI | 🚧 |
| S3 / S3-uyumlu | 🚧 M3 |
| WYSIWYG `/image` | 🚧 (editör M2) |
