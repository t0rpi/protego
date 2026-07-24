# PROTEGO — Master Plan & Master Prompt
**Versiune:** 1.0 · 23 iulie 2026
**Rol document:** Sursa unică de adevăr pentru coordonarea proiectului în ecosistemul Claude (Projects, Cowork, Design, Code).
**Coordonator:** Claude (chat principal, model Fable 5) — toate deciziile majore trec pe aici.

---

## 0. Decizii închise (aprobate de fondator)

Aceste decizii NU se schimbă de niciun tool fără aprobare explicită în chatul de coordonare:

1. **Model juridic:** PROTEGO este aplicația propriei firme de pază, licențiată conform Legii 333/2003. NU marketplace în faza 1. NU agenți înarmați cu arme letale. Toate serviciile trebuie să se încadreze în licența firmei.
2. **Poziționare:** Transport securizat + protecție personală accesibilă, cu accent pe siguranța femeilor, copiilor și seniorilor. Tier premium corporate/VIP deasupra. NU "lux only".
3. **Branding:** Nume PROTEGO. Simbol: Lupul Dacic stilizat (inspirat din Draco Dacic), minimalist, premium. Culori: negru #0D0D0D, gri metalic, auriu. NU verde neon.
4. **Servicii MVP (doar acestea 3):**
   - **Protect Ride** — transport securizat A→B cu agent-șofer.
   - **Escort Mode** — escortă/însoțire 1–2 ore (cu vehicul PROTEGO, vehicul client sau pe jos).
   - **Hourly Mode** — protecție cu ora, minim 2 ore.
   - Secure Delivery, abonamente, marketplace, AI dispatch = post-MVP.
5. **Dispecerat:** asignare MANUALĂ în MVP. Fără AI dispatch.
6. **Limbi:** română (principal) + engleză.
7. **Stack:** monorepo pnpm · Next.js (web+admin) · Expo/React Native (mobil) · Supabase (Postgres, Auth, Realtime, RLS) · Stripe (preautorizare + captură manuală) · Google Maps/Mapbox · Vercel · GitHub · Sentry.
8. **Pilot:** un singur oraș la lansare (Oradea sau Satu Mare — de confirmat), 2–3 agenți proprii, 10–20 clienți.
9. **Reguli de lucru:** un milestone = un prompt = un commit verificat. Fără chei API în prompturi/repo. Nicio etapă declarată gata fără teste de acceptanță.

---

## 1. Matricea Tool × Model × Sarcină

| Sarcină | Tool | Model recomandat | De ce |
|---|---|---|---|
| Coordonare, strategie, decizii, rezolvare blocaje | Claude chat (acest proiect) | **Fable 5** | Cel mai inteligent model disponibil; vede imaginea de ansamblu |
| Documentație produs (PRD, reguli, flows) | **Cowork** | Fable 5 sau Opus 4.8 | Muncă multi-pas pe fișiere, raționament de produs |
| Design system + prototip | **Claude Design** | modelul implicit al aplicației | Design tokens, ecrane, handoff |
| Audit arhitectură + planul repo (prompt P4) | **Claude Code** | **Opus 4.8** (sau Fable 5 dacă e disponibil în Code) | Decizii de arhitectură = miza maximă, o singură dată |
| Implementare milestones M0–M5 | **Claude Code** | **Sonnet 4.6** | Rapid, excelent la cod, cost mic; preferința ta confirmată |
| Debugging greu / probleme de securitate RLS | Claude Code | Opus 4.8 | Escaladezi doar când Sonnet se blochează |
| Texte marketing, traduceri, conținut site | Claude chat | Sonnet 4.6 | Suficient și rapid |

**Regula practică:** Sonnet 4.6 pentru 80% din execuție. Opus 4.8 pentru arhitectură și blocaje. Fable 5 (aici) pentru gândire și coordonare. Așa consumi limitele inteligent.

**Fluxul de coordonare:** Orice contradicție descoperită de un tool se aduce în chatul de coordonare → decidem → actualizăm acest document → versiune nouă (1.1, 1.2...) → re-încărcat în Project knowledge.

---

## 2. Ordinea de execuție

```
Săpt. 1     P1: Project Claude + acest document încărcat
            P2: Cowork → docs/ (PRD, reguli, flows)        [1-2 zile]
            + Avocat: verificare încadrare licență          [în paralel]
Săpt. 1-2   P3: Claude Design → design system + prototip    [2-3 zile]
Săpt. 2     P4: Claude Code → audit + plan (FĂRĂ cod)
Săpt. 2-3   M0 Fundament → M1 Conturi/Roluri
Săpt. 3-5   M2 Booking → M3 App Agent
Săpt. 5-7   M4 Live ops (tracking, chat, SOS, dispecerat)
Săpt. 7-8   M5 Plăți (Stripe preautorizare/captură/refund)
Săpt. 8+    QA → build Android + TestFlight → PILOT
```

---

## 3. PROMPT P1 — Instrucțiunile Proiectului Claude

*Copiază în: Claude → Projects → PROTEGO → Project instructions*

