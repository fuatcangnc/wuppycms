# Self-hosting WuppyCMS

WuppyCMS is the open-source core. It runs as a single Cloudflare Worker
(Hono API + Astro admin UI) and can also be deployed by the hosted version
(Wryte) unchanged — the Cloudflare stack is the reference adapter (ADR 0006).

## Requirements

- A Cloudflare account (Workers + D1 + R2).
- Node 22+ and pnpm.
- A GitHub OAuth App (for sign-in and repository access) **or** a personal
  access token for single-user development setups.

## 1. Install and configure

```bash
pnpm install
cp apps/builder/.dev.vars.example apps/builder/.dev.vars
```

Fill `apps/builder/.dev.vars`:

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Development convenience: one repo-scoped PAT used for all git operations. Leave empty in production (users connect their own GitHub account). |
| `BETTER_AUTH_SECRET` | Session signing key (`openssl rand -base64 32`). |
| `TOKEN_ENCRYPTION_KEY` | 64-hex key for encrypted tokens/keys (`openssl rand -hex 32`). |
| `BETTER_AUTH_URL` | Public base URL of the deployment (e.g. `https://cms.example.com`). |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App credentials (callback: `<base>/api/auth/callback/github`). Optional if you rely on `GITHUB_TOKEN`. |

## 2. Create the backing services

```bash
cd apps/builder
pnpm exec wrangler d1 create wuppycms          # then paste the id into wrangler.jsonc
pnpm exec wrangler r2 bucket create wuppycms-media
pnpm exec wrangler d1 migrations apply wuppycms --remote
```

Update `wrangler.jsonc`: the `d1_databases[0].database_id` must be the real
id from `wrangler d1 create` (the repository ships `local-dev` for local
development).

## 3. Deploy

```bash
pnpm exec wrangler deploy
```

Optional: bind a custom domain to the Worker, then set `BETTER_AUTH_URL` to
it and redeploy (better-auth rejects other origins).

## 4. Scheduled publishing

`wrangler.jsonc` ships a Cron Trigger (`*/15 * * * *`) that calls the
scheduler: documents whose `publishAt` has passed are flipped to
`status: ready` with a commit. On non-Cloudflare hosting, call
`POST /api/schedule/run` from your own cron (it accepts an optional
`full_name` to scope a single repository).

## 5. Local development

```bash
pnpm --filter @wuppycms/builder exec wrangler d1 migrations apply wuppycms --local
pnpm --filter @wuppycms/builder exec astro dev --background
```

Browser suites and benchmarks: see `docs/e2e-conventions.md`.

## Notes

- Content never enters D1: the database holds identity, project membership,
  AI settings and nothing else. Everything content-shaped lives in the
  customer's repository (`.wuppycms/` for CMS metadata, `_trash/` for deleted
  documents).
- Media files live in the repository (`public/…`) or in an R2 bucket per
  site; metadata is committed to `.wuppycms/media.json`.
- Upgrading: pull, re-run `pnpm install`, apply new D1 migrations, redeploy.
