# PROTEGO — Audit de arhitectură a repository-ului (P4)

**Rol:** lead software architect. **Model:** raționament extins (Opus).
**Status:** DRAFT pentru aprobare — **fără cod de aplicație scris**. Se oprește după acest document și așteaptă aprobare înainte de M0 (P5).
**Data:** 24 iulie 2026.

**Surse de adevăr (în ordine de prioritate):**
1. `PROTEGO_MASTERPROMPT_v2.2.md` (rădăcină) — sursa unică; §2 decizii închise, §5E model de date, §7 roadmap, §8 prompturi.
2. `docs/architecture/data-model.md` (entități + convenția MVP / future-ready) și `docs/architecture/system-architecture.md`.
3. `docs/product/` (prd, business-rules, user-flows, roadmap, services-catalog, supply-model, vision, open-decisions).
4. `docs/testing/acceptance-tests.md`.
5. `docs/legal/` (compliance-checklist, questions-for-lawyer).
6. `design/HANDOFF.md` + `tokens.json` / `tokens.css` + `strings.ro.json` / `strings.en.json` + `assets/`.

> **Regulă de precedență a designului (HANDOFF §8):** unde `HANDOFF.md` deviază intenționat de la `protego-prototip.html`, **designul câștigă**; orice alt conflict prototip ↔ design-system se rezolvă în favoarea design-system-ului (tokens + componente + ui_kits). Acest audit tratează HANDOFF ca autoritate de UI.

---

## 0. Rezumat executiv

Arhitectura confirmă integral stack-ul din decizia închisă §2.5: monorepo pnpm, Next.js (web: dispecerat + admin + client-web), Expo/React Native (client + agent), Supabase (Postgres + Auth + Realtime + RLS), Stripe manual capture, i18n RO/EN din ziua 1, dark mode nativ. Nu se identifică niciun blocaj tehnic la M0. Blocajele reale sunt **legale/operaționale** (categoriile licenței 333/2003 — #2; date operaționale — #8) și afectează M1+ (texte legale, onboarding agenți), **nu** M0.

Sunt semnalate 3 contradicții documentare (secțiunea 8) — cea mai importantă: `roadmap.md` și `open-decisions.md #1` încă declară orașul pilot „deschis", în timp ce **v2.2 §2.15 îl închide explicit ca ORADEA** (iar `strings.*.json` deja folosesc „Oradea"). Nu blochează M0, dar documentele derivate trebuie aliniate.

---

## 1. Structura monorepo (pnpm workspaces)

Confirmă și detaliază propunerea din `system-architecture.md` §3.

```
protego/
├── pnpm-workspace.yaml
├── package.json                 # scripturi root (turbo), engines: node/pnpm pin
├── turbo.json                   # orchestrare task-uri (build, lint, typecheck, test)
├── tsconfig.base.json           # config TS partajat (paths → packages/*)
├── .npmrc                       # pnpm: shamefully-hoist=false, strict peer deps
├── .env.example                 # DOAR nume de variabile, zero chei reale (test M0)
├── CLAUDE.md                    # ⚠ de creat la M0 din MASTERPROMPT §8 (nu există încă)
├── README.md
├── .github/workflows/ci.yml     # lint · typecheck · test (test M0)
│
├── apps/
│   ├── web/                     # Next.js App Router (TS + Tailwind)
│   │   ├── app/(dispatcher)/    # dispecerat: hartă, cozi, consolă SOS, risc ridicat
│   │   ├── app/(admin)/         # admin: motor prețuri, catalog switch-uri, audit log
│   │   ├── app/(client-web)/    # client-web opțional (paritate cu mobilul unde e util)
│   │   ├── app/api/             # route handlers server-only (Stripe webhooks, RPC gated)
│   │   └── middleware.ts        # gating de rol + sesiune Supabase (SSR)
│   │
│   └── mobile/                  # Expo Router (client + agent, două grupuri de rute)
│       ├── app/(client)/        # Shield, booking 10 pași, misiune activă, istoric
│       ├── app/(agent)/         # onboarding+documente, oferte 45s, statusuri, câștiguri
│       └── app/_layout.tsx      # provideri: i18n, tokens/tema, Supabase, React Query
│
├── packages/
│   ├── ui/                      # design tokens + component library (RN + web share)
│   │   ├── tokens.ts            # GENERAT din design/tokens.json (script de sync)
│   │   ├── tokens.css           # copiat/sincronizat din design/tokens.css (web/Tailwind)
│   │   └── components/          # Button, SOSButton, StatusPill, QuoteBox, Disclaimer112…
│   ├── domain/                  # logică de business pură, testabilă izolat
│   │   ├── pricing/             # motorul de prețuri v1 (citește config, NU constante)
│   │   ├── missions/            # mașina de statusuri missions (tranziții + guards)
│   │   └── rules/               # risc ridicat, gating vehicul client, overage
│   ├── validation/              # scheme zod partajate client/server (booking, quote…)
│   └── config/                  # i18n (RO/EN), constante non-secrete, enum-uri, feature flags
│       ├── i18n/strings.ro.json # sincronizat din design/strings.ro.json
│       └── i18n/strings.en.json # sincronizat din design/strings.en.json
│
└── supabase/
    ├── migrations/              # SQL versionat (schema + RLS + funcții + triggers)
    ├── functions/               # Edge Functions (server-only: Stripe, confirmări gated)
    ├── seed/                    # date demo pilot (servicii, pricing_config Oradea)
    └── config.toml
```