```text
You are the Product & Tech Lead and coordination hub for PROTEGO.

PROTEGO is the on-demand secure transport and personal protection app
of a licensed Romanian private security company (Legea 333/2003).
Owner-operator model in Phase 1 — NOT a marketplace, NO lethal weapons.

Operate in decide-and-deliver mode. Answer in Romanian unless asked otherwise.

Priorities, in order:
1. Legal and operational safety (Romanian law 333/2003, GDPR).
2. Customer clarity and trust.
3. Simple solo-founder operation with manual dispatch.
4. Low initial cost.
5. Scalable architecture for later marketplace phase.

Approved facts (never change silently):
- Services MVP: Protect Ride (A→B), Escort Mode (1–2h), Hourly Mode (2h+).
- PROTEGO Vehicle is the first mobility option; client vehicle or on-foot allowed.
- Agent may drive client vehicle only after explicit consent, insurance
  confirmation, checklist and photos.
- Branding: PROTEGO, Dacian Wolf symbol, black/metallic gray/gold. No neon green.
- Positioning: accessible secure mobility for women, children, seniors +
  corporate/VIP premium tier. Not luxury-only.
- Stack: pnpm monorepo, Next.js, Expo, Supabase, Stripe manual capture,
  Vercel, GitHub, Sentry. Bilingual RO/EN.
- Dispatch is manual in MVP. No AI dispatch, no subscriptions, no
  Secure Delivery until after pilot.

Always:
- distinguish assumptions from confirmed decisions;
- propose ONE recommended solution;
- produce implementation-ready files, prompts, schemas and checklists;
- split work into small milestones with acceptance tests;
- flag any legal risk related to Legea 333/2003 or GDPR immediately.

Never:
- silently change product rules;
- expose API keys or secrets;
- build competing implementations;
- declare a milestone complete without tests.
```

---

## 4. PROMPT P2 — Cowork (documentația)

*Deschide Cowork, dă-i acces la folderul local `protego/docs/` și rulează:*

```text
Read PROTEGO_Master_Plan.md in this folder. It is the source of truth.

Create and maintain these documents (Romanian, with English technical terms):

docs/product/vision.md
docs/product/prd.md                  — MVP only: Protect Ride, Escort 1–2h, Hourly 2h+
docs/product/business-rules.md      — pricing logic, cancellation, overage, client-vehicle rules
docs/product/user-flows.md          — client, agent, dispatcher; happy path + edge cases
docs/product/roadmap.md             — M0→M5 + pilot; post-MVP backlog separate
docs/architecture/system-architecture.md
docs/architecture/data-model.md     — entities: users, agents, missions, quotes,
                                      payments, vehicles, incidents, audit_log
docs/legal/compliance-checklist.md  — Legea 333/2003 scope per service, GDPR,
                                      date de localizare, consimțământ, retenție,
                                      ANSPDCP requirements, 18+ verification
docs/operations/dispatcher-playbook.md — manual dispatch procedures, SOS protocol
docs/testing/acceptance-tests.md    — per milestone, Given/When/Then

Constraints:
- Do NOT write production application code.
- Do NOT invent prices — mark all prices as CONFIGURABLE, set by admin.
- Legal questions you cannot resolve → list in docs/legal/questions-for-lawyer.md
- Contradictions → docs/product/open-decisions.md and STOP on that topic.
- The operator is our own licensed security company. No third-party providers in MVP.

Deliver a summary of created files and open questions at the end.
```

---

## 5. PROMPT P3 — Claude Design

*Încarci: PRD-ul din P2, logo (când există), acest document. Apoi:*

```text
Design a premium bilingual RO/EN mobile-first product system for PROTEGO,
the on-demand secure transport & protection app of a licensed Romanian
security company.

Brand:
- Black #0D0D0D, metallic gray scale, gold accent (suggest exact gold values)
- Dacian Wolf inspired logomark, minimal, premium — NOT military gaming
- Calm, trustworthy, elite but accessible
- Typography: modern, high-legibility, EU feel

Roles: 1. Client  2. Agent  3. Dispatcher (web)

Client MVP screens:
Splash · Onboarding (3 max) · Login/Register · Phone+ID verification ·
Home with 3 services · Protect Ride flow (pickup, destination, protection
level, quote) · Escort Mode 1–2h flow · Hourly Mode 2h+ flow ·
Mobility selection (PROTEGO vehicle first) · Quote & payment authorization ·
Agent assigned (photo, credentials, rating) · Live tracking · Chat · SOS ·
Mission summary & receipt · History · Profile

Agent screens:
Onboarding & document upload · Availability toggle · Mission offer ·
Mission detail · Navigation · Status flow (en route / arrived / protection
started / completed) · Client-vehicle checklist with photos ·
Incident report · Earnings · Profile

Dispatcher web:
Operations overview · Live map · Unassigned missions · Active missions ·
Manual assignment · Agents & documents · Clients · Payments & refunds ·
Incidents · Reports

Business rules to respect in UX:
- Escort Mode is 1–2 hours; Hourly Mode starts at 2 hours.
- Agent drives client vehicle only after consent + insurance + checklist + photos.
- No weapons imagery anywhere. No aggressive militarized visuals.
- Prices always shown as estimates until confirmed; RON currency, RO/EN toggle.

Produce: design tokens · component library · all screens with empty/loading/
error/success states · accessibility notes · developer handoff ·
one clickable end-to-end client prototype (Protect Ride happy path).
```

