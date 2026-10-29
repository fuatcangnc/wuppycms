# Sveltia CMS İncelemesi — OSS kod tabanı nasıl ele alınmış?

**Kaynak:** `.opencode/skills/sveltia-cms-main` (MIT, sürüm 0.242.0)
**Amaç:** SitePins modelindeki WuppyCMS (OSS) + Wryte (bulut) ayrımı için Sveltia'nın
kod tabanı organizasyonunu çözmek; bizim yığına (Astro/React/Hono/D1/R2) dokunmadan
uyarlanabilir desenleri çıkarmak. Bu dosya referanstır; bağlayıcı karar değildir.

Ölçek: ~840 kaynak dosya, ~380 test dosyası, 9.300+ test. Svelte 5 (runes) + Vite 8 +
Vitest 5 + Playwright, Node 26, pnpm-only. Tek yazar + topluluk (l10n ağırlıklı).

---

## 1. Katman mimarisi: "components sadece UI, services iş mantığı"

```
src/lib/
├── components/   # Svelte UI (app.svelte kök) — markup/ARIA/binding/event'ten fazlası yasak
├── services/     # TÜM iş mantığı ve veri (plain modüller + .svelte.js reaktif state)
│   ├── app/ assets/ api/ backends/ config/ contents/ deployments/
│   ├── integrations/ search/ user/ utils/
├── types/        # JSDoc/TS tipleri MERKEZİ olarak burada (private.js / public.js)
├── locales/      # i18n YAML'ları
└── main.js       # giriş: window.CMS + window.initCMS + React interop
```