### 1.1 Unde se integrează `design/tokens.json` și string-urile i18n

| Artefact design | Destinație în repo | Mecanism |
|---|---|---|
| `design/tokens.json` | `packages/ui/tokens.ts` | **Script de sync** (HANDOFF §2): JSON → obiect TS tipat. Gradientele gold devin stopuri `expo-linear-gradient` cu aceleași valori (`#C9A227 → #E6C868 → #C9A227`). Sursă unică pentru React Native. |
| `design/tokens.css` | `packages/ui/tokens.css` → consumat de `apps/web` | Sursa pentru web. Tailwind mapează variabilele CSS: `colors.ink = 'var(--ink)'`, `--gold`, `--void`, `--warn` etc. `tokens.css` și `tokens.json` sunt **identice ca valori** (HANDOFF §2) — un test de CI verifică echivalența ca să nu diveargă. |
| `design/strings.ro.json` / `strings.en.json` | `packages/config/i18n/` | Chei **identice** RO/EN (garantat de HANDOFF §7). Consumat de `apps/web` (next-intl/i18next) și `apps/mobile` (i18next + `expo-localization`). RO = default, EN = secundar. |
| `design/assets/*.svg` (wolf, vehicle-suv, favicon, app-icon) | `packages/ui/assets/` + `apps/*/assets/` | `vehicle-suv.svg` = vehicul generic „SUV negru · premium", fără marcă/model (decizia #10). |

