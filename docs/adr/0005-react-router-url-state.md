# 0005 — Yönlendirme react-router'da, veri TanStack Query'de (URL = durum)

Durum: Kabul edildi (0003'ü geçersiz kılar)

## Bağlam

0003'teki elle yazılmış History API yönlendiricisi çalışıyordu ama bakım
yükü yüksekti: geçmiş kapıları (`ready`/`pendingUrl`), abone senkronu ve
adres-üretimi tek dosyada yaşıyordu. Sektör standardı (react-router +
URL-parametrelerini-durum-yapma deseni) aynı yetenekleri daha az özel kodla
veriyor; ayrıca sunucu verisi (GitHub API) için elle atom-yönetimli önbellek
yerine ortak bir sunucu-state katmanı gerekiyordu.

## Karar

- **react-router-dom v7** (data router) history'nin tek sahibidir; route
  tablosu `/admin/*` biçimlerini taşır. Adres SÖZLEŞMESİ saf `url.ts`
  içindedir (`parseAdminPath` + `viewUrl`; testler orada).
- **URL tek doğruluk kaynağıdır**: `$view/$collection/$mediaFolder/…`
  atomları artık adresten türeyen projeksiyonlardır — `RouteApplier`
  (location → mağaza) uygular, iş katmanı yalnız `goTo()` ile adrese yazar
  (`navigate.ts`). Action iptalinde (discard onayı) adres hiç kıpırdamaz;
  popstate iptalinde kanonik adrese `replace` ile dönülür.
- **Tembel router**: workerd SSR'da `document` yoktur ve `client:only`
  adacıkların modülleri sunucuda import edilir; `createBrowserRouter` modül
  kapsamında ÇAĞRILAMAZ. Örnek `getAdminRouter()` ile ilk istemci
  render'ında kurulur ve adacık `client:only="react"` ile bağlanır.
- **@tanstack/react-query** sunucu-verisi okumalarını taşır: medya
  "kullanılan yer" taraması, commit tarihi, proje ve repo listeleri.
  Sekme/diyalog yeniden açılınca önbellekten gelir; mutasyon sonrası
  `invalidateQueries`. Doküman editörü ve giriş akışı (baseSha'lı
  git-commit hattı) bilinçli olarak store'da kalır; kademeli geçiş sürer.
- Eski adres biçimleri (0003'ün yükü) okunur ve ilk uygulamada kanonik
  biçime normalize edilir.

## Sonuçlar

- Geçmiş yönetimi, `Link`/`useLocation` ekosistemi ve gelecekteki
  loader/middleware seçenekleri bedavaya gelir; özel `sync()/ready` kodu silindi.
- İş katmanı bileşenlere dokunmadan çalışır (bileşenler store okumaya devam
  eder); tek yeni kural: gezinmek isteyen action `goTo()` çağırır.
- URL sözleşmesi değişirse tek yer `url.ts` ve tek test dosyasıdır.
