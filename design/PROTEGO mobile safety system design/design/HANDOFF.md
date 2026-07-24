# PROTEGO — Design Handoff v1.0

Pentru: monorepo pnpm · Next.js (dispecerat/admin) · Expo/React Native (client/agent) · Supabase · Stripe manual capture.
Surse design: design-system project (tokens/, components/, ui_kits/) · `PROTEGO_MASTERPROMPT_v2.2.md` · `prd.md`.
Conținut folder: `tokens.json` + `tokens.css` (identice ca valori) · `strings.ro.json` / `strings.en.json` (chei identice) · `assets/` · acest fișier.

---

## 1. Reguli de produs vizibile în UI (obligatorii, din deciziile închise)

| Regulă | Implementare UI |
|---|---|
| „PROTEGO nu înlocuiește 112" | `legal.not112` pe ORICE suprafață cu declanșator SOS (tab Shield, ecran SOS activ, hartă misiune). Componenta `Disclaimer112`. |
| Risc ridicat = confirmare umană | Clientul vede status `review.pill` („în verificare") — auriu calm (`--status-review`), termen de contact, NICIODATĂ tratament de eroare/roșu. Dispecer: fără multi-select, fără „aprobă tot"; confirmare doar per-misiune, gated de apel + verificare nivel 2. |
| Prețuri transparente | Totalul (QuoteBox) apare doar împreună cu defalcarea completă (RowLine). Valorile 180/60/20 lei sunt DEMO — vin din motorul de prețuri (DB), nu din constante sau tokens. |
| Anulare gratuită −60 min | `quote.cancelPolicy` cu `{min}` placeholder — valoarea din config admin. |
| Escortă min 1h · Hourly min 2h, degresiv 8h+ | `booking.durationNote`; pragurile ca placeholders/config, nu hardcodate. |
| Oferta agent = 45s | Inel countdown; la expirare misiunea revine în coadă cu prioritate ridicată (badge `dispatcher.requeued`). |
| Adresa exactă doar după accept | Ecranul de ofertă agent arată doar zona + distanța. |
| Vehicul generic | „SUV negru · premium" / `assets/vehicle-suv.svg` — fără marcă/model (decizia #10). |
| Cod unic de verificare | 4 cifre, tracking `--ls-code` 3px, gold-hi, pe: agent-assigned (client), brief + nav (agent). |

## 2. Tokens

- `tokens.css` = sursa pentru web (Next.js/Tailwind: mapează `colors.ink = 'var(--ink)'` etc.).
- `tokens.json` = sursa pentru RN (generați `packages/ui/tokens.ts` prin script de sync; gradientele devin `expo-linear-gradient` cu aceleași stopuri).
- Fonturi: Cinzel 500–700 (DOAR wordmark „PROTEGO" + monograme agent, uppercase, tracking .3–.34em + padding-left egal pentru recentrare optică), Manrope 400–800 (tot UI-ul). Expo: `@expo-google-fonts/cinzel`, `@expo-google-fonts/manrope`.
- O singură culoare de accent (gold). Roșu EXCLUSIV pentru SOS/erori. `--warn` doar pentru expirări documente.

## 3. Componente — inventar & specificații

Contracte complete în design-system project: `components/**/​*.d.ts` (+ `.prompt.md` cu exemple). Rezumat:

| Componentă | Props cheie | Stări | Note |
|---|---|---|---|
| Button | variant: primary/ghost/danger · size: sm · loading · disabled | default/active(scale .985)/focus/disabled/loading | Max UN buton gold per ecran. CTA mobil: full-width, ancorat jos, safe-area. |
| BackButton | label, children | — | 38px, r 12. |
| SOSButton | size: md(58)/lg(140–170) · sublabel | default/holding(scale .94 + ring)/countdown | Activare: HOLD 3s, eliberare = anulare (nu dublu-tap). Mereu cu Disclaimer112. |
| Field | dot: gold/dim · icon · error | default/focus(border gold)/error(border+mesaj) | dot = origine/destinație traseu. |
| Chip | selected · disabled | default/selected(gold border+fill)/disabled | aria-pressed. |
| OptionCard | title, desc, price, selected | default/selected | Radio-card: mobilitate, plată, persoane. |
| Counter | value, min, max, onChange | bounds-disabled | 46px butoane. |
| TopBar / TabBar / Stepper | — / tabs+activeIndex / steps=10+current | — | Tab activ = gold. Stepper: booking 10 pași. |
| Card + RowLine | label, value, strong, gold | — | Defalcări de preț = obligatoriu RowLine list. |
| Badge | tone: gold/ok/warn/danger/neutral · check | — | Credentiale agent = gold cu ✓. Documente: ok/warn/danger. |
| StatusPill | status: confirmed/enroute/arrived/active/done/review/sos | — | Mapare 1:1 cu mașina de statusuri `missions`. |
| QuoteBox | eyebrow, total, currency, note | — | 40px/800 total; urmat de defalcare. |
| ServiceCard / AgentCard / TrustBar | vezi .d.ts | — | AgentCard: monogramă Cinzel fallback; stele randate după valoare (nu static). |
| Toast / Banner / Timeline / EmptyState / Skeleton | Banner tone: error/success/warn/review/info | — | `review` = singura reprezentare pentru risc ridicat. Loading = Skeleton în forma conținutului, nu spinner de pagină. |
| Disclaimer112 | compact | — | Neomisibil pe suprafețe SOS. |

## 4. Stări (matrice minimă per ecran)

Loading → Skeleton; Empty → EmptyState cu pas următor concret; Error → Banner error + recuperare (Field error pe câmpuri); Success → Banner success sau ecran-rezumat cu disc auriu ✓; În verificare → Banner/StatusPill `review` (auriu + termen de contact).

## 5. Inventar ecrane ↔ PRD

| Ecran (ui_kits/) | PRD § |
|---|---|
| client: splash, onboarding, auth+OTP, verificare CI+selfie | §7 verificare progresivă (nivel 1 / nivel 2) |
| client: home + 3 servicii + trust bar | §4–6 servicii MVP |
| client: shield (SOS, WWM, cerc, apel fals) + SOS activ | §3 Shield-basic (1–4) |
| client: booking pașii 2–10 (traseu→plată) | §4–6 + §7 (persoane protejate, plată) · MASTERPROMPT §5A „Rezervare (10 pași)" |
| client: „în verificare" | §5 chestionar context + §7 risc ridicat |
| client: agent confirmat (cod, badge-uri) · tracking + chat + share + SOS | §4 (cod unic, tracking, chat/apel mascat, SOS, statusuri) |
| client: rezumat + rating + factură · istoric + re-book · profil & persoane · abonamente placeholder | §7 (rating, raport, istoric) · §9 abonamente = post-MVP (doar visual) |
| agent: ofertă 45s → brief → statusuri → checklist foto → incident → câștiguri · documente cu expirări | MASTERPROMPT §5B · PRD §4 (checklist vehicul client) |
| dispatcher: hartă+coadă (timere, reasignare prioritară) · consolă SOS (protocol, jurnal obligatoriu, Shield=plătit) · risc ridicat (uman-only) · predare tură · agenți/plăți/rapoarte (wireframe) | MASTERPROMPT §5C · PRD §1 KPI |

## 6. Harta = slot provider-agnostic

Componenta `Map` este un SLOT, nu o implementare: interfața `{ center, markers[] (agent|mission|sos|origin|destination), route?, onMarkerPress }`. Prototipurile folosesc SVG static — se înlocuiește cu Google Maps SAU Mapbox (decizie deschisă în stack) fără schimbarea ecranelor. Stil dark obligatoriu: fundal `#101216`, străzi `#1B1E24`/`#22252C`, traseu gold dashed, halou `--gold-dim-2` pe puncte vii, SOS = puls roșu. Pill-ul de status și butonul SOS sunt overlay-uri ale ecranului, nu ale hărții.

## 7. Accesibilitate

- Contrast pe ink: paper 17.4:1 · steel 7.5:1 · gold-hi 10.7:1 · gold 6.3:1 · danger 5.0:1 · steel-dim 4.0:1 (doar ≥18px/decorativ).
- Ținte ≥44px (`--tap-min`); SOS ≥58px în thumb zone; focus ring gold 2px offset 2px (`:focus-visible`).
- Statusuri = text + formă, nu doar culoare. `role="status"`+`aria-live="polite"` pe pill/toast; `role="alert"` doar erori reale.
- SOS: hold 3s cu countdown vizibil + anulare la eliberare; alternativă accesibilă: tap + fereastră de anulare 3s.
- `prefers-reduced-motion` (RN: `AccessibilityInfo.isReduceMotionEnabled`): fără pulse/motion-path; fades ≤350ms.
- i18n: chei identice RO/EN; formate „260 lei" (nu „RON 260"), oră 24h; `lang` corect pe rădăcină.

## 8. Deviații intenționate față de protego-prototip.html — DESIGNUL CÂȘTIGĂ

1. **Emoji pe quick-actions (💬📞📍) → iconografie Lucide** (stroke 1.8, rotunjit). Fără emoji nicăieri.
2. **Glyphs unicode în tab bar (◆ ≡ ●) → icoane Lucide**; tab bar extins la 4 taburi (+ Shield ca tab permanent — cerință PRD §3, lipsea din prototip).
3. **„Škoda Kodiaq · negru" → „SUV negru · premium"** — fără marcă/model (decizia închisă #10).
4. **Stepper 3 segmente → 10 segmente** (rezervarea completă în 10 pași, MASTERPROMPT §5A; prototipul comprima 3 pași).
5. **SOS tap simplu → hold 3s cu countdown și anulare la eliberare** (anti-declanșare accidentală; prototipul afișa doar un toast).
6. **Splash „Intră în aplicație" → „Începe" + onboarding în 3 pași** (prototipul sărea direct în Home).
7. **Adăugat `--warn` #DE8B3F** (expirări documente) — nu exista în prototip; roșul rămâne exclusiv SOS/erori.
8. **Stele rating statice ★★★★★ → randate după valoare** la implementare (prototipul le avea hardcodate).
9. **Chestionar context, mobilitate cu condițiile vehiculului clientului, ramura „în verificare", chat, WWM activ, cerc, apel fals** — ecrane noi, cerute de PRD, inexistente în prototip; stilizate strict în limbajul lui vizual.
10. **`--void` #050506** formalizat ca fundal în afara ramei (era hardcodat în prototip).

Orice alt conflict prototip ↔ design system: design system-ul (tokens + componente + ui_kits) este sursa de adevăr.