**Reguli de token, impuse în cod (HANDOFF §2, §1):**
- **O singură culoare de accent (gold).** Roșu (`--danger`) **exclusiv** pentru SOS/erori. `--warn` (#DE8B3F) **doar** pentru expirări documente agent.
- **Prețurile NU sunt tokens.** Valorile 180/60/20 lei vin din motorul de prețuri (DB config), niciodată din `tokens.json`/constante (`tokens.json.$schema` o afirmă explicit; test în secțiunea 6).
- Fonturi: **Cinzel** (500–700) DOAR pentru wordmark „PROTEGO" + monograme agent (uppercase, tracking .3–.34em); **Manrope** (400–800) pentru tot restul UI-ului. `@expo-google-fonts/cinzel` + `@expo-google-fonts/manrope` pe mobil.

### 1.2 De ce web-ul e o singură aplicație Next.js (dispecerat + admin)

Dispecerat și admin partajează sesiunea Supabase, RLS, componentele și build-ul; separarea se face prin route-groups + gating de rol în `middleware.ts`, nu prin două aplicații. Client-web e opțional și doar la paritate parțială cu mobilul (HANDOFF §5 mapează ecranele pe mobil ca sursă principală).

---

## 2. Dependințe (versiuni + rațiune)

Versiunile de mai jos sunt ținte la data auditului (iulie 2026, cutoff ian. 2026); la M0 se **pin-uiește** la ultima stabilă compatibilă și se consemnează în lockfile. Regula: doar dependințe strict necesare milestone-ului curent.

### 2.1 Fundație / tooling (M0)
| Pachet | Versiune țintă | Rațiune |
|---|---|---|
| `pnpm` | 9.15+ | Workspace-uri, store dedus, strict peer deps (decizie §2.5: „pnpm only"). |
| `node` | 20 LTS (sau 22) | Runtime pin în `engines`; aliniat cu Vercel + Supabase Edge (Deno separat). |
| `typescript` | 5.7+ | „TypeScript everywhere" (CLAUDE.md). `tsconfig.base.json` + project references. |
| `turbo` | 2.3+ | Orchestrare task-uri incrementale (build/lint/typecheck/test) — un milestone = un commit verificat. |
| `eslint` | 9.x (flat config) | Lint în CI (test M0). |
| `prettier` | 3.4+ | Format determinist. |
| `vitest` | 2.x | Teste unitare rapide pentru `packages/domain` (pricing, state machine) — cel mai valoros strat de test. |
| `@playwright/test` | 1.49+ | E2E web (dispecerat/admin) la M4+. |
| `maestro` / `jest-expo` | curent | Teste flow mobil la M2+. |

### 2.2 Web (`apps/web`)
| Pachet | Versiune | Rațiune |
|---|---|---|
| `next` | 15.x (App Router) | Decizie §2.5. SSR + route handlers server-only pentru Stripe/gating. |
| `react` / `react-dom` | 19.x | Cerut de Next 15. |
| `tailwindcss` | 4.0 | Mapează tokens.css → utilitare; dark-first. |
| `@supabase/ssr` | 0.6+ | Sesiune Supabase pe SSR/middleware, cookie-based, fără service-role în client. |
| `next-intl` **sau** `react-i18next` | 3.x / 15.x | i18n RO/EN; chei din `packages/config`. O singură bibliotecă i18n în tot monorepo-ul. |
| `@vis.gl/react-google-maps` **sau** `mapbox-gl` | curent | **Slot Map** (HANDOFF §6) — provider ales la M4; nu blochează ecranele. |

### 2.3 Mobil (`apps/mobile`)
| Pachet | Versiune | Rațiune |
|---|---|---|
| `expo` | SDK 54 (RN 0.81, New Arch) | Decizie §2.5. Pin la stabila curentă la M0. |
| `expo-router` | 5.x | Rutare file-based; grupuri `(client)` / `(agent)`. |
| `@expo-google-fonts/cinzel`, `@expo-google-fonts/manrope` | curent | HANDOFF §2 — fonturile de brand. |
| `expo-linear-gradient` | curent | Gradientele gold din tokens. |
| `expo-localization` | curent | Detectare limbă → i18n RO/EN. |
| `expo-notifications` | curent | Push Expo (client + agent). |
| `expo-location` | curent | Tracking (consimțământ GDPR obligatoriu). |
| `react-native-maps` **sau** `@rnmapbox/maps` | curent | Implementarea slotului Map pe mobil. |
| `@stripe/stripe-react-native` | 0.40+ | PaymentSheet / preautorizare pe mobil. |

### 2.4 Backend & plăți (transversal)
| Pachet | Versiune | Rațiune |
|---|---|---|
| `@supabase/supabase-js` | 2.47+ | Client Postgres/Auth/Realtime. |
| `stripe` (node) | 17.x | Server-only (Edge Functions / route handlers): PaymentIntents manual capture, refund, webhooks. |
| `zod` | 3.24+ | `packages/validation` — o singură schemă client+server (booking, quote, checklist vehicul). |
| `react-hook-form` | 7.x | Formulare booking/onboarding cu validare zod. |
| `@tanstack/react-query` | 5.x | Cache/refetch pentru datele Supabase (web + mobil). |
| `date-fns` | 4.x | Formatări oră 24h, durate; fără moment. |
| `@sentry/nextjs` / `@sentry/react-native` | 8.x / 6.x | Monitorizare erori (decizie §2.5). |

> **Risc de plată — de validat la M5, nu la M0:** confirmarea că **Stripe suportă manual capture + RON** în modul de operare al firmei din RO (altfel Netopia devine necesar mai devreme). Abstractizarea plăților (secțiunea 4.4) izolează acest risc.

---

## 3. Schema Supabase (draft) + RLS + mașina de statusuri

Derivată din `data-model.md`. **Nu** este SQL final — este draftul de schemă + strategia RLS + tranzițiile exacte, de aprobat înainte de M0/M1.

### 3.1 Convenții
- Fiecare tabelă: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`, `updated_at` (trigger). **RLS `enable` pe FIECARE tabelă** — inclusiv cele future-ready neactive (CLAUDE.md: „Supabase RLS on every table"). Tabelă fără politici + RLS on = deny-all implicit (corect pentru future-ready).
- Rol via `users.role` + claim în JWT; RLS citește `auth.uid()` și rolul.
- **Niciun service-role key client-side** — operațiile privilegiate (confirmări gated, Stripe, payout) trec prin Edge Functions server-only.

### 3.2 Entități MVP (active M1–M7)

| Tabelă | Coloane-cheie (draft) | Note |
|---|---|---|
| `users` | `role enum(client,agent,dispatcher,admin)`, `phone`, `email`, `verification_level int (1\|2)` | Nivel 1 = telefon OTP; nivel 2 = CI+selfie (test M1: booking blocat sub nivel 2). |
| `protected_persons` | `owner_id→users`, `name`, `relation`, `dob?` | „Rezervare pentru altcineva" din MVP. |
| `agents` | `user_id→users`, `source enum(elite,verified)`, `status enum(in_review,approved,active,blocked)`, `rating numeric`, `badges jsonb` | Tranziție status strict: `in_review→approved→active` (test M3, fără salt la active). `blocked` = documente expirate. |
| `agent_documents` | `agent_id→agents`, `type enum(atestat_igpr,cazier,ci,permis,asigurare)`, `expires_at date`, `status enum(valid,expiring,expired)` | Sursa alertelor + blocării automate (secțiunea 6). |
| `vehicles` | `owner_type enum(protego,client)`, `owner_id`, `plate?`, `class` | Vehicul PROTEGO (generic „negru premium/SUV") sau al clientului. |
| `vehicle_checklists` | `mission_id→missions`, `consent_signed_at`, `insurance_confirmed bool`, `photos jsonb(front,back,left,right,km,fuel)`, `client_signature_at` | Gating obligatoriu (secțiunea 6). |
| `services` | `key`, `wave int(1..4)`, `enabled_by_city jsonb` | **Switch on/off per oraș** = activarea valurilor devine configurare, nu cod. MVP: doar wave 1, doar Oradea. |
| `pricing_config` | `service_key`, `city`, `base`, `per_hour_agent`, `per_hour_vehicle`, `per_km`, `coef_night/weekend/urgent`, `min_bill`, `degressive_threshold_h`, `platform_fee`, `vat`, `free_cancel_min` | **Toată valoarea numerică de preț trăiește aici.** Demo Oradea: 180/60/20, prag 8h, anulare 60min. Zero constante în cod. |
| `missions` | `client_id`, `service_key`, `city`, `status enum` (3.4), `risk_level enum(normal,high)`, `agent_ids uuid[]`, `vehicle_id?`, `mobility enum(protego_veh,client_veh,on_foot)`, `verification_code char(4)`, `scheduled_at?` | **Coloana vertebrală.** Mașina de statusuri = 3.4. |
| `quotes` | `mission_id`, `breakdown jsonb (RowLine[])`, `total_estimate`, `currency 'RON'` | Rezultatul motorului de prețuri; defalcare obligatorie (QuoteBox + RowLine, HANDOFF §3). |
| `payments` | `mission_id`, `group_id? (null MVP)`, `stripe_payment_intent_id`, `type enum(auth,capture,refund,overage_auth)`, `amount`, `status` | Manual capture (secțiunea 4). `group_id` nullable din ziua 1 = punct de atașare split-payment fără migrare breaking. |
| `incidents` | `mission_id`, `reporter enum(agent,client,dispatcher)`, `type`, `severity`, `media jsonb`, `occurred_at` | Operațional + audit legal. |
| `ratings` | `mission_id`, `score int`, `tags text[]`, `feedback?` | Stele randate după valoare (HANDOFF §8.8). |
| `shield_events` | `user_id`, `type enum(sos,wwm_expired,location_share,fake_call)`, `location geography`, `status`, `resolved_by?`, `resolved_at?` | **Creată din schema inițială, dar activată funcțional abia la M6** (data-model §shield_events: „activată mai târziu în interiorul MVP-ului", NU future-ready în sensul Valurilor 2–4). Vezi 3.6. |
| `audit_log` | `actor_id`, `actor_role`, `action`, `entity`, `entity_id`, `payload jsonb`, `at` | Obligatoriu (business de securitate licențiat). Scriere append-only prin trigger; RLS: doar admin citește. |

### 3.3 Tabele future-ready (create, cu RLS, dar NEUTILIZATE funcțional în MVP)

Se creează devreme ca să nu impună migrări breaking (data-model §2). RLS activ = deny-all până la valul care le activează. **Nicio funcționalitate, niciun ecran** înainte de milestone.

| Tabelă | Val / Milestone de activare | Draft minim |
|---|---|---|
| `subscriptions` | Valul 2 / **M8** | `user_id`, `plan enum(drum_sigur,kids,senior,familie,business)`, `status`, `renews_at`. UI = doar placeholder vizual (`subs.*`, HANDOFF §5). |
| `groups` | Valul 3 / **M9** (split-payment Night) | `initiator_id`, `member_ids uuid[]`, `mission_id?`, `split_strategy?`. Flexibilă intenționat — mecanismul UX rămâne open-decision #6 (nu se pre-decide în schemă). |
| `partners` | Valul 4 / **M10** | `company_name`, `license_no`, `insurance`, `agent_ids`, `commission_rate (15–25%)`. |

> Regula de guvernanță (roadmap §2): nu se activează funcțional `groups`/`subscriptions`/`partners` în M0–M7 chiar dacă „pare eficient tehnic". Schema există; logica nu.

### 3.4 Mașina de statusuri `missions` — tranziții EXACTE permise

Enum canonic (`mission_status`), aliniat 1:1 cu `StatusPill` din HANDOFF §3 (`confirmed/enroute/arrived/active/done/review/sos`) plus stările interne și terminale necesare procesului:

```
draft          # booking în curs (fără pill; pre-ofertă)
quoted         # ofertă generată, așteaptă preautorizare (fără pill)
review         # RISC RIDICAT — confirmare umană obligatorie (pill „în verificare", auriu)
confirmed      # preautorizat (hold), în coada de asignare a dispeceratului
assigned       # agent a acceptat oferta 45s (intern; client vede tot „confirmed" până la enroute)
enroute        # agent pe drum
arrived        # agent a ajuns (clientul verifică codul)
active          # protecție activă (traseu monitorizat)
done           # încheiat → declanșează captura finală
# --- stări terminale de anulare ---
cancelled_client      # anulare de client (refund/eliberare hold după politică)
cancelled_agent       # agent indisponibil → reasignare (revine în coadă, nu terminal pt. misiune)
cancelled_dispatcher  # dispecerat nu poate prelua / risc respins
no_agent_available    # expirare fără agent
```

**Tranziții permise (guard-uri impuse în cod — secțiunea 6):**

| De la | Către | Gardă (enforcement) |
|---|---|---|
| `draft` | `quoted` | traseu + serviciu + persoane complete |
| `quoted` | `review` | **doar** dacă `risk_level = high` (chestionar context) |
| `quoted` | `confirmed` | `risk_level = normal` **ȘI** `verification_level = 2` **ȘI** preautorizare Stripe reușită **ȘI** (dacă `mobility=client_veh`) checklist complet |
| `review` | `confirmed` | **NUMAI** acțiune explicită dispecer (rol dispatcher) + apel + nivel 2 verificat. **Niciodată automat.** (business-rules §6, decizie închisă neconfigurabilă) |
| `review` | `cancelled_dispatcher` | dispecerul decide „nu putem prelua" |
| `confirmed` | `assigned` | agent a acceptat oferta în ≤45s |
| `confirmed` | `no_agent_available` | expirare cozii fără accept |
| `assigned` | `enroute` | agent tap „pornește spre client" |
| `assigned` | `cancelled_agent` | agent indisponibil → re-queue |
| `enroute` | `arrived` | agent tap „am ajuns" |
| `arrived` | `active` | **cod verificat** ȘI (dacă `client_veh`) checklist foto complet (test M3) |
| `active` | `done` | agent tap „închei" → captură |
| `confirmed`/`assigned`/`enroute`/`arrived` | `cancelled_client` | politica de anulare (gratuit ≥ `free_cancel_min` înainte) |
| oricare activă | `review`→SOS overlay | SOS este **eveniment overlay**, nu status de misiune (vezi 3.5) |

Tranzițiile se impun cu: (a) `CHECK`/trigger pe `missions` care validează perechea (old,new) contra unei tabele de tranziții permise; (b) RLS care limitează cine poate face fiecare tranziție (ex. `review→confirmed` doar rol dispatcher); (c) Edge Function pentru tranzițiile cu efecte externe (Stripe la `done`).

### 3.5 SOS ca overlay, nu status de misiune
`StatusPill` include `sos`, dar SOS este un **eveniment** (`shield_events` sau escaladare din misiune activă), redat ca overlay peste ecran/hartă (HANDOFF §6). O misiune activă rămâne `active` în timp ce un `shield_event(sos)` legat de ea e deschis — se evită coruperea mașinii de statusuri de business cu o stare de urgență. Consola SOS tratează identic sursele Shield-gratuit și misiune-plătită (dispatcher-playbook §3, §5).

### 3.6 Strategie RLS per rol (rezumat operațional — detaliu în migrații)

| Rol | Poate citi | Poate scrie | Note |
|---|---|---|---|
| **client** | doar `missions`/`quotes`/`payments`/`protected_persons`/`ratings` unde `client_id = auth.uid()` | booking propriu, rating propriu, consimțământ checklist | Nu vede alți clienți/agenți (test M1). Locația agentului: vizibilă **doar** cât misiunea e `enroute/arrived/active` (3.7). |
| **agent** | doar `missions` unde `auth.uid() = any(agent_ids)`; `agent_documents` proprii | statusuri misiune alocată, checklist, rapoarte, incident | Adresa exactă a misiunii dezvăluită de RLS **doar după `assigned`** (HANDOFF §1 „adresa doar după accept"). |
| **dispatcher** | toate `missions` active/neasignate, coada risc ridicat, `shield_events`, consolă SOS | asignare manuală, `review→confirmed`, jurnal SOS obligatoriu | Fără „aprobă tot" / multi-select pe risc ridicat (impus în UI + per-row RLS). |
| **admin** | `services`, `pricing_config`, `audit_log` complet, rapoarte financiare | config prețuri, switch-uri servicii/oraș, roluri | Nu vede conținut privat de misiune dincolo de necesarul financiar/audit. |

### 3.7 Locația live a agentului (regulă strictă)
Tabelă dedicată `mission_tracking` (sau canal Realtime — secțiunea 5) cu politică RLS: un client vede poziția agentului **numai** dacă există o misiune a lui în stare `enroute/arrived/active` și fereastra e deschisă; în afara ei, deny (test M4). Persistența traseului: downsampled, cu retenție GDPR definită + anonimizare (compliance §3 — valoarea de retenție rămâne de confirmat cu avocatul).

---

## 4. Fluxul Stripe manual-capture (authorize → capture → cancel/refund → overage)

Confirmă `system-architecture.md` §6. Toate apelurile Stripe sunt **server-only** (Edge Functions / route handlers); niciun secret în client (CLAUDE.md).

### 4.1 Authorize (la confirmarea misiunii → `confirmed`)
- `PaymentIntent` cu `capture_method: 'manual'`, `amount = quote.total_estimate`, `currency: 'ron'`, `customer`, metode salvate.
- Succes = **hold** pe card, **fără** captură (test M5: „preautorizare, nu captură imediată"). Se scrie `payments(type=auth)` + `audit_log`.
- Pentru `review` (risc ridicat): **nu** se preautorizează nimic până la confirmarea umană — clientul vede „nu s-a blocat încă nimic" (`review.nothingCharged`). Preautorizarea se face abia la `review→confirmed`.

### 4.2 Capture (la `done`)
- La trecerea `active→done`: `capture` cu `amount_to_capture = suma finală reală` (durată/traseu efectiv), care poate fi **≤** suma autorizată. Se scrie `payments(type=capture)`.
- Factură + raport pe email (business-rules §8).

### 4.3 Cancel / Refund
- **Anulare în fereastra gratuită** (`≥ free_cancel_min` înainte, valoare din `pricing_config`): `PaymentIntent.cancel` → **eliberare integrală a hold-ului**, fără captură (test M5). `payments` marcat, `audit_log`.
- **Anulare sub prag:** penalizare configurabilă (din `pricing_config`) — se capturează doar penalizarea, restul eliberat.
- **Refund post-captură** (dispută): flux manual `refund`, jurnalizat obligatoriu în `audit_log`; dispeceratul are doar vizibilitate, execuția e la Admin/financiar (dispatcher-playbook §7).

### 4.4 Overage (prelungire misiune)
- Overage **necesită acord explicit al clientului în aplicație** (business-rules §4) — niciodată automat. La Protecție cu ora, sistemul poate *propune* automat, dar aplică doar după confirmare umană (a clientului).
- Mecanism: manual capture Stripe permite captură **doar ≤** suma autorizată → pentru delta se emite o **re-preautorizare** = `PaymentIntent` nou (`type=overage_auth`) pe diferența estimată (business-rules §4, strings `quote.extendPolicy`/`pay.*`). Captura finală reflectă durata reală, pe ambele intents.
- *(Alternativă tehnică — incremental authorization — există la Stripe doar pe anumite carduri; nu ne bazăm pe ea. Re-preautorizarea prin PI nou este calea robustă și deja reflectată în copy-ul de design.)*

### 4.5 Unde se atașează split-payment (Night, Valul 3 / M9) — fără breaking changes
- `payments.group_id` este **nullable din ziua 1** și `groups` există din schema inițială (3.3). La M9, un „Gardian al Serii" creează un `group`, iar fiecare membru primește un `PaymentIntent` propriu (`group_id` setat), autorizat individual; captura se distribuie proporțional.
- Nimic din fluxul MVP (4.1–4.4) nu se schimbă — atașarea e aditivă. Mecanismul UX exact (cine inițiază, egal vs. custom, moment de preautorizare, ce se întâmplă dacă un membru nu confirmă) rămâne **open-decision #6, de decis la M9, nu acum** (v2.2 §2.12).
- **Netopia** (alternativă locală, post-MVP): abstractizare `PaymentProvider` în `packages/domain/payments` cu o interfață (authorize/capture/cancel/refund/overage) astfel încât Stripe să fie o implementare, nu un cuplaj dur.

---

## 5. Arhitectura de realtime (tracking + SOS) cu ținte de latență

Confirmă `system-architecture.md` §7. Supabase Realtime pe două canale distincte, cu caracteristici de latență diferite.

### 5.1 Tracking (poziția agentului, statusuri, chat)
- **Locație:** frecvență mare, valoare efemeră → **Realtime Broadcast** (nu scriere DB per ping), cadență **3–5s** cât misiunea e `enroute/arrived/active`. Persistență DB **downsampled** (ex. la 15–30s) în `mission_tracking` pentru audit/raport, cu RLS și retenție GDPR.
- **Statusuri misiune & chat:** `postgres_changes` pe `missions`/`messages` — clientul și agentul văd instant tranzițiile („un tap → dispeceratul și clientul văd instant", strings `agentApp.statusHint`).
- Ținte: propagare status **p95 < 1s**; poziție **p95 < 2s** de la emisie la afișarea pe hartă (client + consolă dispecer).

### 5.2 SOS (proprietatea cu cea mai mică toleranță la latență din platformă)
- La `insert` în `shield_events(type=sos)` **sau** escaladare din misiune activă → Realtime către **consola SOS a dispeceratului**, sonor + vizual + locație pe hartă (dispatcher-playbook §3).
- **Ținte concrete de latență:**
  - **SOS → apariția în consola dispeceratului: p95 < 1.5s, hard cap < 3s** (tehnic). Este bugetul de sistem, nu KPI-ul de business.
  - **KPI de business (v2.2 §2.14, prd §1): PRIM CONTACT UMAN al dispecerului la SOS < 60s.** Bugetul: livrare alertă <1.5s + preluare dispecer + apel „cu un click". Consola prioritizează timerul de 60s vizibil.
  - **Tratament identic** pentru SOS de la utilizator Shield gratuit și de la client plătitor (strings `dispatcher.kpiFirstContact`; dispatcher-playbook §3, §5).
- **Robustețe (defense in depth):** dacă alerta nu e preluată/ack-uită într-un prag scurt, **fallback SMS** (+ escaladare internă) — nu ne bazăm doar pe push/Realtime (system-architecture §8). SOS declanșează și partajarea link-ului live către cercul de încredere (strings `sos.*`).
- **`Disclaimer112` neomisibil** pe orice suprafață cu declanșator SOS (HANDOFF §1) — dispecerul nu promite niciodată timp de răspuns tip 112 (compliance §2).
- Activare **publică** SOS/Shield: doar la **M6**, după ce dispeceratul e rodat pe misiuni plătite (M4–M5) — gate obligatoriu (secțiunea 7, roadmap M6).

### 5.3 Interacțiunea cu mașina de statusuri
SOS rămâne overlay (3.5): misiunea nu-și schimbă `mission_status`; se creează un `shield_event`/`incident` legat, redat ca overlay roșu peste ecran/hartă, jurnalizare obligatorie înainte de închidere (strings `dispatcher.resolveGate`).

---

## 6. Enforcement-in-code (reguli impuse tehnic, nu doar documentar)

Regulile de mai jos sunt **decizii închise** și, unde e marcat, **neconfigurabile** — se impun în cod la mai multe straturi (DB + server + UI), niciodată doar prin convenție.

| # | Regulă | Mecanism de impunere (defense in depth) |
|---|---|---|
| 1 | **Misiunile cu risc ridicat NU se confirmă niciodată automat** (§2.7, business-rules §6, decizie absolută, **neconfigurabilă**) | (a) trigger pe `missions`: tranziția `review→confirmed` respinsă dacă actorul nu are rol `dispatcher`; (b) RLS: doar rolul dispatcher poate `update` acea tranziție; (c) fără flag de configurare care să o dezactiveze; (d) UI dispecer fără multi-select/„aprobă tot" (strings `dispatcher.riskRule`); (e) gate suplimentar: nivel 2 verificat + apel (`dispatcher.level2Gate`); (f) test acceptanță M2 (chestionar risc → nu se confirmă automat). |
| 2 | **Agent blocat pe documente expirate** (supply-model §2, user-flows edge) | (a) `agent_documents.expires_at` + scheduled function (pg_cron/Edge) care setează `status=expired` și `agents.status=blocked`; (b) query-ul de eligibilitate la ofertă exclude orice agent cu vreun document `expired`; (c) alertă de reînnoire înainte de expirare (`agentApp.docExpiry`); (d) dispecerul **nu** poate suprascrie manual fără procedură de excepție documentată (dispatcher-playbook §6, §10); (e) test M3 (document expirat → blocare automată, fără intervenție manuală). |
| 3 | **Gating checklist vehicul client** (business-rules §5, cele 4 condiții) | (a) `vehicle_checklists`: consimțământ + asigurare confirmată + 4 foto (360°) + KM + combustibil + semnătură client; (b) trigger: `quoted→confirmed` respinsă pentru `mobility=client_veh` fără checklist complet → **blochează trecerea la plată** (test M2); (c) trigger: `arrived→active` respinsă fără checklist complet (test M3); (d) validare zod în `packages/validation`. |
| 4 | **Prețurile vin DOAR din config DB, niciodată constante** (§2.6, CLAUDE.md, business-rules §1) | (a) motorul de prețuri (`packages/domain/pricing`) citește exclusiv `pricing_config`/`services` — semnătură fără parametri numerici hardcodați; (b) **regulă ESLint custom** care interzice literali numerici de preț în cod aplicație + review; (c) `tokens.json` declară explicit „Prices are NOT tokens"; test CI că `tokens` nu conține valori de preț; (d) test M2: admin schimbă un parametru → oferta reflectă noua valoare **fără deploy de cod**. |

Reguli conexe impuse tehnic: **niciun service-role key client-side** (doar Edge Functions); **RLS pe fiecare tabelă**; **i18n obligatoriu** (fără string-uri hardcodate în UI — chei RO/EN identice); **verificare nivel 2 înainte de prima misiune** (trigger la `quoted→confirmed`).

---

## 7. Milestones M0–M7 ↔ `acceptance-tests.md`

Fiecare milestone e „gata" doar când testele lui trec (roadmap §1). Mapare completă:

| M | Livrabil (roadmap) | Teste de acceptanță (Given/When/Then) | Artefacte cod principale |
|---|---|---|---|
| **M0** | monorepo, CI, tokens, medii | M0: CI (lint/typecheck/test) trece fără auth/booking/plăți/hărți; `.env.example` fără chei reale | întreg scheletul secțiunea 1; `packages/ui/tokens.ts`; `CLAUDE.md` (de creat) |
| **M1** | auth, roluri, verificare, RLS | M1: înregistrare telefon+email → rol client, nivel 1; nivel 1 blochează prima misiune (cere nivel 2); RLS blochează agent↔client și client↔client | `users`, RLS de bază, auth Supabase, IDV (CI+selfie) |
| **M2** | booking 3 servicii, ofertă, motor prețuri v1 | M2: ofertă defalcată din config (nu hardcodat); chestionar risc → **nu** auto-confirm → coadă risc ridicat; „vehiculul meu" fără checklist → blocat la plată; admin schimbă preț → ofertă nouă fără deploy | `packages/domain/pricing`, `missions`(draft→quoted→review/confirmed), `quotes`, `pricing_config`, `vehicle_checklists` (gating) |
| **M3** | app agent: onboarding, oferte 45s, statusuri, checklist, rapoarte | M3: status agent `in_review→approved→active` fără salt; ofertă neacceptată în 45s → expiră → coadă; document expirat → blocare automată; checklist incomplet → nu se poate `active` | `agents`, `agent_documents`, ofertă 45s, `enroute/arrived/active`, rapoarte/incident |
| **M4** | live ops: tracking, chat, SOS, dispecerat | M4: SOS din misiune activă → instant în consolă cu locație → protocol dispatcher-playbook; locație agent inaccesibilă în afara ferestrei (RLS); asignare manuală cu sugestii ordonate + acțiune explicită | Realtime (5.1/5.2), consolă SOS, `shield_events`(schema), coadă neasignate, `mission_tracking` RLS |
| **M5** | plăți: preauth/captură/refund/overage, payout | M5: confirmare → hold (nu captură); `done` → captură pe durata reală; overage fără confirmare → nicio re-preauth; anulare în fereastră → hold eliberat integral | secțiunea 4 integral; `payments`, Stripe Edge Functions, webhooks, payout săptămânal |
| **M6** | Shield public: SOS, WWM, cerc, apel fals | M6: după M4–M5 validate, orice user declanșează SOS/WWM/cerc/apel fals; WWM expirat fără check-in → cerc → escaladare dispecerat; **gate:** dacă M4–M5 nevalidat, activarea publică e **blocată** (obligatoriu) | activare funcțională `shield_events`, WWM timer, cerc de încredere |
| **M7** | QA & pilot un oraș | M7: build-uri Android/iOS + suita M1–M6 trece (orice eșec blochează lansarea); flow complet rezervare→alocare→activă→finalizare→rating/factură cu dispecerat manual, **fără** nimic din Valul 2–4 vizibil | builds, conturi demo, seed pilot Oradea, hardening |

> M8–M10 rămân doar schițate în `acceptance-tests.md` (post-pilot) — nu se detaliază acum, ca să nu ancoreze produsul pe decizii încă deschise (#6 split-payment UX etc.).

---

## 8. Riscuri, blocaje și contradicții

### 8.1 Contradicții documentare (de rezolvat, dar NU blochează M0)

| # | Contradicție | Detaliu | Recomandare |
|---|---|---|---|
| C1 | **Orașul pilot: închis vs. deschis** | `v2.2 §2.15` **închide** pilotul ca **ORADEA** (decizia #1); `strings.ro/en.json` (`booking.zoneNote`, `subs.note`, `agentApp.*`) folosesc deja „Oradea". Dar `roadmap.md` („Notă privind orașul pilot") și `open-decisions.md #1` **încă declară orașul deschis / Oradea doar ipoteză**. | Aliniere: marchează #1 „REZOLVAT (v2.2 §2.15 = Oradea)" în `open-decisions.md` și `roadmap.md`. Codul poate presupune Oradea ca oraș seed al pilotului. |
| C2 | **Referință de versiune a MASTERPROMPT-ului** | Toate documentele derivate + prompturile P2/P4 din §8 citează `PROTEGO_MASTERPROMPT_v2.md`; fișierul autoritativ real este **`PROTEGO_MASTERPROMPT_v2.2.md`** (v2.1 a închis #3–#7, v2.2 a închis #1). | Tratează v2.2 ca sursă unică (deja făcut în acest audit). Update cosmetic al referințelor „v2.md" → „v2.2" în docs când se ating. Fără impact tehnic. |
| C3 | **`missions.assigned` vs. `StatusPill`** | `data-model.md` listează „agent alocat" ca status distinct; `StatusPill` (HANDOFF §3, „mapare 1:1") enumeră doar `confirmed/enroute/arrived/active/done/review/sos`, fără pill „assigned". | Rezolvat în 3.4: `assigned` există ca stare **internă** (necesară procesului 45s), dar clientul rămâne pe pill „confirmed" până la `enroute`. De confirmat cu design ca decizie explicită. |

### 8.2 Blocaje legale/operaționale (moștenite din `open-decisions.md`; NU blochează M0)

- **#2 — Categoriile licenței 333/2003 + nr. licenței:** blochează finalizarea `compliance-checklist.md` și textele legale din **M1** (nu M0). Impact: încadrarea definitivă Protect Ride/Escortă/Protecție cu ora, temeiul GDPR de tracking. → lista din `questions-for-lawyer.md` la avocat.
- **#8 — Date operaționale:** nr. agenți + vehicule pilot, buget lunar, status domeniu protego.ro. Necesare pentru **M7** (pregătire pilot), nu pentru fundație.
- **GDPR:** perioada exactă de retenție a traseelor + anonimizare, DPO, eventual DPIA (cazier agenți = date sensibile) — de confirmat înainte de M4 (tracking) / M6 (Shield public).

### 8.3 Riscuri tehnice

| Risc | Impact | Mitigare |
|---|---|---|
| **Stripe manual capture + RON în RO** neconfirmat | M5 | Abstractizare `PaymentProvider` (4.5); Netopia ca fallback; validare la M5, izolat de M0–M4. |
| **Overage > suma autorizată** (manual capture capturează doar ≤ auth) | M5 | Re-preautorizare prin PI nou (4.4), deja reflectată în copy design; nu ne bazăm pe incremental authorization. |
| **Provider hărți nedecis** (Google Maps vs. Mapbox) | M4 | `Map` = slot provider-agnostic (HANDOFF §6): `{center, markers[], route?, onMarkerPress}`; alegerea nu atinge ecranele. |
| **Latență SOS** sub target sub sarcină | M4/M6 | Canal Realtime dedicat SOS + fallback SMS + timer 60s vizibil; test de încărcare înainte de M6 (gate Shield public). |
| **Amestecarea valurilor** (activare accidentală groups/subscriptions/partners) | tot MVP | RLS deny-all pe tabelele future-ready + regula de guvernanță roadmap §2 + review de milestone. |
| **Scurgere de secrete / service-role în client** | securitate | `.env.example` fără chei (test M0); Stripe/payout doar în Edge Functions; RLS pe fiecare tabelă. |
| **`CLAUDE.md` (rădăcina repo) lipsește** | M0 | Prompturile P4/P5 presupun `CLAUDE.md` la rădăcină; conținutul e specificat în MASTERPROMPT §8 dar fișierul **nu există încă** în repo → de creat ca prim artefact M0. |
| **Divergență tokens.json ↔ tokens.css** | UI | Test CI de echivalență valorică + script unic de sync către `packages/ui/tokens.ts`. |
| **Deriva prototip ↔ design-system** | UI | Regula HANDOFF §8 (designul câștigă) impusă ca sursă de adevăr de UI; prototipul e doar direcție vizuală. |

### 8.4 Fără contradicții cu MASTERPROMPT v2.2 pe fond
Stack-ul, modelul de date, mașina de statusuri, fluxul de plăți și țintele de realtime din acest audit sunt consistente cu deciziile închise §2 și cu §5E/§7. Singurele abateri sunt cele **documentare** (8.1) și **legale deschise** (8.2), niciuna blocantă pentru M0.

---

## 9. Concluzie & poartă de aprobare

**M0 poate începe fără blocaje tehnice.** Recomand aprobarea acestui audit ca bază pentru P5 (M0), cu 3 acțiuni de aliniere non-blocante făcute în paralel:
1. Marcarea #1 (oraș pilot = Oradea) ca REZOLVAT în `open-decisions.md` + `roadmap.md` (C1).
2. Crearea `CLAUDE.md` la rădăcina repo din MASTERPROMPT §8 ca prim artefact M0 (8.3).
3. Trimiterea listei din `questions-for-lawyer.md` la avocat — pe drumul critic pentru M1, nu M0 (8.2, #2).

**Puncte care necesită decizie explicită înainte de milestone-ul corespunzător:**
- Provider hărți (Google Maps vs. Mapbox) — înainte de M4.
- Confirmare Stripe RON + manual capture, altfel calendar Netopia — înainte de M5.
- Perioadă retenție GDPR + DPO/DPIA — înainte de M4/M6.
- Confirmarea design a stării interne `assigned` (C3) — înainte de M3.

**STOP — aștept aprobare.** Nu scriu cod de aplicație până la aprobarea explicită a acestui audit (P4 → P5), conform protocolului de coordonare §9.
