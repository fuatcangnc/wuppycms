# 0022 — Üretilen sitelerin yayını: AWS (varsayılan) + müşterinin Cloudflare hesabı

Durum: Kabul edildi (2026-10-30) — 0021'i geçersiz kılar

## Bağlam

0021, üretilen siteleri WuppyCMS'in kendi Cloudflare hesabındaki Pages
projelerine gönderiyordu; build'i Cloudflare'in GitHub entegrasyonu yapıyordu.
İki sorun çıktı:

1. Her müşteri reposu için Cloudflare'in GitHub App'inin ayrıca kurulması ve
   repoya erişim verilmesi gerekiyordu; kurulum yoksa build sessizce düşüyordu
   ("The repository cannot be accessed").
2. Ürün hedefi, sitelerin **WuppyCMS altyapısında** yayınlanması ve müşterinin
   hiçbir şey kurmaması. Ayrıca bazı müşteriler kendi Cloudflare hesaplarında,
   kendi domainleriyle yayınlamak istiyor.

## Karar

1. **Varsayılan hedef AWS.** Tek S3 bucket (`wuppycms-sites`) + tek CloudFront
   dağıtımı; her site `sites/<slug>/` altında. `*.sites.wuppycms.com` wildcard
   sertifikası ve CloudFront Function (`Host` → `sites/<slug>/`) ile yönlendirme
   yapılır; bucket private, erişim OAC ile. Build, Lightsail VM'indeki
   `wuppycms-deploy` systemd worker'ında koşar: clone → `pnpm install` →
   `pnpm build` → `aws s3 sync`. Müşteri AWS hesabı açmaz.
2. **Cloudflare opsiyonel ve müşteri bazlı.** Müşteri kendi Cloudflare hesabını
   OAuth ile bağlar (`/api/deploy/cloudflare/connect`). Token'lar D1'de şifreli
   saklanır, her yenilemede refresh token döndürülür (rotation). Domain
   ayarları müşterinin zone'unda kalır; WuppyCMS domain yönetmez.
3. **Cloudflare'de direct upload.** Proje Git bağlantısı olmadan açılır; build
   yine WuppyCMS worker'ında koşar ve çıktı `wrangler pages deploy` ile
   müşterinin hesabına yüklenir. Böylece müşterinin Cloudflare GitHub App'ini
   kurması gerekmez.
4. **Önizleme her iki hedefte de aynı origin'den:** `/preview/<slug>/`.
   AWS'te doğrudan `sites.wuppycms.com`, Cloudflare'de `pages.dev` upstream'i
   proxy'lenir (TR ağlarında `pages.dev` çözümlenmeyebiliyor).
5. **Site adresleri repoya yazılır.** Her yayında `astro.config.mjs` içindeki
   `site` kanonik adrese, `.wuppycms/sites.jsonc` içindeki `url` önizleme
   adresine güncellenir (değişiklik yoksa commit atılmaz).

### Cloudflare OAuth istemcisi (operasyon notu)

- İstemci **public** ve domain doğrulaması yapılmış olmalı; private istemci
  yalnızca sahibi olan hesapta kullanılabilir.
- Yeni Cloudflare OAuth kapsam kimlikleri **nokta** ile ayrılır:
  `account-settings.read`, `user-details.read`, `page.write`. `pages:write`,
  `account:read`, `user:read` reddedilir (`invalid_scope`).
- Refresh token için istemcide **Refresh Token** grant'i açık olmalı ve
  yetkilendirme isteğinde `offline_access` istenmelidir.
- İstemci kimliği/sırrı `CLOUDFLARE_OAUTH_CLIENT_ID` /
  `CLOUDFLARE_OAUTH_CLIENT_SECRET` ortam değişkenlerinden okunur.

## Sonuçlar

- Müşteri hiçbir hesap/kurulum yapmadan siteyi `https://<slug>.sites.wuppycms.com`
  adresinde yayınlar; maliyet tek CloudFront + S3 + küçük bir VM'de kalır.
- Cloudflare'e yayınlamak isteyen müşteri yalnızca OAuth izni verir; build
  WuppyCMS'te kaldığı için iki hedefte de çıktı aynıdır.
- CloudFront önbelleği worker callback'inde geçersiz kılınır; Cloudflare'de
  wrangler yüklemeyi kendisi tamamlar.
- Özel domainler şu an WuppyCMS tarafından yönetilmiyor; AWS hedefinde
  `sites.wuppycms.com` alt alanı, Cloudflare hedefinde `pages.dev` kullanılır.
