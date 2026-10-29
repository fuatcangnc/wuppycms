# 0007 — Açılış verisi Astro SSR'den (boot seed); gezinme/etkileşim /api'de

Durum: Kabul edildi (0001 ve 0005'e istisna getirir, ikisini de kaldırmaz)

## Bağlam

Admin adası tüm veriyi istemcide `/api` üzerinden çekiyordu: her derin
bağlantı açılışında (ör. `/admin/{site}/content/{kol}/{slug}`) önce oturum,
projeler, tarama, kayıt listesi ve dosya içeriği sırayla istemcide
yükleniyor, ekranda iskeletler dönüyordu. Kullanıcı talebi: ilk veri
Astro SSR ile sunucudan gelsin. Tam SSR göçü (sunucu yönlendirmeli gezinme,
TanStack Query'nin bırakılması) 0001/0005'in tamamını ve 16 e2e suite'ini
tehdit ettiği için kabul edilmedi; hibrit seçildi.

## Karar

- **`boot-ssr.ts` (yalnız sunucu)**: `/admin` ve `/admin/…` sayfaları
  oturumla birlikte `loadBoot()` çağırır. Yükleyici, `/api` işleyicilerinin
  ait olduğu Hono uygulamasına **ağ çıkmeden süreç içinden**
  (`api.fetch(req, env, ctx)`, `cookie` başlığı taşınır) istek atar — kimlik
  çözümü, tarama ve hata davranışı API ile birebir aynıdır, mantık
  çoğaltılmaz.
- Rota → yük eşlemesi `parseAdminPath` ile çözülür: her açılışta kullanıcı +
  projeler; aktif site için `scan`; rotaya göre `commits` (genel bakış),
  `entries` (kayıt listesi/doküman), `doc` dosyası, `CONTENT.md`, medya
  listesi + meta (depo kitaplığı) veya `reviews`. Çöp listesi ve R2
  kitaplığı istemcide kalır (seyrek/akışkan).
- **`boot.ts` (istemci)**: `seedBoot()` router kurulmadan ÖNCE çağrılır;
  TanStack önbelleğini (`projects`, `reviews`) doldurur ve tek seferlik bir
  prefetch kaydı açar. `actions.ts`/`media-list.ts` yalnız İLK tüketimde
  kayıttan okur (`takePrefetch`), sonraki her gezinme/tazeleme normal
  `/api` yolundadır. Tohumun bir alanı eksikse o ekran sessizce istemci
  yoluna düşer — SSR hız iyileştirmesidir, sert bağımlılık değildir.
- `client:only="react"` prop serileştirmesiyle taşınır; workerd SSR'da
  `document` yokluğu deseni (0001) bozulmaz.

## Sonuçlar

- Derin bağlantı açılışında istemci ağ turu 5'ten 1'e iner (yalnız
  `git/commits`; `selectSite`'ın genel-bakış alışkanlığı).
- Bootstrap'ın site çözme/`localStorage` tercihi mantığı AYNEN çalışır:
  tohumdaki site ile kullanıcı tercihi farklıysa ada normal yoldan tarar.
- 0005'in "elle atom-önbellek yok" ilkesi bozulmaz: tohum yalnız
  queryClient/örnek-öncesi ilk veri besler; sunucu-state sahipliği
  TanStack'te kalır.
