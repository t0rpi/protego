# PROTEGO — MASTER PROMPT v2.3 (documentul final de implementare)
**Data:** 31 iulie 2026 · **Status:** aprobat pentru implementare · **v2.1** închide #3–#7 · **v2.2** închide #1 (Oradea) · **v2.3** închide prețurile de pilot și cota agentului
**Rol:** Sursa unică de adevăr. Se încarcă în: Claude Project (knowledge), repo GitHub (rădăcină), Cowork (folderul de lucru), Claude Design (context). Înlocuiește v1.0 și v1.1.

---

# 1. VIZIUNEA — ce construim de fapt

PROTEGO nu este o aplicație de bodyguarzi. Este **infrastructura de siguranță personală a României**, apoi a Europei.

Teza: Uber a devenit butonul implicit pentru "vreau să mă deplasez". PROTEGO devine butonul implicit pentru **"nu mă simt în siguranță"** — pentru o persoană, o familie, un grup la petrecere, un colet valoros sau o companie.

Modelul de referință combinat: Protector (personalizare echipă, premium, încredere) + BlackWolf (accesibilitate, siguranța femeilor, transport școlar) + ceea ce niciunul nu are: **stratul gratuit de siguranță (Shield), verticalele Night & Cargo, marketplace-ul licențiat și API-ul Safety-as-a-Service.**

Operator: firmă de pază proprie, licențiată conform Legii 333/2003. Fără arme letale. Fără zone gri legale.

## Piramida ecosistemului (ordinea construirii = de jos în sus)

```
Nivel 4  PLATFORMĂ      marketplace firme Partner · API Safety-as-a-Service · UE
Nivel 3  VERTICALE      PROTEGO Night (petreceri/evenimente) · PROTEGO Cargo (bunuri)
Nivel 2  RECURENT       abonamente: Drum Sigur · Kids · Senior · Familie · Business
Nivel 1  MISIUNI        Protect Ride · Escortă · Protecție cu ora · Trusted Meet
Nivel 0  SHIELD (GRATIS) SOS real · Walk With Me · cerc de încredere · apel fals
```

Nivelul 0 este motorul de creștere (adopție în masă, cost zero pentru utilizator, conectat la dispecerat REAL — diferențiatorul absolut). Nivelul 1 monetizează. Nivelul 2 fidelizează. Nivelurile 3–4 scalează.

---

# 2. DECIZII ÎNCHISE (niciun tool nu le schimbă fără aprobare în chatul de coordonare)

1. **Legal:** operator = firma proprie licențiată (Legea 333/2003). Agenții independenți lucrează DOAR ca colaboratori contractați ai firmei (nu freelanceri direcți). Firmele terțe intră doar în faza Partner, sub licența lor. Fără arme letale, fără promisiuni de intervenție tip 112.
2. **Poziționare:** siguranță accesibilă pentru oameni reali (femei, familii, seniori, grupuri la petreceri) + tier premium corporate/VIP. Nu lux-only.
3. **Brand:** PROTEGO · Lupul Dacic minimalist · negru #0C0D0F / gri metalic / auriu #C9A227–#E6C868 · wordmark Cinzel, UI Manrope · fără imagerie de arme · ton: calm, elită accesibilă, moștenire daco-latină ("protegō" = a proteja).
4. **MVP (pilot, un oraș):** Shield (versiune de bază) + Protect Ride + Escortă 1–2h + Protecție cu ora 2h+. Dispecerat manual. Restul serviciilor = switch-uri dezactivate în admin.
5. **Stack:** monorepo pnpm · Next.js (web+dispecerat+admin) · Expo/React Native (client+agent) · Supabase (Postgres, Auth, Realtime, RLS) · Stripe manual capture (Netopia ulterior) · Google Maps/Mapbox · Vercel · GitHub · Sentry · i18n RO/EN din ziua 1.
6. **Prețuri:** NIMIC hardcodat. Motor de prețuri configurabil din admin. Valorile demo: 180 lei/h/agent, 60 lei/h vehicul, 20 lei taxă platformă.
7. **Reguli de lucru:** un milestone = un prompt = un commit verificat · teste de acceptanță obligatorii · fără chei în cod · misiunile cu risc ridicat se confirmă doar de om, niciodată automat.

