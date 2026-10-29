# Contributing to WuppyCMS

Thanks for your interest. This file explains how the project is developed and
what a pull request is expected to contain.

## What this is

- **WuppyCMS** — the open-source, self-hostable core (this repository).
- **Wryte** — the hosted cloud version built on the same core. It is not a
  separate product; the Cloudflare stack (D1/R2/Queues/Cron/AI) is its
  reference adapter. Core features must not depend on Cloudflare-specific
  services (ADR 0006).

Content always lives in the customer's Git repository. The CMS never stores
content in its own database; every save is a normal commit ending with
`(via WuppyCMS)`.

## Development setup

```bash
pnpm install
cp apps/builder/.dev.vars.example apps/builder/.dev.vars   # fill the values
pnpm --filter @wuppycms/builder exec wrangler d1 migrations apply wuppycms --local
pnpm --filter @wuppycms/builder exec astro dev --background   # http://localhost:4321
```

- `.dev.vars` needs `GITHUB_TOKEN` (a repo-scoped PAT works for development),
  `BETTER_AUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `BETTER_AUTH_URL`.
- Node 22+ and pnpm are required. There is no npm/yarn support.

## Before opening a pull request

Run the same gates CI would run (all are expected to pass):

```bash
pnpm check:brand                  # user-facing brand must be WuppyCMS
pnpm -r typecheck                 # 0 errors
pnpm vitest run                   # unit tests
node apps/builder/scripts/check-locales.mjs        # locale files vs tr source
node apps/builder/scripts/e2e-admin-nav.mjs        # browser smoke (network-free mock)
node apps/builder/scripts/e2e-media.mjs            # full media package
```

The browser suites are **network-free by default**: they start a mock GitHub
server and their own dev server. See `docs/e2e-conventions.md` for the
conventions ("(known issue)" tests, clock pinning, wait discipline). Benchmarks
(`node apps/builder/scripts/bench.mjs`) are run manually on the same machine;
they are not part of CI.

## Code rules

- Binding decisions live in `docs/adr/`. Read them before changing
  architecture; if a decision changes, write a new ADR instead of editing the
  old one.
- UI primitives come from the Bejamas registry only (`docs/bejamas-ui.md`);
  never hand-write buttons, dialogs, inputs, etc.
- The admin URL is the single source of truth for navigation state
  (react-router + `src/lib/admin/url.ts`); server reads go through TanStack
  Query (ADR 0005).
- Keep files focused (~500 lines). Business logic belongs in `src/lib/`,
  not in components.
- New behaviour comes with a test. Bug fixes come with a test that fails
  without the fix.

## Pull requests

- One topic per PR; a short description of the user-visible change and how it
  was verified.
- Tests and typecheck green. E2E evidence (screenshot or harness output) for
  UI changes is welcome.
- **AI-assisted contributions are welcome, low-quality AI output is not.**
  PRs that are obviously unreviewed machine output (fabricated APIs, broken
  tests, unrelated rewrites) will be closed without review.
- Localization PRs: only `src/lib/locales/<lang>.yaml` changes, key set and
  comments must match `tr.yaml` exactly — see `docs/i18n.md`. Run
  `node scripts/check-locales.mjs` before opening the PR.

## Reporting bugs / security

- Bugs: open an issue with a reproduction (repo layout, steps, expected vs
  actual).
- Security: see `SECURITY.md` — do not open public issues for vulnerabilities.
