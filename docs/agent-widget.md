# Admin AI widget (ADR 0008)

Admin içinde çalışan, git tabanlı AI ajanı. `turanai/turan-widget`ın özellik
setinden **çok dillilik dışındaki** her şeyi WuppyCMS'ye uyarlar: sohbet, canlı
önizleme pencereleri, element seçici, oturum geçmişi, araç grupları, model
seçici, durdurma ve geri alma.

## Ne yapar

- **Launcher + çekmece** — sağ altta `AI` düğmesi; genişliği sürükleyerek ya
  da klavyeyle ayarlanabilen panel, sohbet geçmişi rayı.
- **Canvas** — siteyi bir iframe'de gösterir; en fazla iki sekme/pencere,
  sayfa listesi, geri/ileri/yenile.
- **Element seçici** — önizlemede bir öğeye tıklayınca bağlam mesaja eklenir.
  Varsayılan **tek seçim**: yeni tıklama önceki seçimi değiştirir; ⌘/Ctrl/Shift
  ile çoklu seçim yapılır. Seçim çipinde **Sonrasına / Öncesine** select'i
  vardır; seçim değişince köprü hedefte turuncu ekleme çizgisi gösterir.
  Seçim varken Composer'da **İşlem: Düzenle / Yeni bölüm ekle** anahtarı
  görünür. "Yeni bölüm ekle" seçilince her seçim çipinde After/Before açılır;
  "Düzenle" modunda gizlenir. "ekle/add/insert…" yazıldığında anahtar otomatik
  ekleme moduna geçer, ancak kullanıcı isterse geri alabilir. Gönderimde hedefe kaydırılır ve o noktada skeleton görünür; içerik
  gelince temizlenir. Seçim bağlamı kullanıcı mesajına yazılmaz, ajanın sistem
  istemine yalnızca ekleme modunda `insert: before/after` ile eklenir (sohbette
  ham `[SELECTED ELEMENTS]` bloğu görünmez). Site şablonundaki `WuppycmsBridge.astro` köprüsü üzerinden
  `postMessage` ile çalışır (cross-origin güvenli).
- **Sohbet** — akışlı yanıt, katlanmış araç çağrısı grupları, güvenli Markdown,
  oturum listesi, mesaj bazlı **Geri al** (istek sürerken disabled/“Undoing”;
  undo commit'i sticky header açıkken de F5'siz yansır). Koşu sürerken yeni istemler
  snapshot'larıyla **kuyruğa** alınır; önceki bitince otomatik gönderilir.
  Kuyruk ChatLog'da “Queued” balonları ve Composer'da sayaçla görünür.
- **Araçlar** — repo dosyaları (`read_file`, `write_file`, `edit_file`,
  `list_files`, `grep`) ve içerik koleksiyonları (`content_list`, `content_get`,
  `content_update`, `content_create`, `content_publish`, `content_unpublish`).
  Her yazma gerçek bir commit'tir ve `(via WuppyCMS)` ile biter.
- **Model seçici** — kayıtlı BYO AI sağlayıcısına göre (OpenAI-uyumlu, Gemini,
  Anthropic).

## Mimari

```
Admin (React) ── /api/agent/* ── Worker (Hono)
   │  prompt / events (polling)      │
   │                                 ├─ agent loop (lib/agent/loop.ts)
   │                                 ├─ provider (OpenAI/Gemini/Anthropic)
   │                                 ├─ tools → GitHub commit / içerik
   │                                 └─ D1: sessions, messages, runs,
   │                                         events, changes
   └── iframe (müşteri sitesi) ── postMessage ── WuppycmsBridge.astro
```

- Ajan döngüsü `ctx.waitUntil` ile yanıt sonrası koşar; kalıcı bağlantı yoktur.
- İstemci `GET /api/agent/events?sessionId&runId&cursor` ile 400 ms'de bir
  polling yapar. Olaylar D1'de sıralıdır (`agent_events`).
- Yazma öncesi dosyanın önceki hâli `agent_changes`e yazılır; `undo` bunu geri
  commit'ler (yeni dosya silinir).
- Sağlayıcı anahtarı mevcut `ai_settings` tablosundadır (şifreli) ve tarayıcıya
  dönmez.

## Kurulum

1. Migration: `wrangler d1 migrations apply wuppycms --local` (veya `--remote`).
2. Sağlayıcı: **Admin → Ajan → Sağlayıcı** sekmesinden anahtar/model kaydedin.
   OpenAI-uyumlu (OpenAI/Groq/OpenRouter/Evren/Ollama), Gemini veya Anthropic.
3. Site URL'i: `.wuppycms/sites.jsonc` içindeki `url` alanı canvas'ı besler.
4. Element seçici: müşteri reposunda `apps/site-template` sürümünden gelen
   `src/components/WuppycmsBridge.astro` bulunmalı ve layout'a eklenmelidir.
   Köprü yoksa seçici devre dışı kalır; ajan açık doküman + sayfa URL'i ile
   çalışmaya devam eder.

Köprü `postMessage` sözleşmesi:

| Yön | Mesaj | Ne |
| --- | --- | --- |
| parent → site | `wuppycms:hello` | Köprüyü etkinleştir |
| parent → site | `wuppycms:pick-mode {on}` | Seçim modu |
| parent → site | `wuppycms:unpick {path,label}` | Seçimi kaldır |
| parent → site | `wuppycms:place {path,label,position,scroll}` | Ekleme çizgisi + kaydır |
| parent → site | `wuppycms:skeleton {path,label,position,message}` | Hedefte skeleton |
| parent → site | `wuppycms:skeleton-clear` | Skeleton/çizgiyi kaldır |
| parent → site | `wuppycms:soft-refresh {path,requestId}` | main'i F5'siz yenile |
| site → parent | `wuppycms:soft-refreshed {requestId,ok}` | Yumuşak yenileme sonucu |
| parent → site | `wuppycms:reload` / `back` / `forward` | Gezinme |
| site → parent | `wuppycms:ready` | Köprü hazır |
| site → parent | `wuppycms:pick {selection}` | Seçim |
| site → parent | `wuppycms:page {path,title}` | Sayfa değişti |
| site → parent | `wuppycms:navigate {href}` | Link tıklaması |