## Decizii închise în v2.1 (rezolvă open-decisions.md #3–#7)
8. **Degresivitate Protecție cu ora:** prag de referință 8 ore, valoare implicită configurabilă din admin. (#3 închis)
9. **Anulare gratuită:** până la 60 min înainte de misiune, valoare implicită configurabilă din admin; sub prag se pot aplica penalizări configurabile. (#4 închis)
10. **Vehicul PROTEGO:** specificație de brand = „vehicul negru, categorie premium/SUV"; flota exactă se definește la pilot cu vehiculele reale ale firmei. „SUV negru" din prototip = direcție vizuală, nu obligație de flotă. (#5 închis)
11. **Minim facturare Escortă:** 1 oră, configurabil. (#7 închis)
12. **Split-payment Night:** decizie de produs AMÂNATĂ oficial pentru Valul 3 (M9); nu blochează nimic din M0–M7; schema `groups` rămâne future-ready. (#6 amânat formal)
13. **Fereastra de decizie agent la ofertă:** 45 secunde — confirmată ca decizie închisă.
14. **KPI pilot (ținte de lucru, ajustabile după primele săptămâni):** prim contact dispecer la SOS sub 60 sec · agent alocat în sub 5 min de la confirmare · rating mediu ≥ 4,7 · zero misiuni de risc ridicat confirmate automat (regulă absolută, nu KPI).
15. **Orașul pilot: ORADEA** — confirmat de fondator (v2.2). Geofencing, recrutare agenți și marketing local se fac pe Oradea. (#1 închis)

## Decizii închise în v2.3 — prețurile de pilot (confirmate de fondator, 31 iulie 2026)
Toate valorile rămân CONFIGURABILE din admin; acestea sunt valorile de pornire ale pilotului Oradea, fundamentate pe piața ride-share și pază din august 2026:
16. **Protect Ride:** tarif bază 30 lei + 5 lei/km, minim 60 lei/cursă.
17. **Escortă:** 150 lei/oră, minim 1 oră.
18. **Protecție cu ora:** 130 lei/oră, minim 2 ore; degresivitate −15% peste 8 ore.
19. **Vehicul PROTEGO:** 50 lei/oră la serviciile orare; inclus în tariful Protect Ride.
20. **Taxă platformă & asigurare:** 20 lei/misiune (linie separată, transparentă, în ofertă).
21. **Coeficienți:** noapte (22:00–06:00) ×1,25 · weekend (vineri 20:00 → duminică 24:00) ×1,15 · urgență (sub 30 min) ×1,20 — cumulați multiplicativ, plafonați la ×1,5 total.
22. **Anulare sub fereastra gratuită (60 min):** 30% din estimare, minim 30 lei.
23. **Cota agentului: 55% din componenta de manoperă** (nu din total — vehiculul și taxa de platformă revin firmei). La Protect Ride: 55% din (bază + km), cu garanție minim 35 lei/misiune pentru agent. Înlocuiește placeholder-ul 0.70 din seed (pricing_config.agent_share_pct → 0.55).

## Rămase deschise (răspuns de la fondator)
- **Numărul licenței 333/2003** — decizie fondator: se completează la finalul dezvoltării, înainte de lansarea pilotului (M7), în textele legale ale aplicației și site-ului.
- **Categoriile licenței** — necesare ÎNAINTE de M7: ce activități acoperă licența (pază bunuri, protecția persoanelor, transport valori, monitorizare) — condiționează validarea juridică a serviciilor Escortă/Protecție cu ora.
- **#8 Date operaționale pilot** — nr. agenți dedicați (țintă minim 3-4, câți cu permis B, mix gen, proveniență MAI/MApN pentru badge-uri) + vehicule (marcă/model/an/culoare) — necesare la M7.
- **DNS protegoapp.ro** — domeniu activ la Hostico; de confirmat înregistrările A/CNAME spre Vercel și bifele Valid Configuration.

---

# 3. CATALOGUL COMPLET DE SERVICII (pe valuri de activare)

## VALUL 1 — MVP
| Serviciu | Nevoia | Esența |
|---|---|---|
| **Shield (gratuit)** | "Vreau să mă simt în siguranță mereu" | SOS→dispecerat real, Walk With Me (check-in timer), partajare locație cu cercul de încredere, apel fals de urgență. Gratuit = motor de adopție. |
| **Protect Ride** | "Să ajung în siguranță din A în B" | Vehicul PROTEGO cu agent-șofer atestat SAU vehiculul clientului (consimțământ+checklist foto+asigurare). Cod de verificare misiune, tracking, SOS. |
| **Escortă (1–2h)** | "Cineva lângă mine la un moment cu risc" | Însoțire pe jos/cu vehicul: întâlniri OLX, bancomat, ieșire din club, dating, custodie. |
| **Protecție cu ora (2h+)** | "Protecție pe o perioadă" | Agent/echipă dedicată, recomandare automată nr. agenți, overage cu acord în aplicație. |

## VALUL 2 — Recurent & consumer (2–4 luni după pilot)
- **Trusted Meet** — agentul ca gardian verificat al oricărei întâlniri riscante (vânzări auto/imobiliare, tranzacții P2P mari, dating). Include verificarea identității ambelor părți. NU EXISTĂ pe piață.
- **Drum Sigur** (abonament femei) — curse nocturne incluse, opțiune agent femeie, prioritate dispecerat, partajare permanentă.
- **PROTEGO Kids** — transport școlar recurent: agenți cu verificare extinsă + evaluare psihologică, același agent pentru același copil, cod cunoscut de copil, confirmare foto predare/preluare.
- **PROTEGO Senior** — însoțire vârstnici (medic, bancă, pensie), plătit din diasporă (EN + card străin), raport foto către plătitor.
- **PROTEGO Events (echipe)** — 2–10 agenți cu șef de echipă pentru evenimente private/corporate.

## VALUL 3 — Verticalele Night & Cargo (4–8 luni)
### PROTEGO Night (petreceri & viață de noapte)
- **Gardianul Serii** — un grup (3–8 prieteni) își rezervă un agent pentru toată seara: îi însoțește între locații, are grijă să ajungă toți acasă. **Plată împărțită automat între membrii grupului** (split payment în aplicație). Împărțit la 6, protecția unei nopți costă cât un rând de cocktailuri.
- **Pachete petreceri** — burlăcițe/burlaci, majorate, aniversări: agent + vehicul + traseu planificat.
- **Parteneriate cluburi/localuri** — "PROTEGO Point" la ieșire: cod QR pentru cursă securizată imediată; clubul oferă siguranța ca beneficiu.
- **Petreceri private & festivaluri** — echipe cu brief, acces control, coordonare cu organizatorul.

### PROTEGO Cargo (transport de bunuri)
- **Secure Delivery** — colete valoroase cu chain of custody: sigiliu numerotat, foto la preluare, OTP+semnătură la predare, valoare declarată, asigurare. (Sub plafoanele legale pentru transport valori — peste plafon cere licență dedicată: NU în această fază.)
- **Partener de livrare premium** — bijuterii, ceasuri, electronice scumpe, artă: magazinele oferă "livrare PROTEGO" la checkout.
- **Documente sensibile** — notariale, juridice, licitații: trasee cu dovadă completă.
- **Predare garantată P2P** — la vânzări între persoane (telefoane, ceasuri, biciclete scumpe): agentul verifică produsul și banii, ambele părți confirmă în aplicație. Combinat cu Trusted Meet = infrastructura de încredere a economiei second-hand.
- **Trasee recurente B2B** — plicuri/colete între sedii, pe abonament.

## VALUL 4 — Corporate, premium & platformă (8–18 luni)
- **PROTEGO Business** — cont companie, centre de cost, facturare lunară, beneficiu HR (angajatele care pleacă târziu).
- **Abonamente Familie/Dedicat** — gardă personală recurentă administrată din aplicație.
- **PROTEGO Residence** — verificări programate la domiciliu (doar în limitele licenței; intervenția la alarmă cere licență de monitorizare sau partener).
- **VIP & Executive** — motorcade, advance planning, agent shadow; cerere de ofertă, nu self-service.
- **Hotel & Venue Partners** — rezervare din recepție, comision pentru locație.
- **PROTEGO Partner (marketplace)** — firme de pază licențiate se afiliază (licență+asigurare+agenți), primesc misiuni în zonele lor, comision PROTEGO 15–25%. Motorul expansiunii naționale→UE.
- **API Safety-as-a-Service** — butonul PROTEGO integrat în aplicații terțe (dating, imobiliare, marketplace-uri, bănci pentru retrageri mari). PROTEGO devine infrastructură.
- **Academia PROTEGO** — recrutare + atestare foști militari/polițiști/civili; canal de supply + venit + control calitate.

---

# 4. MODELUL DE SUPPLY (cele 4 surse de agenți)

1. **PROTEGO Elite** — angajații firmei proprii. Standardul casei. Primele misiuni.
2. **PROTEGO Verified** — agenți atestați independenți (inclusiv actuali șoferi Uber/Bolt cu atestat, foști MAI/MApN, agenți part-time), contractați drept colaboratori ai firmei → prestează sub licența noastră. Onboarding în aplicație: atestat + cazier + CI + permis + interviu video + misiune de probă. Documente cu expirare → alerte + blocare automată.
3. **PROTEGO Partner** — firme licențiate afiliate (Valul 4), prestează sub licența lor, comision.
4. **Academia** — pipeline de atestare pentru candidați fără atestat.

Recrutare Verified: grupurile de șoferi Uber/Bolt și agenți de pază. Mesaj: "Ai atestat și conduci cu 5 lei/km? Condu pentru PROTEGO cu 60+ lei/oră."
Necesare devreme (avocat): contract-cadru de colaborare + poliță RC extinsă pe colaboratori.

---

# 5. PRODUSUL — cele 4 fețe + fundația

## A. Aplicația CLIENT (Expo iOS/Android + web)
- **Shield (tab permanent):** SOS → dispecerat (protocol: dispecerul sună, escaladează, jurnalizează; formulare legală: nu înlocuim 112) · Walk With Me cu check-in · cerc de încredere · apel fals.
- **Cont:** telefon OTP + email; verificare progresivă (nivel 2 = CI+selfie înainte de prima misiune — protejează agenții); persoane protejate salvate; adrese; metode de plată; cont business.
- **Rezervare (10 pași):** serviciu → unde → când (acum/programat/recurent) → cine e protejat → echipă (nr. agenți cu recomandare, preferință gen, ținută) → mobilitate → chestionar scurt de context (risc ridicat → coadă umană, fără confirmare automată) → ofertă defalcată → preautorizare plată (+ split payment la Night) → confirmare.
- **Misiune activă:** card agent (poză, atestat, badge-uri, rating, vehicul) · **cod unic de verificare** · tracking live + partajare link · chat + apel mascat · SOS · statusuri · prelungire cu re-preautorizare.
- **După:** rezumat + captură plată · rating cu etichete · raport PDF + factură · istoric + re-book · referral.
- RO/EN · RON · dark mode nativ.

## B. Aplicația AGENT (Expo)
- Onboarding cu upload documente + semnare contract electronic + interviu video + misiune de probă; statusuri; expirări automate.
- Disponibilitate on/off · ofertă de misiune (adresa exactă doar după accept, 45 sec) · brief · navigație · statusuri cu un tap · checklist foto vehicul client · raport misiune ghidat · raport incident cu foto/video · buton urgență agent.
- Câștiguri: dashboard, payout săptămânal automat, bonusuri (noapte/weekend/rating).

## C. DISPECERAT (web)
- Hartă live agenți+misiuni · coadă neasignate cu timer · asignare manuală cu sugestii ordonate (distanță, rating, badge, vehicul) · reasignare.
- **Consola SOS** (inclusiv de la utilizatorii Shield gratuiți!): alertă, locație, apel cu un click, protocol pas-cu-pas, jurnalizare obligatorie.
- Coada de risc ridicat (doar confirmare umană) · verificare agenți · plăți/refund · monitorizare chat · rapoarte operaționale.

## D. ADMIN (web)
- Motor de prețuri configurabil pe serviciu/oraș (bază, oră, km, coeficienți noapte/weekend/urgență, minime, split, comisioane Partner, TVA).
- Catalog servicii ca switch-uri pe orașe (valurile = configurare, nu cod nou).
- Zone de operare · utilizatori/roluri · Partner management · promo/referral · CMS legal · financiar + export contabil · **audit log complet**.

## E. Fundația tehnică
- Model de date: users, protected_persons, agents(+documents cu expirare), vehicles, services, missions (mașina de statusuri = coloana vertebrală), quotes, payments, subscriptions, groups (Night split), partners, incidents, ratings, shield_events, audit_log.
- Supabase RLS strict: clientul vede doar ale lui; agentul doar misiunile alocate; locația agentului vizibilă doar în misiune activă.
- Stripe manual capture; split payment (Night) prin Stripe; Netopia ulterior.
- GDPR: consimțământ pe tracking, retenție definită + anonimizare trasee, export/ștergere, DPO.
- Notificări: push Expo, SMS fallback critice, email facturi/rapoarte.

---

# 6. MODELUL DE BANI
1. Marjă pe misiuni (Elite/Verified). 2. Abonamente (Drum Sigur, Kids, Senior, Familie, Business). 3. Split-payment Night (valoare mare/tranzacție, cost împărțit = accesibil). 4. Cargo B2B recurent + comision livrare premium. 5. Comision Partner 15–25%. 6. API Safety-as-a-Service (licențiere B2B). 7. Academia.
Pilotul dovedește doar punctul 1, într-un oraș. Shield gratuit construiește audiența în paralel.

---

# 7. ROADMAP DE IMPLEMENTARE

```
M0  Fundament        monorepo, CI, design tokens, medii
M1  Conturi & roluri auth, profiluri, verificare, RLS
M2  Booking          cele 3 servicii MVP, ofertă, motor prețuri v1
M3  App Agent        onboarding+documente, oferte, statusuri, rapoarte
M4  Live Ops         tracking realtime, chat, notificări, SOS, dispecerat
M5  Plăți            preautorizare/captură/refund/overage, payout
M6  Shield           SOS public, Walk With Me, cerc încredere (după ce dispeceratul e rodat!)
M7  QA & Pilot       builds, conturi demo, pilot un oraș
─── după pilot ───
M8  Valul 2          Trusted Meet, abonamente, Kids, Senior
M9  Night & Cargo    split payment, grupuri, chain of custody
M10 Platformă        Partner, API, expansiune
```
Notă: Shield se lansează public DOAR când dispeceratul funcționează 24/7 — un SOS fără răspuns distruge brandul definitiv.

---

# 8. PROMPTURILE DE EXECUȚIE

## P1 — Instrucțiuni Claude Project „PROTEGO"
```text
You are the Product & Tech Lead and coordination hub for PROTEGO.

PROTEGO is Romania's personal-safety infrastructure: a free safety layer
(Shield) + on-demand protection missions + subscriptions + Night & Cargo
verticals + a licensed-partner marketplace. Operated by our own licensed
security company (Legea 333/2003). Owner-operated in Phase 1, marketplace
later. No lethal weapons. Never promise 112-style emergency response.

Answer in Romanian. Operate in decide-and-deliver mode.

Source of truth: PROTEGO_MASTERPROMPT_v2.md. Sections 2 (closed decisions),
3 (service catalog waves), 4 (supply model), 5 (product spec), 7 (roadmap)
are binding. High-risk missions are NEVER auto-confirmed. Prices are NEVER
hardcoded. Independent agents are ALWAYS contracted collaborators of our
licensed company.

Always: distinguish assumptions from decisions; propose one recommended
solution; produce implementation-ready output; flag legal risk (333/2003,
GDPR) immediately; keep milestone discipline.
Never: silently change rules; expose secrets; build beyond the current
milestone; mix waves (MVP = Shield-basic + Ride + Escort + Hourly only).
```

## P2 — Cowork (documentație; folderul protego/docs/)
```text
Read PROTEGO_MASTERPROMPT_v2.md in this folder — it is the binding source
of truth. Create and maintain (Romanian, English technical terms):

docs/product/vision.md · prd.md (MVP only: Shield-basic, Protect Ride,
Escort 1–2h, Hourly 2h+) · services-catalog.md (all waves, marked by wave) ·
business-rules.md (pricing logic as CONFIGURABLE, cancellation, overage,
client-vehicle rules, high-risk queue, split-payment for future Night) ·
user-flows.md (client/agent/dispatcher; happy + edge cases; SOS protocol) ·
supply-model.md (Elite/Verified/Partner/Academy, onboarding, contracts) ·
roadmap.md (M0–M10)
docs/architecture/system-architecture.md · data-model.md (all entities
incl. groups, shield_events, subscriptions as future-ready tables)
docs/legal/compliance-checklist.md (333/2003 per service, GDPR, ANSPDCP,
collaborator contracts, insurance, "not-112" wording) · questions-for-lawyer.md
docs/operations/dispatcher-playbook.md (incl. SOS console protocol,
high-risk queue, Shield alerts) · docs/testing/acceptance-tests.md (per
milestone, Given/When/Then)

Do NOT write production code. Do NOT invent prices. Contradictions →
docs/product/open-decisions.md and stop on that topic. Deliver a summary
of files created and open questions.
```

## P3 — Claude Design
```text
Design the complete bilingual RO/EN mobile-first system for PROTEGO —
Romania's personal-safety app, operated by a licensed security company.

Brand: black #0C0D0F, metallic grays, gold #C9A227→#E6C868 gradient accents.
Wordmark: Cinzel (Latin inscription capitals — "protegō"). UI: Manrope.
Logomark: minimal Dacian Wolf (Draco standard heritage), gold line art.
Tone: calm, premium yet accessible, zero weapons imagery, zero militarism.
Reference prototype: protego-prototip.html (keep its visual language).

Roles: Client, Agent, Dispatcher.

Client screens: Splash · Onboarding · Auth+ID verification · Home (Shield
tab + 3 services) · Shield suite (SOS, Walk With Me with check-in timer,
trusted circle, fake call) · full booking flow (10 steps incl. context
questionnaire and mobility selection) · quote & payment authorization ·
agent assigned (credentials, badges, mission verification code) · live
tracking + share link + chat + SOS · mission summary/rating/receipt ·
history · profile & protected persons · subscriptions (visual placeholder).

Agent screens: application & document upload with expiry states ·
availability · mission offer (45s) · mission detail/brief · navigation ·
status flow · client-vehicle photo checklist · incident report · earnings.

Dispatcher web: live map · unassigned queue with timers · manual assignment
with ranked suggestions · SOS console with step-by-step protocol ·
high-risk queue (human-only confirm) · agent verification · payments.

Deliver: tokens, component library, all states (empty/loading/error/
success), accessibility notes, dev handoff, clickable client prototype
(Protect Ride + SOS happy paths).
```

## P4 — Claude Code: audit & plan (model: Opus; FĂRĂ cod)
```text
You are the lead software architect for PROTEGO. Read CLAUDE.md,
PROTEGO_MASTERPROMPT_v2.md and docs/. Do not write application code.

Produce docs/architecture/repository-audit.md:
1. pnpm monorepo structure (apps/web, apps/mobile, packages/ui|domain|
   validation|config, supabase/).
2. Dependencies with versions and rationale.
3. Supabase schema draft from data-model.md incl. RLS strategy per role,
   mission state machine, future-ready tables (groups, subscriptions,
   shield_events) created but unused in MVP.
4. Stripe manual-capture flow (authorize→capture→cancel/refund→overage)
   and where split-payment will attach later.
5. Realtime architecture for tracking + SOS latency requirements.
6. Milestones M0–M7 mapped to acceptance tests.
7. Risks, blockers, contradictions with the master prompt.
Stop after writing the audit. Wait for approval.
```

## P5 — Claude Code: M0 (model: Sonnet; după aprobarea auditului)
```text
Implement ONLY Milestone 0 per the approved audit: pnpm workspace ·
apps/web (Next.js App Router+TS+Tailwind) · apps/mobile (Expo Router+TS) ·
packages/ui with design tokens (black/gray/gold, Cinzel/Manrope) ·
packages/domain|validation|config · supabase init · lint/format/typecheck ·
.env.example · README · CI (lint, typecheck, test).
No auth, bookings, payments, maps. Run all checks. Report files changed,
commands, test results, issues. One conventional commit.
```
*(M1–M7: prompturile se generează în chatul de coordonare, unul câte unul, după acceptanța milestone-ului anterior.)*

## CLAUDE.md (rădăcina repo-ului)
```markdown
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
```

---

# 9. PROTOCOLUL DE COORDONARE

1. Ordinea de pornire: Project (P1) → Cowork (P2) → Design (P3) → Code audit (P4) → M0 (P5) → M1…M7 → pilot.
2. Orice output major (PRD, audit, contradicții) revine în chatul de coordonare pentru verificare înainte de pasul următor.
3. Modele: Fable 5 = coordonare/strategie · Opus 4.8 = audit arhitectură + blocaje grele · Sonnet 4.6 = implementarea milestone-urilor (80% din muncă).
4. Acest document se versionează (v2.1, v2.2…) la fiecare decizie nouă și se re-încarcă peste tot.
5. În paralel cu dezvoltarea: avocat (contract colaboratori, poliță RC, wording "nu suntem 112", GDPR/DPO) + recrutarea primilor 5–10 agenți Verified + site-ul live pe protego.ro colectând înscrieri la pilot.
