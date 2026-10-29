# E2E konvansiyonları (tarayıcı testleri)

Kaynak: Sveltia CMS e2e disiplini incelemesi (`docs/sveltia-analysis.md`) +
bizim harness'lerin (media 51 kontrol, admin-nav) saha dersleri.

## Modlar

- **Mock (varsayılan):** `node scripts/e2e-media.mjs` — sahte GitHub sunucusu
  (`scripts/lib/mock-github.mjs`, bellek-içi) + kendi dev sunucusu (:4399).
  Gerçek API'ye tek istek gitmez; commit kanıtları mock deposundan okunur;
  `raw.githubusercontent` önizlemeleri istek kesmeyle mock'tan servis edilir
  (ACAO başlığıyla). Koşarken :4321'de başka dev sunucusu olmamalı (harness kendi
  .dev.vars'ını yazar, çıkışta geri yükler; sunucuyu `astro dev stop` ile kapatır).
- **Gerçek:** `--real` — dev :4321 açık + gerçek GitHub token'ı (.dev.vars).
  Yalnız entegrasyon doğrulaması için; varsayılan test yolu mock'tur.

## Ortak altyapı (medyaya özel değil)

- `scripts/lib/mock-github.mjs` — sahte GitHub API'si (bellek-içi; git semantiği,
  fast-forward koruması). Uç eklemek gerekirse buraya.
- `scripts/lib/e2e-env.mjs` — ortak mock ortamı: `startMockEnv()` (sahte sunucu +
  dev sunucusu + .dev.vars yönetimi + kapanış; başlarken önceki koşudan kalmış
  kendi sunucusunu da kapatır), `installRawImageProxy()` (raw görsellerin
  mock'tan servisi, ACAO'lu), `seedSite()` (asgari site iskeleti).
  **Yeni her tarayıcı harness'i bunu kullanır; kendi mock/dev kurulumunu yazmaz.**
- P0 notu: gövde editörü mdxeditor; rich yazımın doğrulaması "Böl" modundaki
  `textarea[aria-label="Markdown kaynağı"]` panelinden okunur. Editörü ilk açan
  koşuda Vite bağımlılığı paketleyip sayfayı yenileyebilir → ilgili adımlar
  denemeli yazılır (bkz. e2e-draft-backup `openSplit`).
- Portlar: medya 4399, nav 4398, taslak yedeği 4397, meta paneli 4396,
  geçmiş/diff 4394, pano/çöp 4393, zamanlama 4392, BYO AI 4391, parity 4390,
  koleksiyon+embed 4389, ekip 4388, inceleme 4387, araştırma 4385,
  taslak sekmeleri 4384, Wryte yerleşimi 4383, editör CRUD 4382 —
  çakışmasınlar. Her harness
  `--real` kaçış kapısı taşır (dev :4321 + gerçek GitHub). Sahte sunucu AI için
  de uç verir (`/v1/chat/completions`) ve PR akışını destekler
  (pulls/reviews/merge + çoklu dal); `startMockEnv` `mockPort` döndürür.
  İkinci kullanıcı gereken testler `browser.createBrowserContext()` ile ayrı
  oturum açar (ör. e2e-team). Aynı metinli düğmeler (ör. satırdaki "Kapat" vs
  diyalogdaki) mutlaka kapsamlanır (`[data-slot="dialog-content"]`).
  Wryte düzeninden itibaren `clickButtonByText` (ve AI suite'inin `clickExact`)
  eşleşmede **textContent'e `title`/`aria-label`'ı da ekler** — ikon anahtarlar
  (Preview/Source göz-kod ikonları, "Outline"/"Research"/"AI ile üret" panel
  anahtarları, FRONTMATTER chevronu) metinsiz yönle `title` üzerinden bulunur.
  Araç çubuğu iki gruba bölünmüş (MdxBodyEditor Toolbar): sağdaki sabit küme
  (böl ikonları + Odak + Outline/Research/AI anahtarları) **her koşulda
  görünür kalır**; kayan küme `[data-toolbar-scroll]` içinde yatay kayar.
  Kırpılma ve dış taşma denetimi `e2e-editor-layout`'un 8f adımında
  (port :4383, İngilizce sabitlemesiz). Odak modu sözleşmesi 8g–8l'de:
  katmanda çubuk tam genişlik + sağ uç görünür, panel anahtarları gizli,
  çıkışta (düğme veya **Escape**) çubuk üst şerit yuvasına döner.

## Kurallar

0. **Benchmark ayrıdır:** `scripts/bench.mjs` (5000 entry / 300 asset) CI'da
   koşmaz; ölçümler makineye bağlıdır. Aynı makinede `bench-results/baseline`
   kopyasıyla `node scripts/bench.mjs compare …` çalıştırılır; %10 veya 5ms
   altındaki farklar gürültü sayılır (Sveltia deseni).

1. **"(known issue)" testi:** bilinen hatalı davranış `skip`/beklenen-hata ile
   gizlenmez; davranış testle sabitlenir, adına "(known issue)" yazılır ve
   yorumda düzeltilince ne olacağı belirtilir. Düzeltme gelince test düşer ve
   güncellenmesi gerektiğini söyler. (Sveltia'nın `test.fail()` yasağının
   karşılığı: `test.fail()` benzeri "her koşulda geçen" mekanizma kullanmayız.)
2. **Saat sabitleme:** tarihe bağlı davranış (slug tarihi, `publishAt`,
   "son değişiklik") test edilirken sahte saat kurulur; gerçek zamana
   yarışan `sleep` ile beklenmez. Puppeteer'da CDP `Emulation.setVirtualTimePolicy`
   ya da test-özel sabit tarih enjeksiyonu kullanılır.
3. **Bekleme disiplini:** DOM koşulu bekle (`waitForFunction`), kör `sleep`
   yalnız bilinen debounce/throttle için ve yanına yorumuyla yazılır.
   E2E'de kanıtlanan tuzak: bildirim ≠ DOM (kartlar `button[aria-label]` ile
   beklenir), dialog paneli geç bağlanır (başlığı değil, input'u bekle).
4. **Adım defteri:** her kontrol `step("Nx. açıklama", koşul, ayrıntı)` ile
   yazılır; PASS/FAIL satırları tek başına okunabilir olmalı (kanıt ekran
   görüntüsü adı `docs/evidence/<alan>-NN-açıklama.png`).
5. **Temizlik iki uçlu:** koşudan önce ve sonra artıklar süpürülür; mock modda
   ek olarak "depo temiz kaldı" kontrolü yapılır (step 20 deseni). Test
   kendi verisini bırakmaz.
6. **Geç tutarlılık yoklaması yalnız --real'de:** `commitFor` gerçek GitHub'da
   polling yapar; mock'ta anında döner. Yeni doğrulamalar önce mock API'sine
   eklenir (state okuma fonksiyonu), sonra --real yolu yazılır.
7. **Sahte sunucuya yeni uç eklemek:** uygulama yeni bir GitHub ucu kullanıyorsa
   `mock-github.mjs`'e eklenir; mock'un cevaplayamadığı istek testte 404/500
   olarak görünür — sessizce yutulmaz. Sözleşme: gerçek API'nin alan adları
   (snake_case) korunur, sahte davranış gerçeğe yaklaştıkça test değeri artar.
