# GitCMS özellik paritesi — detaylı spesifikasyon

Kaynak: GitCMS ekran görüntüleri (19 kare, `gitcms.dev/app`, Ekim 2026). Bu
doküman her özelliği **olduğu gibi** kaydeder ve WuppyCMS'nin git-tabanlı CMS
mimarisine (içerik = müşteri reposu, şema = `src/content.config.ts`, her kayıt
= commit) nasıl oturttuğumuzu yazar. Üst düzey kapsam için bkz.
`.opencode/skills/wuppycms-git-cms/features.md`.

Durum işaretleri: ✅ yapıldı · 🚧 P1 (sıradaki increment) · 📋 P2 · 💭 P3
(kapsam dışına yakın).

> **P1 teslim edildi (2026-10-15).** Aşağıdaki P1 satırlarının tamamı canlı:
> A1–A3, A5 (davet kapalı), C2, D1, D2 (Title hero), F1, G1 (URL), G4 (repo
> kütüphanesi), H1, J1, J2 (yükleme/silme/bağlantı), K1, K2, K5 ve L1–L4
> uçları. Ekranda doğrulandı: sihirbaz (astro.config'den adres + koleksiyon
> onayı + yayın modu → `wuppycms: initialize site config … (via WuppyCMS)`
> commit'i), pano commit akışı, tabloda değişiklik notu/yazar, CONTENT.md ve
> medya yüklemesi/silinmesi gerçek commit'lerle. A4 yayın modu **kaydedilir**
> (PR/onay uygulaması 📋), B3 tek seferlik tarama yapar (sürekli yoklama 📋).

> **Arayüz mimarisi (2026-10-15 sonrası):** Admin ve proje sayfaları vanilla
> DOM kodundan Astro + React adalarına taşındı. Sayfa kabuğu ve veri çekme
> Astro'da kalır (`admin.astro` oturum koruması, `projects.astro` D1 sorgusu);
> tüm etkileşim `client:load` adalarıdır (`AdminApp`, `ProjectsIsland`,
> `AuthForm`). Durum Nanostores'ta (`src/lib/admin/store.ts`), iş mantığı
> DOM'suz `src/lib/admin/actions.ts` içinde; bileşenler yalnız sunum yapar.
> Bejamas registry'si yalnız `.astro` dağıttığı için Button/Input'un React
> portları `src/components/ui-react/` altında sınıf paritesiyle durur. Bejamas
> `skeleton` bileşeni CLI ile kuruldu; React portu (`ui-react/skeleton`) tüm
> yükleme durumlarında kullanılır: `SkeletonRows` (tablo/liste/depolar),
> `SkeletonGrid` (medya kartları), `Skeleton` (pano, CONTENT.md, tarama paneli).

Değişmez ilkeler (GitCMS'in sağ panelinden aldığımız çerçeve):

1. **Depo tek doğruluk kaynağıdır.** WuppyCMS repoyu doğrudan okur/yazar;
   senkron tutulacak içerik kopyası yoktur.
2. Markdown/MDX doğrudan okunur; her kayıt bir commit'tir.
3. Yazarlar/pazarlamacılar Git bilmez; dallar ve commit'ler CMS'in işidir.

---

## A. Site ekleme sihirbazı (Add a site)

GitCMS akışı: repo seç → tara → Adım 1/2 kök kontrolü → Adım 2/2 yayın
modu → hazır + davet.

| # | Özellik (ekranda görülen) | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| A1 | **Repo seçim modalı**: GitHub ikonlu depo listesi, özel depo kilidi, `Not set up` rozeti, chevron ile kurulum başlatma | Var olan depo listesi diyaloğu; satıra `Kurulum yok / Kuruldu` durumu eklenir (`content.config.ts` keşfinden) — kurulum, projeyi `setup` durumuna taşır | 🚧 |
| A2 | **"Reading your repository…"**: iskelet satırlı tarama ekranı; "looking for websites in owner/repo" | `GET /api/site/scan?full_name=`: ağaç + `content.config.ts` + `astro.config.*` içindeki `site:` + `public/` varlığı tek yanıtta döner; client skeleton basar | 🚧 |
| A3 | **Adım 1/2 "Check Repository root · Astro"**: Website address (framework config'ten doldurulur), Content koleksiyon onay kutuları (`29 entries in src`), Media folder (`/public/`, doğrulama tiki, "Uploading photo.jpg saves public/photo.jpg → entries link to /photo.jpg"); sağ sütun "What editors will see" (editör menüsünün önizlemesi) + "Where things live" (repo → src / public ağacı) | Aynı 4 alan. Adres `astro.config`'ten; koleksiyonlar şema parserımızdan (girdi sayısıyla); medya klasörü scan sonucundan. Sağ sütun aynı iki kartı client'tan üretir (zaten elimizdeki veri). Sonuç commit'i: `.wuppycms/sites.jsonc` | 🚧 |
| A4 | **Adım 2/2 "How should changes go live?"**: `Review before publishing` (Idea → Draft → Review → Published) / `Publish right away` (Save → Live); sağda akış şeması: "Editor writes a draft — its own branch → Someone reviews — comments, approval → Published — merged to main"; "Editors never see branches or commits" | İki mod `sites.jsonc`'e yazılır (`publishing: review | immediate`). **immediate** = bugünkü davranış (doğrudan main'e commit). **review** = P2 akışı: kayıt `cms/<kullanıcı>/<slug>` dalına commit → PR aç → onay = merge. UI'da dal/commit gösterilmez | 🚧 (mod seçimi) / 📋 (PR akışı) |
| A5 | **"Your site is ready"**: site satırı (✓ domain / Repository root) + `Open`, `Invite editors` CTA, toast | Kurulum sonrası "Site hazır" ekranı; davet P2'ye kadar `/admin`e yönlendirir, davet satışı kapalıysa gizli | 🚧 |

## B. Kodlama ajanıyla kurulum (Set up with your coding agent)

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| B1 | Ajan sekmeleri: **Claude Code, Codex, Cursor, Gemini CLI, OpenCode** + panoya kopyalanabilir hazır prompt | "Ajan ile kullan" kartı bu modalı açar; prompt metni bizim CLI + `sites.jsonc` sözleşmemize yazılır. OpenCode sekmesi bizde birinci sınıf | 🚧 |
| B2 | CLI: `npx create-gitcms@latest --yes` → `.gitcms/sites.jsonc` yazar → `git push` | `npx create-wuppycms@latest --yes` (P2'de gerçek paket; şimdilik blueprint'teki `.wuppycms/sites.jsonc` sözleşmesini kuran prompt + elle akış). blueprint zaten aynı dosya adını öngörüyor | 📋 |
| B3 | **Canlı yoklama**: "GitCMS checks the repository every few seconds" + `Check now`; site satırında `Waiting` → tik ("GitCMS ticks each site off — Here, live") | Aynı polling: `GET /api/site/scan` tekrarlanır; `sites.jsonc` repoda görününce site "kuruldu" işaretlenir | 🚧 |

## C. Ana ekran ve site panosu (Home / Your websites)

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| C1 | **Home "Your websites"**: sayaç (`0 licensed, 1 in preview`), site satırları (domain + `owner/repo` + `Preview` rozeti + `Open preview`), `+ Add site`, `Buy licenses →` | `/admin` site seçili değilken ve yeni sekmede: site kartları listesi (domain, repo, durum). Lisans yerine plan rozeti (`önizleme` / `etkin`); self-host'ta kapı yok | 🚧 |
| C2 | **Site panosu**: başlıkta domain + framework rozeti (Astro) + `Visit website` + GitHub ikonu; **Collections** kartları (klasör + kayıt sayısı); **Recently updated** = commit akışı (mesaj, yazar, göreli zaman; `(via Reey CMS)` son eki); sağda **Team** kartı (Owner) | Admin'in koleksiyon-süz "Genel Bakış" görünümü: son commit'ler `GET /api/git/commits?full_name=&per_page=5` ile; commit mesajı geleneğimiz `cms: … (via WuppyCMS)` son ekini taşır; `Visit website` sites.jsonc'teki adresten | 🚧 |

## D. Koleksiyonlar ve dokümanlar

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| D1 | **Girdi tablosu**: kolonlar `Name / Change note / Last updated (sıralanabilir) / Updated by (avatar)`; **alt klasörler gezilebilir**; `Search entries…`; `View` (yerleşim değiştir) | `entries` yanıtına dosya-bazlı son commit eklenir: koleksiyon alt ağacı için **tek** `GET /repos/…/commits?path=<base>&per_page=100` çağrısı yapılıp dosyalara eşlenir (N+1 yok). Alt klasör gezinme: mevcut tabloya klasör satırları (isimlendirme şeması `blog/alt/klasör/dosya.md` zaten bunu taşır) | 🚧 |
| D2 | **Doküman editörü**: dev **Title** hero input; şema alanlar ikon+etiket satırları; gövde WYSIWYG görünümlü | Title ayrı büyük input olur (formun ilk alanı); kalan alanlar mevcut. WYSIWYG/Notion-vari MDX editörü 📋 — şimdilik monospace gövde | 🚧 (Title) / 📋 (WYSIWYG) |
| D3 | **Kırıntı yolu**: site › koleksiyon › klasörler › dosya.md | Var (site / koleksiyon / slug); klasör ara seviyeleri D1 ile eklenir | ✅ (temel) |
| D4 | Kayıt sayısı koleksiyon kartında (`29 entries`) | entries sayacı var; pano kartlarında da gösterilir | ✅ |

## E. İçerik panosu (Content Board — kanban)

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| E1 | **Ideas / Draft / Review / Published** kolonları (renkli başlık, sayaç, sürükle-bırak, "Drop cards here") | Durum **frontmatter**'da yaşar (kopya değil): şemada `status: z.enum(["idea","draft","review"]).default("idea")` veya `draft: boolean` varsa pano ona göre gruplar; main'de olmayan her dal/PR `Review` sütununda karttır. Şemasında alan olmayan koleksiyonun tümü `Published`'da görünür; Configure → Content "durum alanı ekle" önerir (content.config.ts'e commit) | 📋 |
| E2 | Yayın modu `review` ise editör kaydı kendi dalına gider, onaylanınca main'e merge (A4) | PR tabanlı akış: `POST /api/git/pull-requests`, yorum/onay GitHub review, merge = yayın. Kart sürüklemek = dal/PR durumu geçişi | 📋 |

## F. CONTENT.md — siteyi AI'a tanıtan dosya

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| F1 | Menüde **CONTENT.md**: repo kökündeki dosyanın editörü; bilgilendirme bandı: "Use CONTENT.md to tell AI how to write for this site. Add tone, audience, and style rules. Do not put secrets or site config here." + `Read guide` | Sol menüye CONTENT.md girdisi: `GET/PUT /api/git/file` ile dosya okunur/yazılır (kayıt = commit). Sohbet ajanı içerik üretirken bu dosyayı sistem bağlamına ekler — AI yazım kılavuzu fiilen repoda yaşar | 🚧 |

## G. Siteyi yapılandırma (Configure site)

Tek modal, sol dikey sekme listesi + sağ panel; kaydetme `.wuppycms/sites.jsonc`
commit'idir (elle düzenleme değil, UI'dan üretilir).

