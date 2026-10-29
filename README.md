# WuppyCMS

AI + git tabanlı site kurucu monorepo'su. Ürün blueprint'i (mimari, klasör yapısı,
tasarım dili ve değiştirilemez kurallar) şurada yaşar:

> **`.opencode/skills/wuppycms-git-cms/`** — çalışmaya başlamadan önce okuyun.

## Yerleşim

| Yol | Ne |
| --- | --- |
| `apps/builder/` | Ana ürün: sohbet + önizleme + CMS (Astro, Workers'ta) |
| `apps/site-template/` | Müşteri projesi iskeleti; endüstriyel Astro + Tailwind 4 + Bejamas tasarımı |
| `packages/content-schema/` | İçerik alan şemaları (builder formu + site ortak) |
| `packages/shared/` | Paylaşılan tipler ve sabitler |
| `docs/adr/` | Mimari karar kayıtları |
| `docs/gitcms-parity.md` | GitCMS özellik paritesi: ekran ekran döküm + WuppyCMS eşlemesi + faz planı |
| `e2e/` | Playwright E2E: izole mock ortam, page object, spec'ler — `e2e/README.md` |
| `DESIGN_SYSTEM.md` | Global tasarım sözleşmesi (admin + site); token kaynakları `global.css` |
| `apps/site-template/DESIGN_SYSTEM.md` | Müşteri sitesi tasarım sistemi (token'lar, Bejamas, Tailwind 4) |

## GitHub App

Repo erişimi GitHub App installation token'larıyla yapılır (ADR 0019); müşteri
token kopyalamaz. App'in GitHub tarafındaki ayarları (bir kez):

- **Setup URL:** `https://app.wuppycms.com/api/github/app/setup`
- **Webhook URL:** `https://app.wuppycms.com/api/github/app/webhook`
  (`GITHUB_APP_WEBHOOK_SECRET` ile aynı secret)
- **İzinler:** Contents (RW), Administration (RW — repo oluşturma/silme),
  Pull requests (RW), Metadata (R), Actions/Workflows (RW — üretilen sitenin
  CI'ı). Pages (RW) gerekmez: üretilen siteler Cloudflare Pages'te yayınlanır
  (ADR 0021); `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` gerekir
- **Env:** `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_B64` (PEM'in ya da DER'in
  base64'ü), `GITHUB_APP_SLUG`, `GITHUB_APP_WEBHOOK_SECRET`

Kurulum dönüşünde `/api/github/app/setup` installation'ı oturumdaki kullanıcıya
bağlar; `installation` silme webhook'u kaydı temizler. Yerelde GitHub App
yerine `GITHUB_TOKEN` kullanılabilir (E2E bu yolu kullanır).

## Komutlar

```bash
pnpm install        # tüm workspace
pnpm dev            # builder geliştirme sunucusu
pnpm build          # hepsini derle
pnpm test:e2e       # Playwright E2E (izole mock ortam, port 4444)
```

## Akış ve rotalar

Giriş akışı: `/` → `/login` / `/signup` → `/projects` → `/admin` (CMS).

`/admin` sol menüsünde siteler ve **koleksiyon menüleri** durur; ham dosya
ağacı gösterilmez. Koleksiyonlar, bağlı reponun `src/content.config.ts`
dosyasından `@wuppycms/content-schema` ile ÇALIŞTIRMADAN çözümlenir; formlar
Zod alan tiplerinden üretilir (string→input, date→date picker, boolean→onay,
enum→seçim, array→virüllü liste). Her kayıt/silme/oluşturma GitHub'da gerçek
bir commit'tir.

| API | Ne |
| --- | --- |
| `GET /api/content/schema` | `content.config.ts` → koleksiyon + alan tanımları |
| `GET /api/content/entries` | koleksiyondaki dokümanlar (frontmatter özeti) |
| `POST /api/content/entry` | şema varsayılanlarıyla yeni doküman commit'i |
| `POST /api/git/commit` | çok dosyalı commit / silme (editör kaydı) |
| `GET/POST/DELETE /api/projects` | kullanıcı ↔ repo bağları (D1) |
| `GET /api/pages` | `src/pages` altındaki .astro/.md/.mdx/.html sayfaları |

## Astro sayfaları (src/pages)

Kenar çubuğunda **pages** ağacı `src/pages` altındaki `.astro`, `.md`, `.mdx` ve
`.html` dosyalarını klasörleriyle gösterir. Bir dosyaya tıklamak **Monaco
Editor** tabanlı kaynak editörünü açar (`/admin/{site}/pages/{yol}`);
Kaydet gerçek bir commit'tir
(`cms: src/pages/... güncellendi (via WuppyCMS)`). Dosya sizde açıkken başka
yerde değişirse SHA kontrolü üzerine yazmayı engeller.

## Site ayarları (sayfa)

Site ayarları **modal değil, sayfa** olarak açılır: `/admin/{site}/settings`.
Sol menüdeki **Site settings** ve genel bakıştaki düğme aynı adrese gider;
sayfa yenilenebilir, paylaşılabilir ve geri/ileri düğmeleriyle gezilebilir.
Kaydet = `.wuppycms/sites.jsonc` commit'i; üyeler bölümü davet üretir.

`/cms` eski adresi `/admin`'e yönlendirir.

## AI widget (ADR 0008)

Admin'in sağ altındaki **AI** düğmesi, git tabanlı ajanı açar: canlı önizleme
(canvas), element seçici, sohbet/oturum geçmişi, araç grupları, model seçici,
durdurma ve geri alma. Ajan dosya ve içerik araçlarıyla **müşterinin reposuna**
yazar; her yazma `(via WuppyCMS)` ile biten gerçek bir commit'tir. Sağlayıcı
(OpenAI-uyumlu, Gemini, Anthropic) **Admin → Ajan → Sağlayıcı**'dan ayarlanır.

Element seçici, müşteri sitesindeki `WuppycmsBridge.astro` köprüsüyle
`postMessage` üzerinden çalışır; köprü yoksa seçici devre dışıdır, ajan açık
doküman + sayfa bağlamıyla çalışmaya devam eder. Ayrıntı: `docs/agent-widget.md`.

# wuppycms
