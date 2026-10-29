# 0017 — “With AI” site builder

Durum: Kabul edildi (2026-10-29)

## Bağlam

Kullanıcıların GitHub repoları her zaman Astro/WuppyCMS değildir. Mevcut
“New project” akışı yalnızca hazır bir repoyu bağlıyordu; sıfırdan site
kurmak isteyenler için EmDash Build benzeri bir akış yoktu. Kullanıcı,
`emdash-build`in landing + clarifying questions + renk seçimi akışını
WuppyCMS’e uyarlamamızı istedi.

## Karar

1. **Repo algılama.** `GET /api/git/repo-info`, seçilen repoda
   `astro.config.*`, `package.json`, `src/content.config.ts` ve
   `.wuppycms/sites.jsonc` arar. Astro repo → mevcut proje bağlama akışı.
   Astro değilse “With AI” önerilir; repo zorla bağlanmaz.
2. **With AI akışı.** Projeler ekranında ayrı bir panel:
   - Serbest site açıklaması + örnek prompt’lar.
   - 5 soruluk clarifying questions (ad, tür, hedef kitle, ton, bölümler);
     ilerleme, Geri/Atla/İleri, tek/çok seçim ve serbest cevap.
   - Tasarım sistemi ana renk paleti (Wuppy Orange, Kumo Blue, Emerald,
     Violet, Crimson, Ink) + site adı, tagline, repo adı, private.
   - EmDash’in görsel dili admin Kumo token’larına uyarlanır.
3. **Üretim.** `POST /api/build/site`, public `SITE_TEMPLATE_REPO` reposundan
   (varsayılan `fuatcangnc/wuppycms-astro-template`) GitHub template generate
   API’siyle yeni bir repo üretir. `site.ts` marka/tagline/description/GitHub,
   `global.css` primary + primary-dark, `.wuppycms/sites.jsonc` başlık güncellenir;
   proje D1’e yazılır.
4. **AI brief.** Seçimler `sessionStorage`’a bırakılır; admin açıldığında ajan
   editörü brief ile açılır ve **otomatik başlar**. Ajan mevcut Astro/Tailwind/
   Bejamas tasarım sistemi içinde WuppyCMS marketing metinlerini sitenin
   içeriğiyle değiştirir.
5. **Şablon.** Template repo public ve `is_template` işaretlidir; marka/footer
   `siteSettings`ten dinamik okunur. Yeni siteler bu repodan üretilir.

## Sonuçlar

- Astro olmayan repolar yanlışlıkla bağlanmaz; sıfırdan site için net bir
  “With AI” yolu vardır.
- Üretilen site önce boilerplate iskeletidir; AI brief’i otomatik çalışarak
  içeriği siteye uyarlar.
- Preview/deploy için sitenin bir site URL’i veya deploy hattı gerekir; build
  API yalnızca GitHub reposunu üretir.
- `SITE_TEMPLATE_REPO` her deployment’ta public bir template repo’ya işaret
  etmelidir. Test sırasında oluşan deneme repoları kullanıcı tarafından
  silinebilir.
