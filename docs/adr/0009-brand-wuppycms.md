# 0009 — Marka adı: WuppyCMS

Durum: Kabul edildi (2026-10-28) — Teknik kimlikler: 0018 ile güncellendi.

## Bağlam

Ürünün marka adı **ReeyAI / ReeyCMS** iken **WuppyCMS** olarak değiştirildi.
Kod tabanında marka adı; kullanıcı arayüzünde, README/dokümanlarda, ajan sistem
isteminde ve commit mesajı kuyruğunda (`(via …)`) geçiyordu. Aynı zamanda ürün
iki yüzlüdür: açık kaynak çekirdek ve bulut sürümü. Bulut sürümünün adı
**Wryte** olarak kalır; WuppyCMS ürünün/markanın adıdır.

## Karar

1. **Kullanıcıya görünen marka WuppyCMS'tir.** UI başlıkları, landing/login/
   signup, sidebar, ajan adı, commit kuyruğu (`(via WuppyCMS)`), README,
   `llms.txt`, güncel dokümanlar ve site şablonu demo içeriği bu adı kullanır.
2. **Teknik kimlikler geriye uyumluluk için korunur.** Marka değişikliği bir
   altyapı göçü değildir; aşağıdaki adlar bilinçli olarak değiştirilmedi:
   - `.reeyai/` site yapılandırma klasörü (mevcut müşteri repoları)
   - `@reeyai/*` pnpm paket adları ve import yolları
   - D1 veritabanı `reeyai`, R2 kovası `reeyai-media`
   - `turancms.com` custom domain ve `BETTER_AUTH_URL`
   - `reeyai:` localStorage/sessionStorage anahtarları ve `reeyai:` postMessage
     protokolü
   - `ReeyaiBridge.astro` bileşen adı (müşteri sitesi köprüsü)
   - `dev@reeyai.local` test/harness hesapları
3. **Tarihsel ADR'ler (0001–0008) olduğu gibi bırakılır.** Karar kayıtları
   geçmişi yansıtır; marka değişikliği geriye dönük metin düzenlemesiyle
   değil, bu kayıtla belgelenir.
4. **Wryte adı korunur.** Bulut sürümü Wryte olarak anılmaya devam eder;
   istenirse ayrı bir ADR ile değiştirilir.

## Sonuçlar

- Yeni commit'ler `(via WuppyCMS)` kuyruğuyla atılır; eski commit'lerdeki
  `(via ReeyAI)` tarihsel kayıt olarak kalır.
- Marka metni tek yerden değiştirilebilir durumda değildir (UI, dokümanlar ve
  commit kuyruğu ayrı yerlerde); gelecekte bir marka sabiti/çeviri anahtarına
  taşınması ayrı bir iyileştirmedir.
- Teknik adların (özellikle `.reeyai/` ve paket kapsamı) WuppyCMS'e taşınması
  ayrı bir göç kararı gerektirir; bu ADR onu kapsamaz.
- `apps/site-template` demo içeriği ve `docs/design-system.md`,
  `docs/agent-widget.md`, `e2e/README.md` yeni markaya göre güncellendi.
  `docs/evidence/` altındaki eski ekran görüntüleri tarihsel kanıt olarak
  olduğu gibi bırakıldı.