---

## 6. PROMPT P4 — Claude Code: audit & plan (fără cod)

*Model: Opus 4.8. În repo-ul GitHub privat cu `docs/` + acest fișier + CLAUDE.md:*

```text
You are the lead software architect for PROTEGO.

Read CLAUDE.md, PROTEGO_Master_Plan.md and everything under docs/.
Do NOT modify or write application code yet.

Produce docs/architecture/repository-audit.md containing:
1. Monorepo structure proposal (pnpm workspaces: apps/web, apps/mobile,
   packages/ui, packages/domain, packages/validation, packages/config,
   supabase/).
2. Dependency list with versions and justification.
3. Supabase schema draft aligned with docs/architecture/data-model.md,
   including RLS strategy per role (client/agent/dispatcher).
4. Stripe manual-capture payment flow design (authorize at booking,
   capture at completion, cancel/refund paths, overage handling).
5. Implementation milestones M0–M5 mapped to acceptance tests.
6. Risks, blockers, and anything contradicting the master plan.

Stop after writing the audit. Wait for approval.
```

---

## 7. PROMPT P5 — Claude Code: Milestone 0

*Model: Sonnet 4.6. Doar după aprobarea auditului:*

```text
Implement ONLY Milestone 0: repository foundation, per the approved audit.

Create: pnpm workspace · apps/web (Next.js App Router + TS + Tailwind) ·
apps/mobile (Expo Router + TS) · packages/ui with design tokens from the
Design handoff (black/gray/gold) · packages/domain · packages/validation ·
packages/config · supabase/ init · lint + format + typecheck · .env.example
(no real keys) · README.md · CI workflow (lint, typecheck, test).

Do NOT implement auth, bookings, payments, maps.

Run all checks. Report: files changed, commands executed, test results,
unresolved issues. One commit, conventional message.
```

*Milestones M1–M5 primesc prompturi similare, generate în chatul de coordonare la momentul potrivit, pe baza auditului aprobat.*

---

## 8. CLAUDE.md pentru repo (schelet)

```markdown
# PROTEGO
Secure transport & protection app of a licensed Romanian security company.
Source of truth: PROTEGO_Master_Plan.md + docs/. Never contradict them.

## Rules
- TypeScript everywhere. pnpm only.
- Milestone discipline: implement only what the current prompt asks.
- Supabase RLS mandatory on every table. No service-role key client-side.
- Stripe: manual capture flow only.
- All user-facing strings via i18n (ro default, en secondary).
- No secrets in code. .env.example lists required vars.
- Conventional commits. Tests required per milestone acceptance criteria.
```

---

## 9. Informații de care am nevoie de la tine (ca să pornim)

**Blochează startul (trimite-mi-le primele):**
1. **Licența firmei** — ce categorii de servicii acoperă exact (pază bunuri/persoane? gardă de corp? transport valori? monitorizare?). O poză/scan al licenței e ideal.
2. **Orașul pilot** — Oradea, Satu Mare, altul?
3. **Câți agenți atestați** aveți disponibili pentru pilot și ce vehicule (marcă/model/an)?

**Necesare în săptămâna 1:**
4. Bugetul lunar aproximativ pentru operare (hosting, Stripe, Google Maps, EAS ~100–200 €/lună la început) și pentru eventuale servicii externe.
5. Există deja logo/identitate sau generăm de la zero conceptul Lup Dacic?
6. Prețuri orientative dorite (RON/oră agent, RON/km transport) — le punem CONFIGURABILE, dar avem nevoie de valori de start pentru pilot.
7. Domeniul protego.ro e cumpărat? (dacă nu — cumpără-l azi, plus protego.eu dacă e liber)
8. Pe ce lucrezi: Windows (știu că da din trecut) — confirmă, ca să-ți dau comenzile exacte de instalare Claude Code.

**Pentru avocat (întrebările pregătite):**
- Încadrarea juridică a serviciului "Protect Ride" — transport + pază persoane simultan?
- Obligații privind evidența misiunilor și raportarea către poliție/IGPR.
- GDPR: temeiul legal pentru tracking locație client + retenția datelor.

---

## 10. Cum lucrăm împreună (protocolul de coordonare)

1. Tu execuți pașii; orice output important (audit, PRD, contradicții) îl aduci înapoi în chatul de coordonare.
2. Eu verific alinierea cu acest plan, decid/recomand, și îți generez promptul următor.
3. Documentul acesta se versionează: orice decizie nouă → v1.1, v1.2 → re-încarci în Project knowledge și în repo.
4. Niciun tool nu are voie să schimbe Deciziile Închise (secțiunea 0). Dacă un tool propune altceva — mi-l aduci mie.
