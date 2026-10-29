# 0008 — Admin içi AI widget: repoya yazan ajan + preview köprüsü

Durum: Kabul edildi (turanai/turan-widget davranışının ReeyAI'ye uyarlaması)

## Bağlam

`turanai` tarafında EmDash + Astro sitelerinde çalışan bir uygulama-içi AI
widget'ı var: sohbet, canlı sayfa pencereleri (canvas), element seçici, oturum
geçmişi, araç çağrısı grupları, model seçici, durdur/geri al ve **dev-only
dosya araçları**. Turan widget'ı ajanı sitenin dev sunucusunda (Node) çalıştırır
ve yerel dosyaları yazar.

ReeyAI'de çalışma ortamı farklıdır: builder Cloudflare Workers'ta koşar,
içerik ve kaynak kod müşterinin GitHub deposundadır ve her yazma gerçek bir
commit'tir (ADR 0006). Bu yüzden davranış birebir taşınmaz; **özellik seti**
taşınır, yürütme modeli ReeyAI'ye uyarlanır.

## Karar

### 1. Ajan builder Worker'ında; araçlar Git üzerinden

- Ajan döngüsü `src/lib/agent/` altındadır ve `ctx.waitUntil` ile istek
  yanıtlandıktan sonra koşar. Uzun ömürlü süreç yoktur (containersız ilke).
- Dosya araçları (`read_file`, `write_file`, `edit_file`, `list_files`, `grep`)
  yerel dosya sistemi yerine **GitHub deposu** üzerinde çalışır; her yazma
  `commitFiles` ile tek atomik commit'tir ve mesajı `(via ReeyAI)` ile biter.
- İçerik araçları (`content_list/get/create/update/publish/unpublish`) repodaki
  `content.config.ts` şemasını ve markdown/MDX dosyalarını kullanır; içerik
  D1'e yazılmaz.
- Yol güvenliği: izinli önekler (`src/`, `public/`, `scripts/`, `.reeyai/`) ve
  dosyalar (`astro.config.*`, `package.json`, `AGENTS.md`…); `.env`, kilit
  dosyaları, `node_modules`, `dist`, `.git` reddedilir.
- Her yazma öncesi dosyanın önceki hâli `agent_changes` tablosuna yazılır;
  `undo_last_change` bu kaydı geri commit'ler.

### 2. Oturum/olay kalıcılığı D1'de (polling)

- `agent_sessions`, `agent_messages`, `agent_runs`, `agent_events`,
  `agent_changes` tabloları (migration 0007).
- İstemci SSE yerine `GET /api/agent/events?runId&cursor` ile **polling** yapar.
  Bu, Workers'ta kalıcı bağlantı/DO gerektirmeden kopmalara dayanıklıdır ve
  turan-widget'ın olay sözleşmesiyle (`assistant_text_delta`, `tool_started`,
  `tool_done`, `content_changed`, `run_finished`, `run_error`) uyumludur.
- Durdurma isteği `agent_runs.stop_requested` alanındadır; döngü adım ve araç
  sınırlarında kontrol eder.

### 3. Önizleme köprüsü site şablonundadır

- Admin'deki widget canvas'ı siteyi bir iframe'de gösterir. Element seçici
  cross-origin sınırı nedeniyle iframe belgesine doğrudan erişemez.
- `apps/site-template/src/components/ReeyaiBridge.astro` her sayfaya eklenir;
  yalnızca üst pencereden `reeyai:hello` mesajı gelince etkinleşir (normal
  ziyaretçide sıfır etki). Seçim, gezinme ve yenileme `postMessage` ile taşınır.
- Köprü yoksa (köprü eklenmemiş eski müşteri repoları) seçim devre dışı kalır;
  ajan açık doküman + sayfa URL'i bağlamıyla çalışmaya devam eder.

### 4. UI React + Tailwind 4 + Bejamas

- Widget admin adasının içinde React bileşenleridir; turan-widget'ın enjekte
  ettiği tek parça CSS **kullanılmaz**. Tüm görünüm Tailwind 4 utility'leri ve
  mevcut tema tokenlarıdır; primitifler Bejamas portlarından gelir (ADR 0002).
- Çok dillilik kapsam dışıdır (dil kapsamı, çeviri listesi, hreflang, medya
  i18n taşınmaz). Diğer tüm widget yetenekleri taşınır.

## Sonuçlar

- Ajan, CMS'in kendi veri modeliyle (git + content collections) çalışır; ayrı
  bir içerik deposu doğmaz.
- Preview düzenlemesi gerçek commit üretir; inceleme-önce-yayın akışıyla
  (status/review) çakışmaz, ajan da `status` alanını kullanır.
- Polling, D1'e her turda birkaç küçük yazma ekler; oturum başına ölçek
  küçüktür ve DO/kuyruk karmaşıklığından kaçınılır.
- Köprü site şablonundadır; mevcut repolara otomatik geriye dönük uygulanmaz.
