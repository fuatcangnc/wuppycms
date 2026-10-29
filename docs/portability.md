# Taşınabilirlik: platform sınırı (ADR 0006)

Çekirdek (WuppyCMS) Cloudflare'a bağlı değildir; **Cloudflare yığını referans
adaptördür**. Bu dosya, self-host'un neyi sağlaması gerektiğini ve göç
durumunu kaydeder. Arayüzler: `apps/builder/src/lib/platform/index.ts`.

## Çekirdeğin platformdan bekledikleri

| Yetenek | Arayüz | Referans (Cloudflare) | Self-host eşdeğeri |
| --- | --- | --- | --- |
| SQL veritabanı (kimlik, proje, ekip, AI ayarı) | `SqlDatabase` | D1 (`prepare/bind/first/all/run/batch`) | SQLite (better-sqlite3/libSQL) ya da Postgres — D1 yüzeyiyle uyumlu ince sarmalayıcı |
| Blob deposu (R2 medya kovaları) | `BlobStore` | R2 (`get/put/delete/list`) | Yerel dosya sistemi ya da S3-uyumlu servis |
| Zamanlanmış yayın yürütücüsü | HTTP ucu | Cron Trigger (`*/15`) → `worker.ts scheduled` | Herhangi bir cron: `POST /api/schedule/run` |
| AI sağlayıcı | — (zaten bağımsız) | BYO: OpenAI-uyumlu ya da Gemini, baseUrl serbest | Aynı; Ollama gibi yerel sunucular anahtarsız çalışır |
| Oturum/kimlik | — | better-auth + D1 | better-auth (SQLite adaptörü) |

**İçerik hiçbir zaman veritabanına girmez** (ADR 0006): içerik müşterinin
repo'sunda, CMS meta verisi `.wuppycms/` altında, çöp `_trash/` altındadır.
D1 şeması yalnız: `user/session/account` (better-auth), `projects`,
`project_members`, `project_invitations`, `ai_settings`.

## Göç durumu (kademeli)

| Alan | Durum |
| --- | --- |
| Git sağlayıcıları | ✅ `BackendService` sözleşmesi + kayıt defteri (`lib/git/`) |
| AI | ✅ Sağlayıcıdan bağımsız (baseUrl + model; Gemini şekli ayrı) |
| Zamanlama | ✅ HTTP ucu + Cron; yürütücü saf (`lib/schedule.ts`) |
| Platform arayüzleri | ✅ Tanımlı (`SqlDatabase`, `BlobStore`, `platformFromBindings`) + Cloudflare uyumu testli |
| Route'ların D1/R2 çağrıları | ✅ `api/{app,helpers,ai,schedule,team,media}.ts` `platform(c)` dikişinden geçer; `findGitHubToken` arayüz tipiyle çalışır |
| Auth bağlaması | 🎯 **Bilinçli sınır:** `createAuth(env.DB)` — better-auth kendi DB adaptörünü ister; self-host kendi adaptörünü verir (SQLite vb.) |

Kalan tek doğrudan bağlama auth'un kendisidir; tüm ürün sorguları arayüz
üzerinden çalışır ve bellek-içi sahte adaptörle test edilir.

## Self-host kontrol listesi (özet)

1. `SqlDatabase` uygulayan bir sarmalayıcı (D1 yüzeyiyle: `prepare → bind →
   first/all/run`, `batch`) ve şemayı `db/migrations/*.sql` ile kur.
2. `BlobStore` uygulayan bir depo (dosya sistemi yeterli; `list` imleç
   davranışı R2 gibi olmalı: `truncated` + `cursor`).
3. Ortam değişkenleri: `BETTER_AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`,
   `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID/SECRET` (bkz. `docs/self-hosting.md`).
4. Cron: `POST /api/schedule/run` (isteğe bağlı `full_name` ile tek repo).
5. Üretimde `GITHUB_TOKEN` boş bırakın; kullanıcılar kendi GitHub hesaplarını
   bağlar (üyeler kendi token'ıyla çalışır — güvenlik kararı, SECURITY.md).

Ayrıntılı kurulum: `docs/self-hosting.md`. Karar kaydı: `docs/adr/0006`.
