# E2E (Playwright)

Bu klasör, **EmDash CMS'in e2e mantığının** (`emdash-main/e2e/`) WuppyCMS'ye
uyarlanmış hâlidir. Amaç aynı: testler geliştiricinin açık dev sunucusuna
değil, **izole ve kendi kendini kuran** bir ortama koşar.

```bash
pnpm test:e2e            # tüm suite (17 test)
pnpm test:e2e:ui         # Playwright UI modu
pnpm exec playwright test tests/settings.spec.ts:23   # tek test
pnpm exec playwright test --repeat-each 3             # kararlılık kanıtı
pnpm test:e2e:report     # son HTML raporu
```

## EmDash → WuppyCMS eşlemesi

| EmDash | Bu repoda |
| --- | --- |
| `playwright.config.ts` (kök) | aynı: `testDir: ./e2e/tests`, `workers: 1`, `fullyParallel: false` |
| `globalSetup` izole fixture + dev sunucusu başlatır | `e2e/global-setup.ts`; mock GitHub + dev sunucusu **4444**'te |
| Geçici DB (`EMDASH_TEST_DB`) | Kimlik izolasyonu: sabit harness kullanıcısı + idempotent `mock/site` projesi. İçerik zaten GitHub'da yaşar (ADR 0006) |
| `setup/dev-bypass` → oturum + PAT | `better-auth` e-posta/şifre → çerezler `.e2e/storage-state.json` |
| Seed (`.emdash/seed.json` + API) | `seedSite(mock)` (`scripts/lib/e2e-env.mjs`) + `POST /api/projects` |
| `warmUpAdmin()` (iki yükleme) | aynı: Vite/workerd soğuk derlemesi testin içine düşmesin |
| `globalTeardown` sunucuyu öldürür, temp'i siler | `e2e/global-teardown.ts`; `.e2e/server-info.json` + storage state silinir, **kanıt silinmez** |
| `e2e/fixtures/index.ts` → `admin`, `serverInfo` | aynı |
| `e2e/fixtures/admin.ts` → `AdminPage` page object | `e2e/fixtures/admin.ts` (WuppyCMS rotaları: `/admin/{site}/settings`, `/content/{col}`, …) |
| `e2e/tests/*.spec.ts` | `tests/smoke`, `auth`, `settings`, `content`, `agent-widget` |
| `trace: on-first-retry`, `screenshot: only-on-failure` | aynı |
| `reporter: html` / CI'da line+github+html | aynı |
| `acceptance/journeys/*.md` (UX kabul katmanı) | henüz yok; `create-verification-skill` ile eklenebilir |

## Akış

```
pnpm test:e2e
  └─ global-setup
       ├─ D1 migration (local, idempotent)
       ├─ scripts/lib/e2e-env.mjs → mock GitHub + astro dev (:4444)
       │    .dev.vars geçici çevrilir, çıkışta geri yüklenir
       ├─ seedSite()  → .wuppycms/sites.jsonc + src/content/blog/...
       ├─ sign-in     → .e2e/storage-state.json
       ├─ POST /api/projects { full_name: "mock/site" }
       └─ warmUpAdmin() (2× /admin)
  ├─ workers (1) → her test storageState ile açılır
  └─ global-teardown
       ├─ dev sunucusu durur, .dev.vars geri döner
       └─ server-info + storage-state silinir; .e2e/report kalır
```

## Test dosyaları (40 test)

| Dosya | Test | Kapsam |
| --- | --- | --- |
| `smoke.spec.ts` | 3 | Doktor: API sağlığı, oturum, admin kabuğu, kanonik adres |
| `auth.spec.ts` | 3 | Oturumsuz → `/login`; oturumlu → admin |
| `settings.spec.ts` | 4 | **Site ayarları sayfa** (modal değil), odak, kaydet → `sites.jsonc` commit'i |
| `content.spec.ts` | 3 | Blog listesi, doküman + mdxeditor, çöp görünümü |
| `entries.spec.ts` | 2 | Liste/pano/takvim URL'i; sil → çöp → geri yükle |
| `media.spec.ts` | 2 | Klasör, yükleme, alt metin, silme; arama + grid/list |
| `editor.spec.ts` | 5 | YAML/MD, snapshot + diff + sürüm yükleme, bul-değiştir + araştırma, taslak sekmeleri, IndexedDB yedeği |
| `review.spec.ts` | 1 | Send to review → PR → diff → approve → merge |
| `team.spec.ts` | 1 | Davet oluştur/listele/iptal |
| `ai-agent.spec.ts` | 2 | Mock sağlayıcıyla üretim; ajan LIST/WRITE + commit + Undo |
| `collections-embeds.spec.ts` | 2 | Add collection commit'i; YouTube embed |
| `navigation-i18n.spec.ts` | 6 | `/cms`, legacy `/admin/c/…`, derin bağlantı, site sihirbazı, tr/en açılış |
| `pages.spec.ts` | 2 | `src/pages` ağacı (.astro/.md/.mdx/.html), **Monaco** kaynak editörü, commit |
| `agent-widget.spec.ts` | 4 | Launcher/çekmece, boş durum, Esc, geçmiş rayı, köprü yokken seçici kapalı |

Suite model/anahtar gerektirmez: AI sağlayıcısı global setup'ta **mock
OpenAI-uyumlu uca** bağlanır; mock `/v1/chat/completions` hem non-stream
(üretim) hem SSE + tool-call (ajan) yanıtı verir. Yani ajan döngüsü, araç
grupları, commit ve Undo gerçek tarayıcıda ama ağsız sınanır.

Doğrulama: `pnpm test:e2e` → **40/40**; `--repeat-each 2` → **80/80**.

## Yeni test yazma

1. `e2e/fixtures`ten `test` ve `expect` içe aktar; `admin` page object'ini kullan.
2. Ekranın yolundan başla (`admin.goToSettings()`), ana sayfadan tıklayarak gitme.
3. Veri gerekiyorsa API ile oluştur (EmDash `test.extend` fixture deseni) ve
   test sonunda temizle.
4. Sleep yok: görünür durumu bekle (`toBeVisible`, `toHaveURL`, `toHaveCount`).
5. Hata ayıklama: `.e2e/results/.../trace.md` ve `test-results/` ekran görüntüsü.

## Notlar

- Port **4444**; 4321'deki geliştirme sunucunuz bu koşumdan etkilenmez
  (mock ortam yalnız kendi Astro durum dosyasını yönetir).
- `.dev.vars` koşum sırasında geçici olarak `GITHUB_TOKEN`, `GITHUB_API_BASE`,
  `BETTER_AUTH_URL` satırlarıyla değiştirilir; çıkışta **birebir** geri yüklenir
  (`apps/builder/.dev.vars.bak` yedekten).
- `.e2e/`, `test-results/`, `playwright-report/` git'e girmez.