Kurallar (CLAUDE.md'de yazılı ve uygulanıyor):
- **Bileşen testi yazmadan önce mantığı servise çıkar**; bileşen testi sadece kalanı
  (markup, ARIA, binding, event) doğrular.
- Tipler tek merkezde (`types/public.js` = kullanıcıya dönük config tipleri,
  `types/private.js` = iç tipler); dosyalar JSDoc ile tiplenir.
- Test dosyaları kaynağın yanında (`*.test.js`), ayrı test klasörü yok.

**Bizde karşılığı:** `src/lib/admin/*` zaten servis katmanı; ama `types` merkezileştirmesi
ve "bileşen testi öncesi mantığı çıkar" kuralı bizde yazılı değil. Uyarlanabilir.

## 2. Backend soyutlaması (en değerli desen)

- Tek sözleşme: `BackendService` typedef (`src/lib/types/private.js:356`).
  Metotlar: `init, signIn, signOut, fetchFiles, fetchLastCommit, fetchBlob,
  fetchDirSHA, commitChanges, triggerDeployment, fetchBranchHeadSHA,
  fetchDeployments, fetchFileCommits` + opsiyonel `workflow` alt servisi
  (PR tabanlı editör akışı: `fetchPullRequests, savePullRequest, updateStatus,
  fetchBranchHead, fetchMergeState`).
- Kayıt defteri: `allBackendServices = { ...gitBackendServices, local, 'test-repo' }`
  (`services/backends/index.js`). `unsupportedBackends` (azure/bitbucket/git-gateway)
  "neden yok" gerekçesiyle listelenir — sessiz eksik yok.
- **Provider paylaşımı:** `backends/git/shared/` (commits, files, tree, parse-files,
  file-cache, reconcile, head, scope, managed-paths...) + `github/ gitlab/ gitea/`
  klasörleri yalnız provider'a özgü API'yi tutar (auth, graphql, pull-requests, fork...).
- **Decorator:** `scopeBackendService()` (`git/shared/scope.js`) tüm yolları `root_dir`
  seçeneğine göre sarar — her backend kendi içinde yol bilmez.
- `managed-paths.js`: CMS'in yönettiği klasörler (koleksiyon + medya) hesaplanır;
  backend'ler tüm repoyu değil sadece bu alt kümeyi listeler (büyük repo performansı).
- `fs/local` (File System Access API — yerel repo) ve `fs/test` (**OPFS** — e2e deposu)
  git backend'lerinin sarmalayıcısıdır; e2e bununla ağsız çalışır.
- Yerel durum: repo başına IndexedDB (`utils/database.js`) → `file-cache` (SHA takibi:
  "benim değişikliğim mi, başkasının mı") + UI ayarları.

**Bizde karşılığı:** `lib/admin/git-write.ts` + `media-write.ts` fonksiyon demeti var ama
sözleşme yok; `root-dir` benzeri yol kapsamı `repos/meta.json` tarafında dağınık.
Uyarlama: `BackendService` benzeri TS arayüzü + shared/provider ayrımı + scope sarmalayıcı.

## 3. Config: drop-in uyumluluk + şema doğrulama

- Netlify/Decap CMS `config.yml` **birebir drop-in**; migrasyon rehberleri sitede.
- Doğrulama: JSON Schema draft-07 (`config/schema/draft-07.json` + `validator.js` +
  `transform.js` + `custom-fields.js`); hata toplama "kullanıcıyı asla dışarıda bırakma"
  ilkesiyle: beklenmedik hata doğrulamayı atlar, config yine yüklenir.
- Parser alan-başına modüllere bölünmüş: `backend.js, collections/, fields/, media.js,
  i18n.js, slug.js, publish-mode.js, root-dir.js, deprecations.js` (deprecated seçenek →
  uyarı + yeni karşılık eşlemesi).
- `constants.js` varsayılanların tek merkezi.

**Bizde karşılığı:** `repos/meta.json` şu an serbest biçim; OSS sürümünde
`wuppycms.config.yml` + şema doğrulama + deprecations kaydı aynı desenle kurulabilir.

## 4. İçerik modeli: draft bellekte, repo tek gerçek kaynak

- `contents/` alt bölümleri: `draft/` (taslak yaşam döngüsü), `entry/` (changes,
  key-paths, per-entry, relations, subtree, values), `fields/` (21 yerleşik alan tipi:
  boolean, code, color, compute, custom, datetime, file, hidden, image, keyvalue, list,
  map, markdown, number, object, relation, richtext, select, string, text, uuid),
  `file/` (parse/serialize, array formatları), `i18n/`, `collection/`, `editor/`.
- **Taslak = bellekte reaktif nesne** + `draft/backup.js` ile IndexedDB'ye periyodik
  yedek (tarayıcı çökerse iş kaybolmaz). Repoya yazma yalnız `save/` ile; taslak
  "pending" durumu `pending-entries.js`'te tutulur.
- **Zamanlanmış yayın YOK** — Sveltia'da scheduling yok (grep doğruladı); yayın akışı
  Editorial Workflow = PR/dal + etiket (`draft/pending_review/pending_publish`).
  Bu, ADR 0006'daki repo-tabanlı `publishAt` + cron modelimizi doğruluyor: lider OSS
  git-CMS'te bile içerik durumu sunucu veritabanına girmiyor.
- Zengin metin: Lexical tabanlı `TextEditor` **UI kit paketinde** (`@sveltia/ui`);
  uygulama sadece modları (rich_text/raw) ve sanitize/preview işini yönetir.

**Bizde karşılığı:** P1'deki frontmatter paneli için alan-tipi kayıt defteri deseni
birebir uygun (tip → widget eşlemesi; widget'lar Bejamas portları olacak).
Taslak IndexedDB yedeği bizde yok → kayıpsız autosave borcu listesine girer.

## 5. e2e stratejisi: ağsız, deterministik, sahte backend'ler

- Playwright, **üretim paketi** üzerinde koşar (dev sunucusu isteğe bağlı `E2E_TARGET=dev`).
- Her test kendi config'ini route kesme ile servis eder; varsayılan backend
  **`test-repo` (OPFS)** → tarayıcı deposunda gerçek dosya sistemi, tamamen offline.
- `MockGitHub` / `MockGitLab` / `MockGitea` (`e2e/fixtures/`): bellek-içi repo; dal, PR,
  etiket, fork, rate-limit, OAuth scope, çakışan commit reddi... Gerçek API sözleşmesi
  taklit edilir; "mock'un cevaplayamadığı istek testi düşürür" → kapsam kendiliğinden büyür.
- Alan-özel fixture: `cms.open() / seed() / signIn() / readRepo()` — test, Save'in
  yazdığını dosya düzeyinde geri okur.
- Disiplinler: **"(known issue)" testleri** (hatalı davranışı sabitleyen, düzeltilince
  düşen test — `test.fail()` yasak), `page.clock` ile saat sabitleme, bidi izolat
  farkındalığı, shard'lı CI (unit 3x, component 3x, e2e 6x; e2e build artifact'ı bekler).
- Bench ayrı: `bench/` Playwright ile 5000 entry / 300 asset senaryoları; %10 veya 5ms
  altı gürültü sayılır; **CI'da koşmaz** (makineye bağlı).

**Bizde karşılığı (en kritik uyarlama — UYGULANDI):** e2e-media.mjs artık varsayılan
olarak sahte GitHub sunucusuyla (`scripts/lib/mock-github.mjs`) ağsız koşar: 52/52
kontrol tek gerçek istek gitmeden geçer; `--real` yalnız entegrasyon doğrulaması için.

## 6. Dağıtım/paketleme (SitePins modelinin teknik karşılığı)

- Tek `vite build` → `package/dist/sveltia-cms.js` (IIFE) + `sveltia-cms.mjs` (ESM) +
  lazy chunk'lar (ör. `react-dom` yalnız gerekince). CSS bundle'ın içinde; harici
  stylesheet **uyarıyla reddedilir** (`main.js` içinde açık kontrol).
- `publishConfig.directory = package` + `prepublishOnly: vite build` → npm'e sadece
  dağıtım klasörü gider. CDN'den sürüm sabitlenerek çalıştırılır.
- Kendi sunucusuna kuran: 2 dosya + `config.yml` (drop-in). Yani **OSS ürünü = tek
  gömülebilir bundle + config dosyası**; site uygulaması ayrı.
- Locale dosyaları bundle'dan ayrı, CDN'den isteğe bağlı; sürüm kontrolü CDN'e karşı.
- Release → `npm-publish.yml`: `--provenance` + **id-token'sız ayrı job**'da Discord
  bildirimi (yetki ayrımı güvenlik deseni).

**Bizde karşılığı:** WuppyCMS OSS dağıtımı bu şekilde olmalı: `dist/wuppycms.js` (IIFE+ESM)
+ `wuppycms.config.yml`; Wryte ise aynı çekirdeğin barındırılmış yüzü.

## 7. Public API + uyumluluk katmanı (ekosistem deseni)

- `services/api/` tek kararlı yüzey: `init, registerFieldType, registerPreviewTemplate,
  registerEditorComponent, registerCustomPage, registerEventListener, renderRichText,
  registerCustomFormat, registerStringTransformation, getFieldType` (`window.CMS`).
- **Proxy + `compatibility.js`:** Decap'te olup Sveltia'da olmayan fonksiyon çağrılırsa
  hata değil **uyarı** loglanır (`UNSUPPORTED_FUNC_NAMES`) → "drop-in" iddiası kodda.
- React gömülü; custom widget için `SHARED_REACT_KEY` ile tek örnek paylaşılır
  (kullanıcının kendi React'i kopya oluşturmasın).

**Bizde karşılığı:** OSS lansmanında `window.WuppyCMS` benzeri kararlı API + Decap
uyumluluk proxy'si; plugin/extension ekosisteminin ön koşulu.

## 8. i18n süreci

- `src/lib/locales/` dosya-başına-dil YAML; yalnız `en-US` gömülü, diğerleri CDN'den
  lazy (Vite dosya adlarından `VITE_APP_LOCALES` enjekte eder; kayıt gerekmez).
- `scripts/check-locales.js` CI'da: MF2 söz dizimi, placeholder eşleşmesi, çoğul
  kategorileri, stale key'ler. Firefox l10n dil kodu kuralları; katkı süreci issue
  ataması + iki dosya (CMS + UI kit ayrı ayrı) + "PR sadece l10n dosyasını değiştirir".
- Kaynak dil (`en-US`) anahtar ve anlamın tek doğrusu; eksik anahtar İngilizce'ye düşer.

## 9. OSS yönetişimi ve kalite

- CONTRIBUTING: PR politikası (şu an yalnız l10n + ufak düzeltme; UI framework kararı
  sonrası gözden geçirilecek), "AI üretimi kalitesiz PR'lar engellenir" duruşu açıkça
  yazılı; docs repo dışında (sveltiacms.app), showcase + llms.txt + Agent Skill pazarlama
  ve AI çağı erişilebilirliği için.
- CI: Check (eslint + prettier + stylelint + svelte-check + oxlint + cspell +
  **özel unused-imports script'i**) + testler shard'lı + build. `patches/` ile tek
  bağımlılık yaması (Lexical tablo) — gerekince yamalamak meşru.
- CLAUDE.md ~110 satır: komutlar, mimari haritası, CI, iş akışı (önce düşen test,
  `/code-review` döngüsü, backend dokunuşunda `/security-review`, commit trailer yasağı),
  l10n PR kontrol listesi, konvansiyonlar (import sırası, JSDoc tip, prose kuralları),
  test incelikleri (bileşen testi tarifi, coverage gerekçeleri).

---

## Bize uyarlanacaklar (yığına dokunmadan)

| # | Uyarlama | Nereye | Öncelik |
|---|----------|--------|---------|
| 1 | Sahte GitHub backend'i + bellek-içi repo ile ağsız E2E — **UYGULANDI** (`scripts/lib/mock-github.mjs`, medya paketi 52/52 ağsız; varsayılan mod) | `scripts/e2e-*.mjs` altyapısı | Yüksek |
| 2 | `BackendService` sözleşmesi + provider ayrımı + scope sarmalayıcı — **UYGULANDI** (`lib/git/backend.ts` + `lib/git/github/` + kayıt defteri/facade; testli) | `lib/admin/` | Yüksek |
| 3 | "(known issue)" test konvansiyonu + saat sabitleme disiplini — **UYGULANDI** (`docs/e2e-conventions.md`) | E2E + AGENTS.md | Orta |
| 4 | Alan-tipi kayıt defteri (tip → widget) — **UYGULANDI** (`lib/admin/fields.ts`; DocView + form.ts buradan türetir) | P1 frontmatter paneli | Yüksek |
| 5 | IndexedDB taslak yedeği (kayıpsız autosave) — **UYGULANDI** (`lib/admin/draft-backup.ts` + DocView bandı + `e2e-draft-backup.mjs` 13/13) | P0 editör işi | Yüksek |
| 6 | JSON şema doğrulamalı config + deprecations kaydı | OSS `wuppycms.config.yml` | Orta (OSS öncesi) |
| 7 | Drop-in bundle + config dağıtımı (IIFE+ESM, publishConfig.directory) | OSS lansmanı | OSS öncesi |
| 8 | Kararlı public API + uyumluluk proxy'si (Decap uyumu) | OSS lansmanı | OSS öncesi |
| 9 | Bench harness (5000 entry / 300 asset, gürültü eşiği) | P3 pano öncesi | Orta |
| 10 | i18n süreci (en kaynak dil, check-locales script'i, l10n PR kuralları) | OSS lansmanı | OSS öncesi |
| 11 | Yönetişim dosyaları (CONTRIBUTING, llms.txt, Agent Skill, cspell) | OSS lansmanı | OSS öncesi |
| 12 | "Bileşen testi öncesi mantığı servise çıkar" kuralının yazılı hâli | `AGENTS.md` | Düşük |

**Uyarlanmayacaklar (bilinçli):** Svelte runes/JSDoc tip modeli (biz TS strict),
Lexical (bizde mdxeditor direktifi), PR-tabanlı Editorial Workflow (bizde repo
frontmatter + ADR 0006), OPFS deposu (bizim E2E tarayıcı otomasyonunda OPFS yerine
bellek-içi sahte API daha basit).
