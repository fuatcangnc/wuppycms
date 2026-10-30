# AWS Node uygulaması (B2a) — durum

Uygulama artık **Node** üzerinde çalışabiliyor: Astro Node adapter (middleware)
+ Hono API + SQLite + S3. Cloudflare yolu (`worker.ts`) varsayılan olarak
korunuyor; AWS build'i ayrı yapılandırma kullanıyor.

## Yerel doğrulama (tamamlandı)

```bash
cd apps/builder
node scripts/build-aws.mjs           # dist/ + dist-node/
set -a; . ./.dev.vars; set +a
DB_PATH=/tmp/wuppy.db MIGRATIONS_DIR=./db/migrations PORT=8100 \
  node server-node.mjs
```

| Test | Sonuç |
| --- | --- |
| Migration'lar (0010'a kadar) | ✅ SQLite'a uygulandı |
| `GET /api/health` | 200 |
| `GET /login` | 200 |
| `POST /api/auth/sign-up/email` | 200 (oturum çerezi) |
| `GET /api/deploy/targets` (oturumlu) | 200 |
| `GET /projects` (oturumlu) | 200 |

## Bileşenler

| Dosya | Görev |
| --- | --- |
| `astro.config.node.mjs` | Node adapter (middleware) + `cloudflare:workers` shim alias |
| `src/lib/platform/sqlite.ts` | D1 uyumlu SQLite (`better-sqlite3`) |
| `src/lib/platform/s3.ts` | R2 uyumlu S3 blob store |
| `src/lib/platform/aws-node.ts` | Platform kurulumu + migration uygulama |
| `src/server-aws-api.ts` | Hono `api` + `preview` mount'ları |
| `server-node.mjs` | Node HTTP girişi (API + Astro) |
| `scripts/build-aws.mjs` | Astro Node build + API/platform bundle |
| `Dockerfile.aws` | Lambda container imajı |

## Dağıtım için iki seçenek

### A) SQLite on EFS (planlanan)
- Lambda VPC içinde; EFS erişim noktası `/mnt/data`.
- VPC dışına çıkış (GitHub/AI/S3) için NAT gerekir: NAT Gateway ~32 $/ay,
  NAT instance (t4g.nano) ~3 $/ay.
- Avantaj: tek yazıcı, kalıcı disk, bilinen desen.

### B) Litestream + S3 (önerilen, daha ucuz)
- Lambda VPC dışında (NAT/EFS yok).
- Açılışta SQLite S3'ten restore, kapanışta/sürekli S3'e replicate.
- Lambda **reserved concurrency = 1** (tek yazıcı).
- Maliyet: yalnız Lambda + S3; ~0–2 $/ay.

## Kalan adımlar
1. Docker imajını ECR'a it, Lambda fonksiyonunu oluştur (Web Adapter katmanı).
2. Seçenek B ise Litestream konfigürasyonu + S3 bucket.
3. `app.wuppycms.com` → Lambda Function URL (CloudFront üzerinden).
4. Cloudflare Cron yerine EventBridge Scheduler → `/api/cron` (zamanlanmış yayın).
5. Uçtan uca test: kayıt → proje → AI düzenleme → CodeBuild → site.

## Lambda + Litestream (canlı)

| Adım | Sonuç |
| --- | --- |
| Fonksiyon | `wuppycms-app` (container, 2048 MB, 300 s, x86_64) |
| URL | https://sbalbi5q4vc3snckzz5fu6f2ve0mqggy.lambda-url.us-east-1.on.aws/ |
| Soğuk başlangıç | ~18 s (Litestream restore + Astro) |
| `/api/health` | 200 |
| `/login` | 200 |
| Kayıt + oturum | 200 |
| `/api/deploy/targets` | 200 (oturumlu) |
| `/projects` | 200 (oturumlu) |
| Litestream → S3 | `wuppycms-app-db-243581477449/wuppycms.db/generations/...` |

Dağıtım: `bash scripts/aws/deploy-lambda.sh` (Docker buildx + ECR + Lambda + URL).

### Kalan adımlar
1. `app.wuppycms.com` → CloudFront + Function URL (ACM sertifikası + Route53).
2. Medya yükleme testi (S3 `wuppycms-media`).
3. Ajan satır içi çalışma testi (`AGENT_INLINE=1`, 300 s timeout).
4. Cloudflare Cron yerine EventBridge → `/api/cron`.
5. Cutover sonrası Lightsail kapatılır; kalan maliyet Lambda + S3 + CodeBuild.