| # | Sekme / özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| G1 | **Your site**: site önizleme maketi, **Website URL**, **Sitemap** (`Discover sitemap` butonu — domain'den sitemap.xml keşfi, elle düzenlenebilir liste), **Framework** (`Auto-detected` → Astro) | URL astro.config/site.jsonc'ten okunur, sites.jsonc'e yazılır. Sitemap keşfi: Workers'ta `fetch(/sitemap.xml)` + parse (P2). Framework: yalnız Astro desteklenir; Astro olmayan repoda sihirbaz uyarır | 🚧 (URL) / 📋 (sitemap) |
| G2 | **Content**: koleksiyon kartları (klasör adı, `.md` rozeti, yol `/src/`, `2 fields`, genişlet, çöp kutusu) + **Add Collection** | Kartlar şema parserından. **Add Collection = repoya commit**: `content.config.ts`'e `defineCollection` bloğu eklenir (UI alan üretir: ad, tip, zorunlu; Zod metni şablonu) + `src/content/<key>/` klasörü ilk dosyayla. Silme = bloğu + klasörü kaldıran commit. Bu, "gerçek kod düzenleme korunur" ilkesiyle uyumlu: şema repoda kalmaya devam eder | 📋 |
| G3 | **Languages**: "Publish the same content in several languages, each in its own folder"; `Manage content by locale` anahtarı (koleksiyon yollarında locale çözümleme) | Astro i18n klasör düzeni (`src/content/blog/en|tr`) parser'a locale katmanı ekler; formlar locale sekmeli olur. Şimdilik kapsam dışı | 💭 |
| G4 | **Media**: "upload → Your repository → /photo.jpg" diyagramı; `photo.jpg saves public/photo.jpg → entries link to /photo.jpg`; **Media libraries**: `Repository media (Default)` + `+ Add Library` | Varsayılan kitaplık = repo `public/` (GitHub Contents API base64 commit — ikili dosya desteği `POST /api/git/upload` ile yeni). Ek kitaplık olarak R2 (blueprint'teki imzalı direkt yükleme) P2. Link biçimi kuralı UI'da aynen gösterilir | ✅ (repo + R2 kitaplığı + bağ biçimi) |
| G5 | **Publishing**: durum akışı şeridi (Idea → Draft → Review → Live); yayın modu kartları; **Require approval before publishing** (Reviewer/Admin/Owner onaylar; Owner/Admin yine de yayınlar); **Advanced**: `Config Version`, **Entry details format** (YAML ▾ — frontmatter biçimi), **Publishing branch** (Repository default (main) ▾ — "yeniden adlandırılsa da takip eder") | Mod + onay anahtarı sites.jsonc. Onay uygulaması = PR review zorunluluğu (P2, E2 ile birlikte). Frontmatter biçimi: MVP YAML; TOML/JSON okunur ama YAML yazar. Publishing branch: projede zaten `default_branch` tutuluyor; ayarlanabilir olur ve commit'ler bu dalı takip eder | 🚧 (kayıt) / 📋 (uygulama) |

## H. Site değiştirici (site switcher)

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| H1 | Üst barda site açılır listesi: siteler + ✓ + `+ Add site` | Admin üst barında breadcrumb yanına dropdown (mevcut site listesiyle beslenir; sidebar'daki SİTELER bölümü kalır) | 🚧 |

## I. Ekip, roller, workspace

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| I1 | **E-posta davetleri**: Editör / Reviewer / Viewer rolleriyle davet; davetli Google/GitHub ile girer, yalnız kendine açılan siteleri görür; hesap açmayı beklemez | `invitations` tablosu (e-posta, rol, site kapsamı, token) + davet linki akışı (better-auth oturumuyla kabul). Site-kapsamı filtresi API'de yetki kontrolü olur | 📋 |
| I2 | Roller + **yayınlama yetkisi** ayrı yetki; panoda Team kartı (Owner) | Roller: owner > admin > editor > reviewer > viewer. Yayın yetkisi G5 onay akışına bağlanır. Team kartı C2 panosunda | 📋 |
| I3 | **Workspace** (hesap kartında "No workspace" → çalışma alanı seçici; workspace'e site ve ekip bağlanır) | `workspaces` + `workspace_members` tabloları; `projects.workspace_id`. Bireysel hesap = otomatik kişisel workspace ("fuatcangnc's Workspace" modeli) | 📋 |

## J. Medya ekranı

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| J1 | Menüde **Medya**: depo medyası dosya tarayıcısı (public/ içeriği) | `lib/admin/media.ts` kitaplık katmanı: depo + R2 listeleme, **Klasörler/Görseller** bölümleri + klasör kartları, alt klasör gezme (breadcrumb), "+ Klasör" (`.gitkeep`), bağlantı kopyalama (bağ biçimi ayarına göre), silme = commit, lightbox (gezinme + zoom + indirme); diyaloqlar Bejamas Dialog portunda | ✅ |
| J2 | Yükleme: sürükle-bırak, çoklu dosya; hedef klasör seçimi | Sürükle-bırak + seçici + panodan yapıştır (gövde imlecine `![](…)` ekler, hedef `public/<koleksiyon>/<slug>/`); ad temizleme (`My Image (1).png → my-image-1.png`); tarayıcıda WebP/ölçek optimizasyonu + tasarruf onayı; görsel benzeri string alanlarında "Medyadan seç" | ✅ |

## K. Kabuk / UX detayları

| # | Özellik | WuppyCMS uygulaması | Durum |
| --- | --- | --- | --- |
| K1 | Üst bar sol: **sidebar daralt** ikonu (tüm ekranlarda) | Admin header + sidebar'a collapse; durum localStorage | 🚧 |
| K2 | **"Use with AI" kartı**: "Pick your agent and connect … in minutes" + ajan ikon dizisi (Claude, Codex, Cursor, Gemini, OpenCode…) | Kart B1 modalını açar; ikonlar inline SVG | 🚧 |
| K3 | Hesap kartı + workspace geçiş oku | Hesap kartı var; workspace 📋 | ✅ (kart) |
| K4 | Lisans bandı: "You can explore this website… buy a license" (mor uyarı) + `Buy License` | Bizde bandın karşılığı plan durumu: `Önizleme` rozeti + (satış açılınca) yükseltme bandı; self-host/yerel: band yok | 💭 |
| K5 | Commit mesajları: `Create src/content/blog/…md (via Reey CMS)`, `Initialize GitCMS for domain`, `Update config by <bot>` | Commit geleneğimiz: `cms: <slug> güncellendi`, `Create new <collection> entry`, kurulum commit'leri `wuppycms: initialize site for <domain>`, config commit'leri `wuppycms: update site config`; hepsine `(via WuppyCMS)` son eki | 🚧 |

## L. Git-meta veri katmanı (yukarıdaki tabloların beslendiği uçlar)

| # | Uç | İş | Durum |
| --- | --- | --- | --- |
| L1 | `GET /api/git/commits?full_name=&path=&per_page=` | Dosya/alt-ağaç commit listesi (D1 tabloları, C2 akışı, J dosya bilgisi) | 🚧 |
| L2 | `GET /api/site/scan?full_name=` | Sihirbaz taraması (astro config adresi, koleksiyonlar+sayılar, public/, mevcut sites.jsonc) | 🚧 |
| L3 | `PUT /api/site/config` | Configure sekmesinin sites.jsonc commit'i | 🚧 |
| L4 | `POST /api/git/upload` | İkili dosya commit'i (medya) | ✅ |
| L7 | `/api/media/r2` (list/upload/delete/raw) | R2 kitaplığı — worker binding'i üzerinden, kimlik/CORS yok | ✅ |
| L5 | `POST/GET /api/git/pull-requests` (+ merge, review) | review yayın modu (E2) | 📋 |
| L6 | `invitations`, `workspaces` tabloları | I1/I3 | 📋 |

---

## GitCMS'den bilinçli farklarımız

| Konu | GitCMS | WuppyCMS |
| --- | --- | --- |
| Şema kaynağı | Kendi config'i (`.gitcms`) + repo keşfi | **`src/content.config.ts` tek doğruluk kaynağı**; UI şemayı repoya commit ederek değiştirir |
| Durum/lisans modeli | Lisans satışı (`Buy License`, preview kısıtı) | Plan modeli + self-host'ta kapısız; ürünün kendisi AI ajanlı builder |
| Framework | Astro dahil çoklu | Yalnız Astro (content collections sözleşmesi) |
| Medya | Repo default + ek kütüphaneler (imzalı direkt yükleme, workspace entegrasyon kimlikleri) | Aynı yüzey; R2 **worker binding'i** ile — kimlik, CORS ve imzalı URL gerekmez |
| Yayın | Kendi branch/PR otomasyonu | GitHub PR'ları birinci sınıf; dallar editöre hiç görünmez |

## Fazlar

- **✅ P1 — "GitCMS kabuğu tamamlansın" (teslim edildi)**: C1–C2 pano,
  A1–A5 sihirbaz, D1 commit-meta tabloları + alt klasörler, D2 büyük Title,
  F CONTENT.md, J Medya (repo kütüphanesi), H site dropdown, K1–K2,
  K5 commit geleneği, L1–L4 uçları.
- **✅ Medya paketi (teslim edildi)**: J1–J2 tam (klasör gezme, sürükle-bırak,
  yapıştır-yükle, ad temizleme, tarayıcıda WebP optimizasyonu + tasarruf onayı,
  önizleme), bağ biçimi ayarı (`mediaLink`), R2 kitaplığı (`mediaR2` →
  `/api/media/r2`, G4), editör medya seçicisi + görsel alan sezgisi; ilerleme
  şeridi (faz faz yükleme + ETA), GitCMS kart şeridi (ad + biçim rozeti),
  arama + tür filtresi + kalıcı grid/liste görünümü, alt metin/caption
  (D1 `media_meta`, 0003–0004 migration), medya detay diyaloğu (Detaylar /
  react-easy-crop kırpma / Kullanılan yer taraması), yeniden adlandır-taşı-
  değiştir, lightbox. Ayrıntı: `docs/media-management.md`.
- **📋 P2 — "İşbirliği"**: E1–E2 pano + inceleme/PR/onay akışı (A4'ün
  uygulaması), G2 koleksiyon yönetimi (Zod commit), G5 onay uygulama,
  I1–I3 davetler/roller/workspace, B2 `create-wuppycms` CLI paketi, B3 canlı
  yoklama, D2 WYSIWYG gövde, `media://` URI, S3.
- **💭 P3**: G3 diller/locales, zamanlama, granüler izinler, analitik,
  satır içi yorumlar, K4 satış bandı.
