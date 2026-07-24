# PROTEGO — Modelul de supply (surse de agenți)

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §4. Toate cele patru surse sunt definite oficial în v2; acest document adaugă doar structura de onboarding și note operaționale.

**Principiu legal obligatoriu:** agenții independenți lucrează **exclusiv** ca și colaboratori contractați ai firmei licențiate PROTEGO — niciodată ca freelanceri direcți față de client, niciodată ca intermediari neafiliați. Firmele terțe intră în relație directă cu PROTEGO doar în faza Partner (Valul 4), sub propria lor licență.

---

## 1. Cele 4 surse de agenți

### A. PROTEGO Elite
Angajații firmei proprii. Standardul casei — folosiți pe primele misiuni ale pilotului, pentru a stabili nivelul de calitate de referință.

### B. PROTEGO Verified
Agenți atestați independenți, **contractați drept colaboratori** ai firmei (nu freelanceri direcți), care prestează sub licența PROTEGO. Profil țintă: actuali șoferi Uber/Bolt cu atestat de agent de pază, foști MAI/MApN, agenți de pază part-time.

**Mesaj de recrutare de referință** (MASTERPROMPT §4): *"Ai atestat și conduci cu 5 lei/km? Condu pentru PROTEGO cu 60+ lei/oră."* — canal recomandat: grupurile de șoferi Uber/Bolt și comunitățile de agenți de pază.

### C. PROTEGO Partner (Valul 4 — nu în MVP)
Firme de pază licențiate afiliate, care prestează sub propria licență, cu comision PROTEGO 15–25%. Nu se construiește operațional în MVP; doar menționat aici pentru coerența modelului pe termen lung.

### D. Academia PROTEGO (Valul 4 — nu în MVP)
Pipeline propriu de atestare pentru candidați fără atestat încă — parteneriat cu școli de atestare, curs → atestat → colaborator PROTEGO.

## 2. Onboarding Verified (aplicabil din MVP)

Fluxul de aplicare al unui agent Verified, în ordine:

1. **Aplicare în aplicația Agent:** date personale, upload atestat IGPR, cazier judiciar, CI, permis de conducere, asigurare vehicul (dacă intenționează să conducă și vehicul propriu), poze vehicul (dacă e cazul), experiență anterioară (MApN/MAI/pază — ani), limbi vorbite.
2. **Semnarea electronică a contractului de colaborare** cu firma PROTEGO (colaborator, nu angajat, nu subcontractant independent).
3. **Interviu video** programat din aplicație.
4. **Misiune de probă**, alături de un agent Elite (evaluare directă în teren înainte de activare completă).
5. **Statusuri de cont:** *în verificare* → *aprobat* → *activ*.

### Documente cu expirare
- Atestatul IGPR și alte documente cu termen de valabilitate declanșează **alerte automate de reînnoire** înainte de expirare.
- La expirare fără reînnoire, agentul este **blocat automat** din alocarea de misiuni noi — regulă de sistem, nu manuală, pentru a elimina riscul de operare cu documente expirate.

## 3. Documente juridice necesare (de pregătit devreme, cu avocat)

- **Contract-cadru de colaborare** pentru agenții Verified — relația trebuie să reflecte clar statutul de colaborator contractat al firmei licențiate, nu de furnizor independent către client.
- **Poliță RC extinsă pe colaboratori** — acoperire de răspundere civilă pentru activitatea prestată de agenții Verified sub licența PROTEGO.

Ambele documente sunt semnalate și în `docs/legal/questions-for-lawyer.md` și `docs/legal/compliance-checklist.md`.

## 4. Reguli de calitate transversale (toate sursele, din MVP)

- Rating agent vizibil clientului înainte de asignare (card agent: poză, nume, atestat, badge-uri — Elite/Verified, fost MApN/MAI, prim ajutor, limbi vorbite).
- Raport de misiune ghidat, obligatoriu la finalul fiecărei misiuni.
- Raport de incident separat (foto/video, oră, martori), transmis instant dispeceratului — indiferent de sursa agentului.
- Buton de urgență agent (agentul poate semnala nevoie de sprijin) — activ pentru toate sursele.

## 5. Câștiguri (aplicația Agent)

- Dashboard câștiguri: azi/săptămâna/luna, defalcat pe misiuni.
- Payout săptămânal automat pe IBAN.
- Bonusuri: rating, ore de noapte, weekend.

## 6. Ce nu se construiește în MVP

- Onboarding pentru PROTEGO Partner (firme terțe) — Valul 4.
- Pipeline Academia — Valul 4.
- Orice logică de comision Partner activă (tabela `partners` se pregătește în schemă, dar rămâne neutilizată — vezi `data-model.md`).
