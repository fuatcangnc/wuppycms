## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## E2E / browser tests

Browser test conventions (mock-first, shared mock env, "(known issue)" tests,
clock pinning, wait discipline): `../../docs/e2e-conventions.md`; suites — both
default to a network-free mock that manages its own dev server (stop any :4321
server first); `--real` uses dev :4321 + real GitHub. The product ships English
first (`DEFAULT_LOCALE = "en"`); shared `login()` pins the persisted locale to
`tr` so legacy suites keep asserting the Turkish UI — `e2e-editor-layout` runs
unpinned and proves the English startup language. Harness helper contract:
`clickButtonByText` (and the suites' `clickExact`) match `textContent` PLUS
`title`/`aria-label` — icon toggles (eye/code split icons, Outline/Research/AI
panel keys, FRONTMATTER chevron) are clicked via their `title`. The editor
toolbar's pinned right cluster (split icons + Focus + panel keys) must stay
visible at all times (asserted by `e2e-editor-layout` step 8f):
- `node scripts/e2e-media.mjs` (port :4399, full media package)
- `node scripts/e2e-admin-nav.mjs` (port :4398, router/navigation smoke)
- `node scripts/e2e-draft-backup.mjs` (port :4397, unsaved-draft recovery)
- `node scripts/e2e-meta-panel.mjs` (port :4396, status chip + YAML/MD views + OG)
- `node scripts/e2e-history.mjs` (port :4394, versions + snapshot + diff/restore)
- `node scripts/e2e-board-trash.mjs` (port :4393, board drag/drop + calendar + trash)
- `node scripts/e2e-schedule.mjs` (port :4392, publishAt executor + media manifest)
- `node scripts/e2e-ai.mjs` (port :4391, BYO AI settings + generation)
- `node scripts/e2e-parity.mjs` (port :4390, media:// links + width/focal + copy as MD/HTML)
- `node scripts/e2e-collections-embeds.mjs` (port :4389, add-collection wizard + embeds)
- `node scripts/e2e-team.mjs` (port :4388, invites + shared projects, two contexts)
- `node scripts/e2e-review.mjs` (port :4387, review branch + PR + merge)
- `node scripts/e2e-research.mjs` (port :4385, research notes + link suggestions)
- `node scripts/e2e-draft-tabs.mjs` (port :4384, local draft tabs + IndexedDB persistence)
- `node scripts/e2e-editor-layout.mjs` (port :4383, Wryte split layout + panel
  columns + source pane; runs unpinned → asserts the English startup UI)
- `node scripts/e2e-editor-crud.mjs` (port :4382, editor CRUD full sweep:
  formatting toolbar, media insert preview + repo-only link, embed, find &
  replace, undo/redo, save commit + reload roundtrip; runs unpinned/English)

Benchmarks (large data, NOT in CI — compare on the same machine):
`node scripts/bench.mjs` (5000 entries / 300 assets, port :4386) then
`node scripts/bench.mjs compare bench-results/baseline`.

Localization: `node scripts/check-locales.mjs` validates every locale file
against the `tr` source (key parity, placeholders). Rules: `../../docs/i18n.md`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:
- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## UI primitives — Bejamas only

Never hand-write UI primitives (button, input, dialog, table, badge, tooltip…)
and never pull them from a third-party library. Any component in the Bejamas
registry must be used from Bejamas: fetch the source with
`node ../../scripts/bejamas.mjs <name>` and port it class-for-class into
`src/components/ui-react/<name>/`. Policy + component list:
`docs/bejamas-ui.md`.

## Routing — react-router owns the URL (ADR 0005)

The admin island routes with **react-router-dom v7**; the URL is the single
source of truth for navigation state and the Nanostores atoms (`$view`,
`$collection`, `$doc`, `$mediaFolder`…) are projections of it (`RouteApplier`).
Binding rules:

- The URL contract lives in `src/lib/admin/url.ts` (pure `parseAdminPath` /
  `viewUrl`). Change it there and keep `url.test.ts` green.
- Actions navigate via `goTo()` (`src/lib/admin/navigate.ts`). Components never
  touch `history` or set navigation atoms directly.
- Never call `createBrowserRouter` at module scope — workerd SSR has no
  `document`. Use `getAdminRouter()` and keep the island `client:only="react"`
  in `AdminShell.astro`.
- Verify navigation changes with the browser smoke test:
  `node scripts/e2e-admin-nav.mjs` (dev server running, system chromium).

## Server state — TanStack Query (ADR 0005)

API reads go through `queryClient` (`src/lib/admin/queryClient.ts`):
`useQuery` in components, `queryClient.fetchQuery` in imperative actions, and
`invalidateQueries` after every git mutation. Do not add new hand-rolled
fetch-into-atom caches. Exception by design: the doc editor's baseSha save
flow and the media list stay store-driven (see ADR for staged migration).

Architecture decisions: `docs/adr/` (0001 single React island, 0002 Bejamas
ports, 0003 superseded by 0005 URL scheme + react-router + TanStack Query,
0004 theme). Reconcile with the blueprint skill or write a new ADR.

## AI widget (ADR 0008)

The admin island renders `components/admin/widget/Widget.tsx` (launcher +
drawer + preview canvas). Binding rules:

- Backend lives in `lib/agent/` (loop, providers, tools, D1 store) and
  `api/agent.ts`; sessions/events are polled, not streamed over a socket.
- Tools write to the customer's Git repo via `lib/git`; every write is a real
  commit and is recorded in `agent_changes` for undo. Keep the allowlist in
  `lib/agent/tools.ts` strict.
- The element picker is cross-origin safe: the site template's
  `WuppycmsBridge.astro` owns DOM access and relays `postMessage` events. Do not
  try to read `iframe.contentDocument` from the admin.
- The widget UI is React + Tailwind 4 and Bejamas ports — the upstream
  turan-widget's injected CSS must not be copied. All strings go through `t()`
  (`widget.*` keys in `src/lib/locales/*.yaml`).
- Multilingual site features (locale scope, translation lists, hreflang, media
  i18n) are intentionally out of scope for this port.