> `astro-icon` / `<Icon name="set:name">` kullanılıyorsa ikon
> `astro.config.mjs` içindeki `icon()` include listesinde olmalıdır; aksi halde
> önizleme `Unable to locate ... icon` hatası verir. Mevcut simple-icons:
> github/x/linkedin/whatsapp; lucide: mail/map-pin/clock-3/arrow-right/check.

> Köprü normal ziyaretçiyi etkilemez: yalnızca üst pencereden `wuppycms:hello`
> mesajı gelince etkinleşir. Eski köprüler `place/skeleton` mesajlarını yok
> sayar; konum yine istem bağlamında çalışır.

## Yerel canlı önizleme (deployment yoksa)

`demo.wuppycms.site` gibi bir alan adı gerçekten yayında değilse canvas o adresi
açamaz. Ajan commit'lerini önizlemede görmek için demo reposunu klonlayıp
site şablonuyla servis edin; şablon köprüyü ve `data-wuppycms-*` hedeflerini taşır:

```bash
# 1) İçerik kaynağı: müşteri reposu (public ise token gerekmez)
git clone https://github.com/fuatcangnc/wuppycms-demo-site.git /tmp/wuppycms-demo

# 2) Şablon kopyası + içerik symlink'i (repo çalışma ağacı kirlenmez)
mkdir -p /tmp/wuppycms-preview-site
(cd apps/site-template && tar --exclude=node_modules --exclude=dist --exclude=.astro \
  --exclude=pnpm-lock.yaml -cf - .) | tar -xf - -C /tmp/wuppycms-preview-site
rm -rf /tmp/wuppycms-preview-site/src/content
ln -s /tmp/wuppycms-demo/src/content /tmp/wuppycms-preview-site/src/content

# 3) Önizleme sunucusu
(cd /tmp/wuppycms-preview-site && pnpm install && WUPPYCMS_PREVIEW=1 pnpm exec astro dev --port 4324 --host 127.0.0.1)

# 4) Ayrı terminal: ajan commit'lerini önizlemeye taşı
while true; do git -C /tmp/wuppycms-demo pull --quiet; sleep 3; done
```

`WUPPYCMS_PREVIEW=1`, HMR'ı kapatır; ajan commit'leri önizlemede tam sayfa F5
yerine köprünün `soft-refresh` main değişimiyle görünür. Site ayarındaki `url`
alanını (`.wuppycms/sites.jsonc`) `http://localhost:4324` yapın. Artık ajanın `content_update`/`edit_file` commit'leri birkaç saniye
içinde önizlemede görünür; `Undo` de aynı yolu tersine çevirir.

Kanıt: `docs/evidence/agent-widget-live-preview.png` (köprü bağlı, canlı sayfa)
ve `docs/evidence/agent-widget-live-edit.png` (commit sonrası güncel başlık).

## API

| Uç | Ne |
| --- | --- |
| `GET /api/agent/status` | Sağlayıcı/model kataloğu (anahtar sızmaz) |
| `POST /api/agent/prompt` | Oturum açar/sürdürür, koşuyu başlatır |
| `GET /api/agent/events` | Olay polling'i (`cursor`) |
| `POST /api/agent/stop` | Adım sınırında durdur |
| `GET /api/agent/sessions` · `GET/DELETE /api/agent/session` | Geçmiş |
| `GET /api/agent/pages` | `src/pages` → önizleme sayfa listesi |
| `POST /api/agent/undo` | Son/verilen yazmayı geri commit'le |

## Sınırlar

- Önizleme **build edilmiş** sitedir; commit'ler bir sonraki build'de görünür.
  Ajan bunu yanıtında belirtir, "canlı güncellendi" demez.
- Dosya araçları yalnız izinli köklerde çalışır (`src/`, `public/`, `scripts/`,
  `.wuppycms/` + birkaç kök dosya); `.env`, kilit dosyaları, `dist`, `.git`
  reddedilir.
- Kod çalıştırma / paket kurma yoktur (containersız ilke, ADR 0006).
- **Uzun koşular:** ajan `ctx.waitUntil` ile koşar; Cloudflare bunu yanıttan
  sonra sınırlı süre canlı tutar. Çok adımlı/uzun görevler üretimde
  **Queues veya Durable Object** üzerine taşınmalıdır (ADR 0006'nın asenkron
  kuyruk ilkesi). Yerel geliştirmede sınır yoktur; oturum/olay kaydı zaten
  D1'de olduğu için taşıma yolu hazırdır.
- Çok dillilik (dil kapsamı, çeviri listeleri, hreflang, medya i18n) bu sürümün
  kapsamı dışındadır.

## Test

```bash
cd apps/builder
pnpm exec astro check          # 0 hata
pnpm exec vitest run           # 131 birim testi
node scripts/check-locales.mjs # tr/en anahtar paritesi
```

Uçtan uca doğrulama (yerel): giriş yapın, bir site seçin, `AI` düğmesini açın,
"blog kayıtlarını listele" gibi bir istem gönderin; araç grubu ve akışlı yanıt
görünür. Yazma testi için geçici bir dalda `content_update` + `undo` deneyin.
