# AWS-only mimari (B) — durum ve plan

Hedef: müşterinin kendi Cloudflare hesabına yaptığı deploy hariç **her şey AWS**
ve mümkün olan en düşük maliyet.

## B1 — Build: CodeBuild (tamamlandı, deploy bekliyor)

VM'deki `wuppycms-deploy` worker'ının yerine **AWS CodeBuild** kullanılır.

- Uygulama `codebuild:StartBuild` çağırır (`src/lib/deploy/codebuild.ts`).
- `scripts/aws/buildspec.yml`: repoyu GitHub App token'ı ile klonlar,
  `pnpm install && pnpm build`, `s3 sync`, CloudFront invalidation, sonra
  `/api/deploy/callback` ile durumu yazar.
- Kurulum: `bash scripts/aws/provision-codebuild.sh` (IAM rolü + proje +
  deploy kullanıcısına `StartBuild` izni).
- Uygulama env: `AWS_CODEBUILD_PROJECT=wuppycms-build`.
- Maliyet: `BUILD_GENERAL1_SMALL` 0,005 $/dk; ~3 dk build ≈ **0,015 $/site**.
- Eşzamanlılık sınırı yok (CodeBuild hesap kotası kadar).

> Not: `GIT_TOKEN` ve `CALLBACK_SECRET` build ortam değişkeni olarak geçer;
> token 1 saat geçerlidir. Daha sıkı kurulum için Secrets Manager/SSM
> `PARAMETER_STORE` tipine geçilebilir.

## B2 — Uygulama: Lambda + DynamoDB (plan)

Bugünkü uygulama Cloudflare worker girişinde (Hono + Astro CF handler) ve
D1 (SQLite) üzerinde çalışıyor. Lambda'ya taşımak için:

| Katman | Bugün | AWS hedefi | İş |
| --- | --- | --- | --- |
| HTTP | `worker.ts` (CF handler + Hono) | Lambda + Function URL / API Gateway | Node adapter + Hono sarmalayıcı |
| Veri | D1 (SQLite) | **DynamoDB** (on-demand) | ~120 SQL sorgusunun veri modeline çevrilmesi |
| Medya | R2 | S3 | `BlobStore` adaptörü (hazır arayüz) |
| Oturum | CF KV (Astro sessions) | DynamoDB / imzalı cookie | session driver değişimi |
| Cron | CF Cron Trigger | EventBridge Scheduler → Lambda | zamanlanmış handler |
| Build | CodeBuild (B1) | aynı | — |
| Hosting | S3 + CloudFront | aynı | — |

**Maliyet (100 free site, düşük trafik):**

| Kalem | Aylık |
| --- | ---: |
| Lambda + Function URL | ~0–1 $ |
| DynamoDB on-demand | ~0–1 $ |
| S3 + CloudFront | ~0,2 $ |
| CodeBuild | ~1,5 $ |
| Route53 + domain | ~2,5 $ |
| **Toplam** | **~5–7 $** |

**Neden tek adımda yapılmıyor:** D1 SQL sorgularının DynamoDB'ye çevrilmesi ve
auth/session katmanının yeniden yazılması 2–4 haftalık, ürünü riske atan bir
iştir. Bu yüzden sıra:

1. **B1 (bu PR):** build'i CodeBuild'e al → VM yükü kalkar, maliyet ~1,5 $/100 build.
2. **B2a:** uygulamayı Node adapter ile Lambda'ya al, veriyi **SQLite on EFS**
   ile koru (DynamoDB'ye geçmeden). EFS + Lambda VPC/NAT gerektirir; NAT
   Gateway yerine NAT instance (~3 $/ay) kullanılabilir.
3. **B2b:** trafik artınca DynamoDB'ye geçiş.

## B3 — Uygulama sunucusuz (alternatif)

EFS/NAT karmaşasından kaçınmak için en pratik "tam AWS" adımı:
uygulamayı **Lambda Web Adapter + SQLite on EFS** yerine küçük bir
**Lightsail 1–2 GB** üzerinde tutmak (AWS içinde kalır, ~7–12 $/ay) ve
build'i CodeBuild'e vermek. Toplam ~10–15 $/ay.

## Durum

- [x] CodeBuild entegrasyonu + buildspec + IAM script
- [x] CodeBuild projesini oluştur (`wuppycms-build`)
- [x] Canlı doğrulama: build `f1d8d309` SUCCEEDED, callback 200, iş `deployed`, site 200
- Not: Cloudflare hedefi hâlâ VM worker'ında (`wrangler pages deploy`); AWS hedefi CodeBuild'de
- [ ] B2a/B2b (Lambda/DynamoDB) — plan onayı bekliyor
- [ ] Cloudflare hedefi: değişmedi (müşteri hesabı, direct upload)

## Nihai durum (VM kapalı)

| Bileşen | Nerede |
| --- | --- |
| Uygulama (`app.wuppycms.com`) | CloudFront E37GBK1PZTILH5 → Lambda `wuppycms-app` |
| Pazarlama (`wuppycms.com`, www, docs, test) | CloudFront EJJN4Y43OMI8M → S3 `wuppycms-marketing` |
| AWS site yayını | CodeBuild `wuppycms-build` → S3 `wuppycms-sites` → CloudFront |
| Cloudflare yayını | CodeBuild `wuppycms-build` → müşteri hesabı (`wrangler pages deploy`) |
| Veri | Lambda `/tmp` SQLite + Litestream → S3 `wuppycms-app-db-243581477449` |
| AI | 9router, Lambda konteynerinde (127.0.0.1:20128) |
| Cron | EventBridge `wuppycms-cron-5m` → Lambda `wuppycms-cron` → `/api/cron` |
| Medya | S3 `wuppycms-media` |

Lightsail `wuppycms` **stopped** (us-east-1). Disk + statik IP için küçük ücret
devam eder; kalıcı sıfırlamak için `delete-instance` + `release-static-ip`.

Doğrulama (VM kapalıyken): wuppycms.com 200, app health 200, sites 200,
Cloudflare pages.dev 200 (CodeBuild ile).
