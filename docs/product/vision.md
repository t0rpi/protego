# PROTEGO — Viziune de produs

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` (secțiunile 1, 2, 6). Acest document este derivat și explicativ; în caz de conflict, MASTERPROMPT-ul are prioritate. Ultima sincronizare: 23 iulie 2026.

---

## 1. Ce este PROTEGO

PROTEGO nu este o aplicație de bodyguarzi. Este **infrastructura de siguranță personală a României**, cu ambiția de a deveni infrastructura de siguranță personală a Europei.

**Teza centrală:** Uber a devenit butonul implicit pentru "vreau să mă deplasez". PROTEGO devine butonul implicit pentru **"nu mă simt în siguranță"** — pentru o persoană, o familie, un grup la petrecere, un colet valoros sau o companie.

**Modelul de referință** combină două arhetipuri existente pe piață — Protector (personalizare de tip echipă, premium, încredere) și BlackWolf (accesibilitate, siguranța femeilor, transport școlar) — și adaugă ce niciunul dintre ele nu are:

- un strat gratuit de siguranță (**Shield**), conectat la un dispecerat real;
- verticale dedicate **Night** (viață de noapte) și **Cargo** (bunuri);
- un **marketplace licențiat** de firme de pază partenere;
- un **API Safety-as-a-Service** pentru integrare în alte aplicații.

**Operator:** firmă de pază proprie, licențiată conform Legii 333/2003. Fără arme letale. Fără zone gri legale. Agenții independenți lucrează exclusiv ca **colaboratori contractați ai firmei licențiate** — niciodată ca furnizori direcți către client, niciodată ca firme terțe neafiliate (excepție: faza Partner, Valul 4, sub licența proprie a fiecărei firme afiliate).

## 2. Piramida ecosistemului

Ordinea de construcție este strict de jos în sus — fiecare nivel are nevoie de fundația nivelului anterior ca să funcționeze corect:

```
Nivel 4  PLATFORMĂ      marketplace firme Partner · API Safety-as-a-Service · UE
Nivel 3  VERTICALE      PROTEGO Night (petreceri/evenimente) · PROTEGO Cargo (bunuri)
Nivel 2  RECURENT       abonamente: Drum Sigur · Kids · Senior · Familie · Business
Nivel 1  MISIUNI        Protect Ride · Escortă · Protecție cu ora · Trusted Meet
Nivel 0  SHIELD (GRATIS) SOS real · Walk With Me · cerc de încredere · apel fals
```

- **Nivelul 0 (Shield)** este motorul de creștere: adopție în masă, cost zero pentru utilizator, conectat la un dispecerat REAL. Acesta este diferențiatorul absolut față de orice aplicație de siguranță "pasivă" de pe piață (majoritatea trimit doar notificări către contacte, fără dispecerat uman în spate).
- **Nivelul 1 (Misiuni)** este cel care monetizează — și singurul care se dovedește în pilot.
- **Nivelul 2 (Recurent)** fidelizează prin abonamente.
- **Nivelurile 3–4** scalează produsul dincolo de piața inițială (verticale de nișă, apoi platformă multi-operator).

Fiecare nivel superior depinde operațional de calitatea celui de dedesubt: nu lansăm Shield public până când dispeceratul nu funcționează ireproșabil pe misiunile plătite (vezi `roadmap.md`, M6), pentru că un SOS gratuit fără răspuns ar distruge brandul ireversibil.

## 3. Poziționare

Siguranță accesibilă pentru oameni reali — femei, familii, seniori, grupuri la petreceri — cu un tier premium corporate/VIP deasupra. **Nu este un produs "lux-only"**. Prețul de intrare trebuie să rămână comparabil cu o cursă ride-share premium sau o ieșire în oraș, nu cu un serviciu de gardă de corp clasic.

Diferențierea față de o firmă de pază tradițională sau de un ride-share:
- față de o firmă de pază clasică: rezervare instantă, self-service, prin aplicație, ca un ride-share;
- față de un ride-share: agent atestat conform Legii 333/2003, dispecerat care monitorizează activ misiunea, buton SOS real, cod unic de verificare a misiunii.

## 4. Modelul de bani (rezumat)

Detaliile de preț și regulile complete sunt în `business-rules.md`; roadmap-ul lor de activare este în `roadmap.md`. Pe scurt, cele 7 surse de venit (MASTERPROMPT §6):

1. Marjă pe misiuni (agenți Elite/Verified) — **singurul punct dovedit de pilot**.
2. Abonamente (Drum Sigur, Kids, Senior, Familie, Business) — Valul 2.
3. Split-payment Night — cost împărțit între membrii unui grup — Valul 3.
4. Cargo B2B recurent + comision livrare premium — Valul 3.
5. Comision Partner 15–25% — Valul 4.
6. API Safety-as-a-Service (licențiere B2B) — Valul 4.
7. Academia PROTEGO (recrutare/formare) — Valul 4.

Shield gratuit nu produce venit direct — construiește audiența și încrederea în paralel cu monetizarea prin misiuni.

## 5. Ce NU este PROTEGO (limite explicite, valabile pe toate valurile)

- **Nu înlocuiește 112.** Niciun text, ecran sau mesaj de marketing nu trebuie să sugereze intervenție de tip serviciu de urgență public. Dispeceratul PROTEGO sună, escaladează și poate îndruma către 112 — nu se substituie lui.
- **Nu folosește arme letale**, în nicio fază, în niciun serviciu, în nicio comunicare vizuală (fără imagerie de arme).
- **Nu este marketplace în Faza 1.** Modelul este owner-operated (firma proprie licențiată) până la Valul 4; firmele terțe intră doar atunci, sub propria licență.
- **Nu promite garanții de intervenție fizică** dincolo de ce permite Legea 333/2003 pentru agenți de pază și protecție.

## 6. Brand

- **Nume:** PROTEGO — din latinescul *protegō*, "a proteja, a acoperi, a apăra".
- **Simbol:** Lupul Dacic, stilizare minimalistă (moștenire Draco dacic).
- **Culori:** negru `#0C0D0F`, gri metalic, auriu `#C9A227`→`#E6C868` (gradient accent).
- **Tipografie:** wordmark în Cinzel (capitale de inscripție latină), UI în Manrope.
- **Ton:** calm, elită accesibilă, moștenire daco-latină. Fără imagerie de arme, fără militarism agresiv.

## 7. Orizontul de succes al pilotului

Pilotul (un singur oraș, dispecerat manual) trebuie să dovedească **doar punctul 1 al modelului de bani** — marja pe misiuni cu agenți proprii/Verified — pe cele patru servicii ale MVP-ului (`prd.md`). Shield gratuit rulează în paralel din M6, dar **numai** după ce dispeceratul e rodat pe misiunile plătite. Toate celelalte valuri (2–4) rămân intenționat neconstruite până la validarea pilotului.

## Note

- Acest document rezumă și structurează secțiunile 1, 2 și 6 din MASTERPROMPT v2 — nu adaugă decizii noi.
- Pentru deciziile blocate/contradicțiile identificate în materialele anterioare (v1.0/v1.1) față de MASTERPROMPT v2, vezi `open-decisions.md`.
