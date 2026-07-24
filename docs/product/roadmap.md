# PROTEGO — Roadmap de implementare (M0–M10)

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §7 și §9 (protocolul de coordonare). Regulă strictă: fiecare milestone se implementează complet și se testează (`docs/testing/acceptance-tests.md`) înainte de a trece la următorul. Un milestone = un prompt = un commit verificat.

---

## Faza pre-pilot (MVP, Valul 1)

```
M0  Fundament        monorepo, CI, design tokens, medii
M1  Conturi & roluri auth, profiluri, verificare, RLS
M2  Booking          cele 3 servicii MVP plătite, ofertă, motor prețuri v1
M3  App Agent        onboarding+documente, oferte, statusuri, rapoarte
M4  Live Ops         tracking realtime, chat, notificări, SOS, dispecerat
M5  Plăți            preautorizare/captură/refund/overage, payout
M6  Shield           SOS public, Walk With Me, cerc de încredere
M7  QA & Pilot       builds, conturi demo, pilot într-un oraș
```

### Detaliu per milestone

**M0 — Fundament**
Monorepo pnpm (`apps/web`, `apps/mobile`, `packages/ui|domain|validation|config`, `supabase/`), CI (lint, typecheck, test), design tokens (negru/gri/auriu, Cinzel/Manrope), medii (.env.example, fără chei reale). Fără auth, booking, plăți, hărți.

**M1 — Conturi & roluri**
Autentificare (telefon OTP + email), profiluri Client/Agent/Dispecer/Admin, verificare progresivă (nivel 1 telefon, nivel 2 CI+selfie), Supabase RLS pe roluri.

**M2 — Booking**
Cele trei servicii plătite ale MVP-ului (Protect Ride, Escortă, Protecție cu ora): fluxul de rezervare complet, chestionar de context + rutare risc ridicat, ofertă defalcată, motor de prețuri v1 configurabil din admin (fără valori hardcodate).

**M3 — Aplicația Agent**
Onboarding complet (upload documente, contract electronic, interviu video, misiune de probă), gestionare oferte de misiune (fereastră 45 sec), statusuri cu un tap, checklist vehicul client, rapoarte de misiune/incident.

**M4 — Live Ops**
Tracking realtime, chat în aplicație + apel mascat, notificări push/SMS/email, consola SOS a dispeceratului, asignare manuală cu sugestii ordonate, coada de risc ridicat.

**M5 — Plăți**
Stripe manual capture: preautorizare la confirmare, captură la final, refund la anulare, overage cu re-preautorizare (confirmată de client), payout săptămânal automat către agenți.

**M6 — Shield**
SOS public (accesibil oricărui utilizator, nu doar celor cu misiune activă), Walk With Me cu check-in, cerc de încredere, apel fals. **Se lansează public DOAR după ce dispeceratul funcționează stabil pe misiunile plătite din M4–M5** — un SOS gratuit fără răspuns ar distruge brandul definitiv. Această condiție de poartă (gate) este obligatorie, nu opțională.

**M7 — QA & Pilot**
Build-uri finale (Android + iOS via TestFlight/echivalent), conturi demo, pregătire operațională pentru pilotul într-un singur oraș (agenți proprii/Verified confirmați, dispecerat activ).

---

## Faza post-pilot

```
─── după validarea pilotului (M0–M7) ───
M8  Valul 2          Trusted Meet, abonamente, Kids, Senior
M9  Night & Cargo    split payment, grupuri, chain of custody
M10 Platformă        Partner, API, expansiune
```

**M8 — Valul 2 (recurent & consumer)**
Trusted Meet, abonamente (Drum Sigur, Kids, Senior), fluxurile de verificare extinsă pentru agenți Kids, facturare recurentă.

**M9 — Night & Cargo (Valul 3)**
Split-payment (grup, prin Stripe), tabela `groups` activată complet, chain of custody pentru Cargo (sigiliu, foto, OTP, semnătură, asigurare).

**M10 — Platformă (Valul 4)**
Onboarding firme Partner, comision 15–25%, API Safety-as-a-Service, Academia PROTEGO.

---

## Reguli de guvernanță ale roadmap-ului

1. **Nicio etapă nu se declară gata fără teste de acceptanță** corespunzătoare în `docs/testing/acceptance-tests.md`.
2. **Nu se amestecă valurile** — nimic din M8–M10 nu se construiește parțial în M0–M7, chiar dacă pare eficient tehnic (ex.: nu se activează tabela `groups` funcțional înainte de M9, chiar dacă schema există din M0/M2 — vezi `data-model.md`).
3. Orice output major (audit arhitectură, PRD, contradicții) revine în chatul de coordonare pentru verificare înainte de pasul următor.
4. Modele recomandate pe tip de sarcină (MASTERPROMPT §9.3): coordonare/strategie — model de gândire de nivel superior; audit arhitectură + blocaje grele — model de raționament extins; implementarea milestone-urilor (~80% din muncă) — model rapid, cost eficient.
5. În paralel cu dezvoltarea M0–M7: avocat (contract colaboratori, poliță RC, wording „nu suntem 112", GDPR/DPO — vezi `docs/legal/`), recrutarea primilor 5–10 agenți Verified, site live pe protego.ro colectând înscrieri la pilot.

## Notă privind orașul pilot

MASTERPROMPT v2.2 confirmă explicit (§2, decizia #15) orașul pilot: **ORADEA**. Geofencing, recrutarea agenților și marketingul local se fac pe Oradea din M0/M7. Vezi `open-decisions.md` (#1 — rezolvat) pentru istoricul deciziei.
