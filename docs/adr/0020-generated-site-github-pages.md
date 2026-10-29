# 0020 — Üretilen sitelerin yayını: GitHub Pages

Durum: Kabul edildi (2026-10-29)

## Bağlam

“With AI” akışı müşterinin GitHub hesabında standart bir Astro reposu üretiyor,
ancak üretilen sitenin canlı bir adresi yoktu: admin’deki önizleme bağlantısı
`.wuppycms/sites.jsonc` içindeki `url` alanına dayanıyor, bu alan da yalnızca
GitHub Pages açılabildiyse yazılıyordu. GitHub App’in Pages izni olmadan
`POST /repos/{owner}/{repo}/pages` çağrısı 403 dönüyor; müşteriden ek izin
istemek istemedik.

## Karar

1. **Şablon repo’su GitHub Pages’e deploy eden bir workflow taşır**
   (`.github/workflows/deploy.yml`): `actions/configure-pages@v5`
   (`enablement: true`) → build → `upload-pages-artifact` → `deploy-pages`.
   Böylece Pages sitesi ilk push’ta workflow token’ıyla açılır; App’in Pages
   izni zorunlu değildir.
2. **`build.ts` yine de dener.** Repo oluşturan token, diğer aday token’lar ve
   sunucu token’ı sırayla `enablePages` çağırır; biri başarılı olursa site
   hemen açılır, olmazsa public repolarda workflow devralır.
3. **URL public repolarda baştan yazılır** (`https://<owner>.github.io/<repo>/`).
   Private repolarda ücretsiz plan GitHub Pages vermediği için `url` yazılmaz;
   site önizlemesi o repolarda yoktur (ileride Cloudflare Pages/Workers
   hedefi ayrı bir ADR).
4. **Proje sayfası / kullanıcı sayfası ayrımı** korunur: `<owner>.github.io`
   reposunda `base: "/"`, diğerlerinde `base: "/<repo>/"`.

## Sonuçlar

- Public repo ile üretilen site, ilk Actions koşusunda canlıya çıkar; müşteri
  ek bir izin vermez.
- Private repolarda otomatik URL yoktur; bu bilinçli bir sınırlama olarak
  arayüzde ve `sites.jsonc`’de görünür.
- Actions ücretsiz kotası public repolarda sınırsızdır; private repolarda
  müşterinin kotası kullanılır.
- GitHub Pages yalnızca statik Astro çıktısı içindir; sunucu tarafı gereken
  siteler bu yolu kullanamaz.
