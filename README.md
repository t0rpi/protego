# PROTEGO

Romania's personal-safety infrastructure — a free safety layer (Shield) + on-demand
protection missions + subscriptions + Night & Cargo verticals + a licensed-partner
marketplace. Operated by our own licensed security company (Legea 333/2003).

**Source of truth:** [`PROTEGO_MASTERPROMPT_v2.2.md`](./PROTEGO_MASTERPROMPT_v2.2.md) +
[`docs/`](./docs). Never contradict them — see [`CLAUDE.md`](./CLAUDE.md) for the
non-negotiable rules this repo is built under.

Architecture rationale, dependency choices, Supabase schema draft, payments flow,
realtime latency targets and the milestone → acceptance-test mapping all live in
[`docs/architecture/repository-audit.md`](./docs/architecture/repository-audit.md).

## Status

**M0 — Fundament.** Monorepo scaffold, CI, design tokens synced, no auth/booking/
payments/maps yet. See [`docs/product/roadmap.md`](./docs/product/roadmap.md) for
the full M0–M10 plan and [`docs/testing/acceptance-tests.md`](./docs/testing/acceptance-tests.md)
for what "done" means per milestone.

## Stack

pnpm workspaces · Next.js (dispatcher + admin + client-web) · Expo Router
(client + agent) · Supabase (Postgres, Auth, Realtime, RLS) · Stripe manual
capture · TypeScript everywhere · i18n RO (default) / EN from day one.

## Structure

```
apps/
  web/            Next.js App Router — dispatcher (/dispatcher), admin (/admin),
                   client-web ("/")
  mobile/          Expo Router — client ("/"), agent ("/agent")
packages/
  ui/              design tokens (synced from design/tokens.json), component library
  domain/          shared business logic (mission state machine, pricing engine)
  validation/      shared zod schemas
  config/          i18n resources (synced from design/strings.*.json), shared constants
supabase/          migrations, config, seed (no tables yet — M0)
design/            design handoff: HANDOFF.md, tokens.json/css, strings.ro/en.json, assets/
docs/              product, architecture, legal, operations, testing docs
```

## Getting started

```bash
corepack enable
pnpm install
pnpm run dev         # turbo run dev (apps/web, apps/mobile)
pnpm run lint        # turbo run lint
pnpm run typecheck   # turbo run typecheck
pnpm run test        # turbo run test
```

Copy [`.env.example`](./.env.example) as needed per app — it lists variable names
only; no real values are ever committed.

### Regenerating design tokens / i18n strings

Tokens and i18n strings are synced from the design handoff, not hand-edited:

```bash
pnpm --filter @protego/ui run tokens:sync      # design/tokens.json → packages/ui/src/tokens.ts + tokens.css
pnpm --filter @protego/config run strings:sync # design/strings.ro/en.json → packages/config/src/i18n
```

## Rules (see CLAUDE.md for the full, binding list)

- Implement only the current milestone. Nothing beyond it.
- Supabase RLS on every table. No service-role key client-side.
- Stripe manual capture only. Prices come from DB config, never constants.
- High-risk missions require human confirmation — enforced in code, not just policy.
- One milestone = one prompt = one verified commit.
