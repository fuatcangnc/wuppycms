# 0021 — Üretilen sitelerin yayını: Cloudflare Pages

Durum: Kabul edildi (2026-10-29) — 0020'yi geçersiz kılar; 0022 tarafından geçersiz kılındı

## Bağlam

0020, üretilen siteleri GitHub Pages'e gönderiyordu. Ancak GitHub Actions,
hesapta ödeme/billing kilidi olduğu için job başlatmıyor; ayrıca her müşteri
reposunda Actions kotası/izi ayrı bir bağımlılık. WuppyCMS zaten Cloudflare
hesabına sahip; siteleri Cloudflare Pages'te barındırmak daha doğal.

## Karar

1. **Her üretilen repo için bir Cloudflare Pages projesi** açılır
   (`wuppy-<owner>-<repo>-<hash>`, deterministik). Proje GitHub deposuna
   bağlanır; Cloudflare kendi build runner'ında `pnpm build` çalıştırır
   (`dist` çıktısı, Node 22).
2. **URL sabittir:** `https://<proje>.pages.dev`. Proje adı commit'ten önce
   bilindiği için `astro.config.mjs` `site` alanı ve `.wuppycms/sites.jsonc`
   `url` alanı bu adresle yazılır.
3. **Deploy tetikleme:** içerik commit'inden sonra
   `POST /pages/projects/<ad>/deployments {branch}` çağrılır. Push webhook'u
   ayrıca tetikler; iki yol da aynı commit'i derler.
4. **GitHub Actions kullanılmaz.** Şablon repo'sundaki workflow'lar kaldırıldı;
   böylece billing kilidi üretilen siteleri etkilemez.
5. **Kimlik:** öncelik `CLOUDFLARE_API_TOKEN` (Pages:Edit). Yoksa yerel
   `wrangler` OAuth yenileme token'ı (`CLOUDFLARE_OAUTH_REFRESH_TOKEN`) ile
   access token alınır ve isolate belleğinde cache'lenir.
6. **Hata durumu:** Pages projesi kurulamazsa site URL'siz kalır; sahte bir
   GitHub Pages adresi yazılmaz. Build yine başarılıdır (repo kullanılabilir).

## Önizleme köprüsü

`*.pages.dev` bazı ağlarda (ör. TR ISP'leri) çözümlenmiyor. Bu yüzden
`/preview/<proje>/*` route'u Pages çıktısını admin ile aynı origin'den proxy'ler
ve HTML/CSS içindeki kök göreli URL'leri önekle yeniden yazar. `.wuppycms/
sites.jsonc` içindeki `url` bu erişilebilir önizleme adresidir; kanonik site
adresi (`astro.config.mjs site`) `pages.dev` olarak kalır.

## Sonuçlar

- Üretilen site, Cloudflare'in ücretsiz build kotasıyla yayınlanır; müşteri
  GitHub Actions ödemesi yapmak zorunda değildir.
- Cloudflare'in GitHub App'i, hedef hesabın reposuna erişebilmelidir. Kendi
  hesabımızda kurulu; yeni müşteri hesaplarında Cloudflare GitHub App kurulumu
  gerekebilir (WuppyCMS App kurulumuna ek bir adım).
- API token yoksa/expired ise site URL'siz kalır; log'da uyarı görünür.
- Preview deployment'lar Cloudflare tarafından yönetilir; WuppyCMS yalnızca
  production URL'sini bilir.
