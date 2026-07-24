# PROTEGO — Arhitectura de sistem (privire generală)

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §2.5, §5E, §7, §8 (prompturile P4/P5). Acest document este o **hartă de arhitectură la nivel de produs**, pentru orientare — auditul tehnic detaliat (structură exactă de monorepo, versiuni de dependințe, schema SQL) este livrabilul dedicat al pasului P4 din protocolul de coordonare (`docs/architecture/repository-audit.md`, generat de Claude Code, model de raționament extins, înainte de M0).

**Nu se scrie cod de producție în acest document** — doar decizii și constrângeri de arhitectură.

---

## 1. Cele 4 fețe ale platformei

Toate pe același backend (Supabase) și același model de date (`data-model.md`):

| Față | Platformă | Rol principal |
|---|---|---|
| **Client** | Expo (iOS/Android) + web | Rezervare, misiune activă, Shield, istoric |
| **Agent** | Expo (iOS/Android) | Onboarding, oferte de misiune, execuție, câștiguri |
| **Dispecerat** | Web (Next.js) | Hartă live, asignare manuală, consola SOS |
| **Admin** | Web (Next.js) | Prețuri, catalog servicii, utilizatori, financiar, audit |

## 2. Stack tehnic (decizie închisă, MASTERPROMPT §2.5)

- **Monorepo:** pnpm workspaces.
- **Web (Dispecerat + Admin, posibil și Client-web):** Next.js.
- **Mobil (Client + Agent):** Expo / React Native.
- **Backend:** Supabase — Postgres, Auth, Realtime, Row-Level Security (RLS).
- **Plăți:** Stripe, manual capture (preautorizare → captură). Netopia ca alternativă locală ulterioară — nu în MVP.
- **Hărți:** Google Maps / Mapbox.
- **Hosting/CI:** Vercel + GitHub, Sentry pentru monitorizare erori.
- **Localizare:** i18n RO/EN din ziua 1 (nu adăugat ulterior).

## 3. Structura propusă de monorepo (de confirmat/detaliat în audit P4)

```
protego/
├── apps/
│   ├── web/        Next.js — dispecerat + admin (+ eventual client-web)
│   └── mobile/      Expo Router — client + agent
├── packages/
│   ├── ui/          design tokens (negru/gri/auriu, Cinzel/Manrope), componente
│   ├── domain/       logică de business partajată (pricing engine, mission state machine)
│   ├── validation/   scheme de validare partajate (client/server)
│   └── config/       configurare partajată (i18n, constante non-secrete)
└── supabase/         migrații, RLS policies, funcții
```

## 4. Model de date — referință rapidă

Detaliul complet al entităților este în `data-model.md`. La nivel de arhitectură, rețineți: `missions` (mașina de statusuri) este **coloana vertebrală** a sistemului — aproape toate celelalte entități (quotes, payments, incidents, ratings, shield_events) se leagă de o misiune sau de un eveniment Shield.

## 5. Securitate & RLS (Supabase Row-Level Security)

Regulă strictă, aplicată pe fiecare tabelă relevantă:
- **Clientul** vede doar propriile date (misiuni, plăți, persoane protejate).
- **Agentul** vede doar misiunile care i-au fost alocate.
- **Locația agentului** este vizibilă clientului **doar în timpul unei misiuni active** — niciodată în afara ei.
- **Niciun client Supabase nu folosește service-role key** — acces privilegiat doar server-side (funcții/edge functions), conform CLAUDE.md din repo.

## 6. Fluxul de plăți (Stripe manual capture)

```
Confirmare misiune → autorizare (hold) pe card
        │
        ▼
Misiune activă → (opțional) overage → confirmare client → re-autorizare
        │
        ▼
Misiune încheiată → captură (capture) sumei finale
        │
        ├─→ Anulare înainte de start → eliberare hold (fără captură)
        └─→ Dispută/refund → flux de refund manual, jurnalizat în audit_log
```

Split-payment (Night, Valul 3) se atașează ulterior la acest flux, la nivelul de grup (`groups`) — neconstruit în MVP, dar arhitectura de plăți trebuie proiectată din audit (P4) să nu blocheze adăugarea lui ulterior.

## 7. Arhitectura de realtime (tracking + SOS)

- Supabase Realtime pentru: poziția agentului în misiune activă, statusuri de misiune, chat, alerte SOS.
- **Cerință de latență critică:** o alertă SOS (din misiune activă sau din Shield gratuit) trebuie să ajungă în consola dispeceratului practic instant — aceasta este proprietatea de sistem cu cea mai mică toleranță la întârziere din toată platforma, dat fiind rolul central al SOS în promisiunea de brand.
- Cerințele exacte de latență (praguri numerice) se stabilesc în auditul tehnic P4, nu în acest document de produs.

## 8. Notificări

- Push (Expo) pentru client și agent.
- SMS fallback pentru evenimente critice (ex.: SOS, alocare misiune) — nu doar push, pentru robustețe.
- Email pentru facturi și rapoarte de misiune.

## 9. Mediu & guvernanță tehnică

- Medii separate (dev/staging/producție), fără chei reale în `.env.example` sau în repo.
- CI: lint, typecheck, test la fiecare commit/PR.
- Un milestone = un prompt = un commit verificat (regulă de proces, nu doar tehnică).
- `CLAUDE.md` (rădăcina repo) impune: TypeScript peste tot, pnpm exclusiv, commit-uri convenționale, RLS obligatoriu pe fiecare tabelă, prețuri niciodată constante în cod (mereu din config DB), string-uri UI mereu prin i18n, misiuni de risc ridicat cu confirmare umană **impusă în cod**, fără secrete în repo.

## 10. Ce rămâne pentru auditul tehnic P4 (nu pentru acest document)

- Lista exactă de dependințe și versiuni.
- Schema SQL draft completă + strategia RLS per rol, detaliată tabelă cu tabelă.
- Mașina de stări exactă a `missions` (tranziții permise).
- Praguri numerice de latență pentru realtime/SOS.
- Maparea milestone-urilor M0–M7 la testele de acceptanță.
- Riscuri, blocaje și eventuale contradicții tehnice față de acest document sau față de MASTERPROMPT v2.
