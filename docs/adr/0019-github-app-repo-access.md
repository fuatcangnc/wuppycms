# 0019 — GitHub App ile repo erişimi

Durum: Kabul edildi (2026-10-29)

## Bağlam

İlk sürümde git işlemleri, GitHub OAuth girişiyle alınan `repo` kapsamlı
kullanıcı token'ına (ya da geliştirmede `GITHUB_TOKEN`'a) bağlıydı. Bu model
müşteriden geniş yetki ister, kurumsal hesaplarda kullanılamaz ve token'ların
yenilenmesi/saklanması gibi işletim yükü getirir. WuppyCMS'in vaadi “müşteri
token yönetmez”; bunun için GitHub'ın önerdiği yol GitHub App kurulumudur.

## Karar

1. **Repo erişimi GitHub App üzerinden.** App, kurulduğu hesabın seçili (ya da
   tüm) repolarına kısa ömürlü installation access token'ı ile erişir.
   Installation token'ları DB'ye yazılmaz; isolate belleğinde süresi dolana
   kadar cache'lenir (`lib/git/github/app.ts`).
2. **Kimlik çözüm sırası** (`api/helpers.ts` → `resolveGitAuth`):
   - Repo sahibine ait bir kurulum varsa installation token'ı,
   - yoksa `GITHUB_TOKEN` (yalnız geliştirme/E2E),
   - yoksa OAuth kullanıcı token'ı (geriye dönük uyumluluk).
3. **Kurulum kaydı.** `/api/github/app/install` imzalı `state` üretir; GitHub
   setup dönüşünde `/api/github/app/setup` installation'ı `github_installations`
   tablosunda kullanıcıya bağlar. Webhook (`installation.deleted`) kaydı siler.
   State doğrulanamazsa (eski kurulum/yerel) kurulum yine bağlanır.
4. **Repo listesi.** `/api/git/repos` kurulum repoları ile OAuth repolarını
   birleştirir ve tekrarsız döner; her satır `source: "app" | "oauth" | "env"`
   taşır. Projects ekranı kurulum yoksa “GitHub App'i kur” kartını gösterir.
5. **With AI repo üretimi.** Kişisel hesapta repo açmak OAuth kullanıcı
   token'ı gerektirdiğinden önce OAuth denenir; hedef bir organizasyon
   kurulumuysa installation token'ı kullanılır. Hedef hesap istemcide seçilir.
6. **Cron.** Zamanlanmış yayın, proje sahibinin repo sahibine ait kurulum
   token'ını kullanır; kurulum yoksa OAuth token'ına düşer.

## Sonuçlar

- Müşteri token kopyalamaz; erişimi GitHub üzerinden istediği an daraltır ya
  da kaldırır. Kurulum silinince webhook kaydı temizler.
- Organizasyon repoları için installation token'ı, kişisel repolar için OAuth
  token'ı gerekir; iki yol da aynı `resolveGitAuth` sözleşmesinden geçer.
- `GITHUB_APP_PRIVATE_KEY_B64`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG` ve
  `GITHUB_APP_WEBHOOK_SECRET` her ortamda ayrı yapılandırılır (local/live).
- App'in izinleri: Contents (RW), Administration (RW — repo oluşturma),
  Pages (RW), Pull requests (RW), Metadata (R). Eksik izin, ilgili uçta
  anlaşılır bir GitHub hatası olarak yüzeye çıkar.
