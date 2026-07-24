# PROTEGO
Personal-safety infrastructure app of a licensed Romanian security company.
Source of truth: PROTEGO_MASTERPROMPT_v2.md + docs/. Never contradict them.
## Rules
- TypeScript everywhere. pnpm only. Conventional commits.
- Implement only the current milestone. Nothing beyond it.
- Supabase RLS on every table. No service-role key client-side.
- Stripe manual capture only. Prices come from DB config, never constants.
- All user-facing strings via i18n (ro default, en). Dark theme native.
- High-risk missions require human confirmation — enforce in code.
- No secrets in repo. Tests required per milestone acceptance criteria.
