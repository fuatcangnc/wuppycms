# Karar Kayıtları (ADR)

Bu dizin `docs/adr/`, mimari kararların *neden* alındığını kalıcılaştırır.
Numara sırasıyla eklenir; bir karar değiştiğinde eski kayıt silinmez,
`Durum: Superseded by NNNN` ile yeni kayda bağlanır.

| #   | Karar                                                            |
| --- | ---------------------------------------------------------------- |
|     | [0001](0001-admin-single-react-island.md) Admin tek React adacığı |
|     | [0002](0002-bejamas-react-port-policy.md) Bejamas UI port politikası |
|     | [0003](0003-admin-url-scheme.md) Admin URL düzeni                 |
|     | [0004](0004-kumo-theme-tokens.md) Kumo mavisi tema bileşenleri    |
|     | [0005](0005-react-router-url-state.md) react-router + URL-durum + TanStack Query |
|     | [0006](0006-oss-core-cloud-split-repo-lifecycle.md) WuppyCMS(OSS)/Wryte(bulut) ayrımı + repo-tabanlı yaşam döngüsü |
|     | [0007](0007-ssr-boot-seed.md) Açılış verisi Astro SSR'den (boot seed) |
|     | [0008](0008-admin-ai-widget.md) Admin AI widget: repo araçları + preview köprüsü |
|     | [0009](0009-brand-wuppycms.md) Marka adı: WuppyCMS |
|     | [0010](0010-site-industrial-design.md) Site şablonu: endüstriyel tasarım |
|     | [0011](0011-agent-insert-position.md) Ajan: öncesine/sonrasına ekleme + skeleton |
|     | [0012](0012-agent-soft-preview.md) Ajan önizlemesi: HMR kapalı + yumuşak yenileme |
|     | [0013](0013-agent-live-status.md) Ajan canlı durum: süre, Thinking, çağrı grubu |
|     | [0014](0014-agent-fast-edit.md) Ajan hızlı düzenleme + hedef ölçüsünde skeleton |
|     | [0015](0015-agent-message-queue.md) Ajan mesaj kuyruğu |
|     | [0016](0016-agent-undo-state.md) Ajan Undo: tek istek, kalıcı durum, F5'siz önizleme |
|     | [0017](0017-with-ai-site-builder.md) “With AI” site builder |
|     | [0018](0018-wuppycms-technical-identifiers.md) Teknik kimlikler: WuppyCMS |
|     | [0019](0019-github-app-repo-access.md) GitHub App ile repo erişimi |
|     | [0020](0020-generated-site-github-pages.md) Üretilen sitelerin yayını: GitHub Pages (superseded) |
|     | [0021](0021-generated-site-cloudflare-pages.md) Üretilen sitelerin yayını: Cloudflare Pages (superseded) |
|     | [0022](0022-generated-site-deploy-targets.md) Üretilen sitelerin yayını: AWS + müşterinin Cloudflare hesabı |

Not: 0001–0009 kayıtları marka değişikliğinden (0009) önce yazıldığı için
metinlerinde eski marka adı geçebilir; kararlar tarihseldir.

Not: `.opencode/skills/wuppycms-git-cms/structure.md`indeki `src/islands/` ve
`src/stores/` klasör önerileri 0001 ile bilinçli olarak geçersiz kılınmıştır.
