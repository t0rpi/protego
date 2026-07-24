# PROTEGO — Reguli de business (MVP)

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §2.6, §5D, §5E. Regulă generală obligatorie: **niciun preț nu este hardcodat** — orice valoare numerică de mai jos este fie un exemplu de calcul, fie o valoare demo pentru pilot, configurabilă din panoul Admin.

---

## 1. Motorul de prețuri (configurabil, per serviciu, per oraș)

Componentele motorului, așa cum sunt definite în MASTERPROMPT §5D:

- tarif de bază per serviciu;
- lei/oră/agent;
- lei/km (Protect Ride);
- coeficienți: noapte, weekend, urgență (cerere de ultim moment);
- valori minime de facturare per serviciu;
- degresivitate peste un prag de ore (vezi nota de mai jos);
- comisioane Partner (Valul 4, pregătit din schemă, neactiv în MVP);
- TVA;
- taxă platformă/asigurare (linie separată în ofertă, pentru transparență).

**Valori demo pentru pilot** (MASTERPROMPT §2.6 — exemple, nu prețuri finale de producție):
- 180 lei/oră/agent;
- 60 lei/oră vehicul;
- 20 lei taxă platformă.

> **Notă (confirmat, MASTERPROMPT v2.1 §2, decizia #8):** pragul de degresivitate la Protecție cu ora este confirmat la 8 ore, ca valoare implicită **configurabilă** din admin (nu hardcodată). Vezi `open-decisions.md` (#3 — rezolvat).

> **Notă (confirmat, MASTERPROMPT v2.1 §2, decizia #11):** minimul de facturare la Escortă este confirmat la 1 oră, ca valoare implicită **configurabilă** din admin. Vezi `open-decisions.md` (#7 — rezolvat).

Orice serviciu, în orice oraș, poate fi activat/dezactivat independent din admin (catalogul de servicii = switch-uri pe oraș, nu cod nou per val).

## 2. Ofertă și transparență de preț

- Oferta afișată clientului înainte de confirmare este **defalcată pe componente** (ex.: agent × ore, taxă platformă, eventual coeficient noapte/weekend), niciodată o sumă globală opacă.
- Suma este o **estimare**; se preautorizează pe card la confirmare și se **încasează (capture) doar la finalul misiunii**, pe baza duratei/traseului real.

## 3. Anulare

- **Politică confirmată (MASTERPROMPT v2.1 §2, decizia #9):** anulare gratuită până la 60 de minute înainte de ora misiunii, ca valoare implicită **configurabilă** din admin. Sub acest prag se pot aplica penalizări, de asemenea configurabile — nu hardcodate. Vezi `open-decisions.md` (#4 — rezolvat).
- Anulare de către agent/dispecerat (indisponibilitate, incident) → reasignare automată în coada dispeceratului, fără cost pentru client.
- Orice anulare se jurnalizează în `audit_log`.

## 4. Overage (prelungirea misiunii)

- Clientul poate solicita prelungirea din aplicație, în timpul misiunii active.
- Overage-ul **necesită acord explicit al clientului în aplicație** înainte de a fi aplicat — nu se extinde automat fără confirmare.
- La confirmarea overage-ului, se emite o **re-preautorizare** pe card pentru diferența estimată; captura finală reflectă durata reală.
- La Protecție cu ora, overage-ul este menționat explicit ca fiind „automat, cu acordul clientului" — adică propus automat de sistem, dar aplicat doar după confirmare umană (a clientului, nu a dispeceratului).

## 5. Reguli privind vehiculul clientului (client-vehicle rules)

Agentul poate conduce vehiculul clientului **doar** dacă sunt îndeplinite, în această ordine:
1. **Consimțământ explicit** al clientului, înregistrat în aplicație (nu verbal, nu implicit din selecția opțiunii).
2. **Checklist foto al vehiculului** înainte de plecare: stare exterioară (minim 4 unghiuri/360°), kilometraj, nivel combustibil.
3. **Confirmarea asigurării valide** a vehiculului (poliță RCA/CASCO în vigoare) — verificată la nivel de proces, nu doar declarativ.
4. Semnătura clientului în aplicație la finalul checklist-ului.

Fără toate cele patru, opțiunea „vehiculul meu" nu poate fi confirmată de sistem — validare obligatorie înainte de a permite trecerea la pasul de plată.

## 6. Coada de risc ridicat

- Chestionarul scurt de context (2–3 întrebări), aplicat la Escortă și, unde e relevant, la celelalte servicii MVU, rutează misiunea către coada de risc ridicat a dispeceratului dacă răspunsurile indică o amenințare cunoscută sau un context sensibil.
- **Regulă necondiționată:** misiunile din coada de risc ridicat **nu se confirmă niciodată automat** — necesită decizie umană explicită a unui dispecer. Această regulă este o decizie închisă de nivel produs, nu doar operațional — nu poate fi dezactivată din configurare.
- Dispeceratul poate solicita informații suplimentare clientului înainte de a decide asignarea.

## 7. Split-payment (pregătire pentru PROTEGO Night, Valul 3 — neactiv în MVP)

- MASTERPROMPT prevede split-payment prin Stripe pentru „Gardianul Serii" (grup 3–8 persoane, cost împărțit automat).
- În MVP, tabela `groups` și logica de asociere plată-grup se **pregătesc în schema de date** (`data-model.md`), dar **nu se activează** — niciun ecran sau flux de split-payment nu se construiește înainte de Valul 3.
- Mecanismul exact de UX (inițiator, împărțire egală vs. custom, moment de colectare a preautorizărilor individuale) rămâne o decizie de design deschisă — vezi `open-decisions.md`.

## 8. Reguli de facturare generale

- Fiecare misiune finalizată generează automat: rezumat (durată, traseu, agent, cost final), factură pe email, și — la serviciile care îl includ — un raport PDF de misiune.
- Toate sumele afișate clientului sunt în RON; interfața suportă RO/EN complet din prima zi (relevant mai ales pentru Valul 2 — Senior/Kids, plătite adesea din diaspora).

## Asumpții vs. decizii — rezumat

| Regulă | Status |
|---|---|
| Motor de prețuri configurabil, fără hardcodare | Decizie închisă |
| Valori demo 180/60/20 lei | Decizie închisă (doar ca demo de pilot) |
| Risc ridicat = confirmare umană obligatorie | Decizie închisă |
| Reguli consimțământ + checklist + asigurare pt. vehicul client | Decizie închisă |
| Interval anulare gratuită (60 min) | Decizie închisă (MASTERPROMPT v2.1 §2, #9) |
| Prag degresivitate 8h la Protecție cu ora | Decizie închisă (MASTERPROMPT v2.1 §2, #8) |
| Minim facturare Escortă (1h) | Decizie închisă (MASTERPROMPT v2.1 §2, #11) |
| Mecanism UX split-payment Night | Amânat oficial pentru Valul 3/M9 (MASTERPROMPT v2.1 §2, #12) |
