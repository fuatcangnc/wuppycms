# @wuppycms/builder

WuppyCMS'ın ana ürünü: sohbet + önizleme + git tabanlı CMS. Astro (Workers'ta) +
**Hono** API + D1 + R2. Mimari ve kurallar için kök dizindeki
`.opencode/skills/wuppycms-git-cms/` belgelerine bakın.

## Komutlar

```bash
pnpm dev          # astro dev — Hono API dahil (http://localhost:4321)
pnpm build        # üretim derlemesi (dist/)
pnpm typecheck    # tsc --noEmit
pnpm deploy       # astro build && wrangler deploy
```

## Yapı

- `src/worker.ts` — worker girişi: `cf()` middleware → statik varlıklar;
  `/api/*` → Hono; kalan her şey → Astro sunucusu.
- `src/api/` — Hono route'ları (`/api/health`, `/api/git/*`).
- `src/lib/git/` — GitHub istemcisi (fetch tabanlı; yazma Git Data API'siyle
  atomik çok dosyalı commit) ve commit hazırlama (TuranCMS deseni).
- `src/lib/crypto.ts` — token şifreleme (AES-256-GCM, `iv:tag:ciphertext`) ve
  deterministik arama indeksi (HMAC-SHA256).
- `db/migrations/` — D1 migration'ları (`wrangler d1 migrations apply wuppycms --local`).

## Git API

Kimlik: geliştirmede `.dev.vars` içindeki `GITHUB_TOKEN`; üretimde better-auth
oturumu + `account` tablosundaki GitHub access token'ı (repo kapsamı).

| Uç | Açıklama |
| --- | --- |
| `GET /api/health` | Servis kontrolü |
| `GET /api/git/repos` | Token'ın eriştiği depolar (son itmeye göre) |
| `GET /api/git/repo?full_name=owner/repo` | Repo özeti |
| `GET /api/git/branches?full_name=…` | Dallar |
| `GET /api/git/branch?full_name=…&branch=…` | Tek dal |
| `GET /api/git/tree?full_name=…&ref=…&recursive=1` | Dosya ağacı |
| `GET /api/git/file?full_name=…&path=…&ref=…` | Tek dosya (metin) |
| `GET /api/git/compare?full_name=…&base=…&head=…` | Diff/inceleme |
| `POST /api/git/commit` | Atomik commit: `{full_name, branch, message, files[], author?}` |

## Kimlik (better-auth)

`/api/auth/*` — e-posta/şifre + GitHub sosyal girişi (env'de client id/secret
varsa). GitHub OAuth App'e şu callback eklenmelidir:
`<origin>/api/auth/callback/github` (yerelde `http://localhost:4321/api/auth/callback/github`).

## Sayfalar

- `/` — karşılama
- `/cms` — git tabanlı CMS editörü: repo bağla → dosya ağacı → frontmatter
  formu + içerik → kaydet (commit). Kanıt ekran görüntüsü: `docs/evidence/`.

## Ortam

`.dev.vars.example` → `.dev.vars`:

- `GITHUB_TOKEN` — yerel geliştirme için GitHub token'ı (repo kapsamı).
- `TOKEN_ENCRYPTION_KEY` — 64 hex karakter (`openssl rand -hex 32`).
