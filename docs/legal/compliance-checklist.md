# PROTEGO — Checklist de conformitate legală

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §2.1, §5A (formulare SOS), §5E (GDPR). **Acest document nu constituie consultanță juridică** — este un checklist operațional de produs, care alimentează discuția cu avocatul (vezi `questions-for-lawyer.md`). Nicio bifă de mai jos nu se consideră „închisă" fără confirmare explicită din partea avocatului firmei.

---

## 1. Legea 333/2003 — încadrare per serviciu

**Principiu de bază confirmat (decizie închisă):** PROTEGO operează exclusiv prin firma proprie licențiată. Agenții independenți sunt colaboratori contractați ai firmei, niciodată furnizori direcți. Fără arme letale, în nicio fază.

**Blocaj cunoscut (vezi `open-decisions.md` #2):** categoriile exacte acoperite de licența actuală (pază bunuri/persoane, gardă de corp, transport valori, monitorizare) nu sunt confirmate în MASTERPROMPT v2. Checklist-ul de mai jos presupune verificare per serviciu odată ce acest răspuns există.

| Serviciu (Val) | Întrebare de conformitate | Status |
|---|---|---|
| Shield (V1) | Nu implică pază fizică directă — verifică dacă „SOS către dispecerat propriu" ridică vreo obligație de raportare specifică. | De verificat cu avocat |
| Protect Ride (V1) | Se încadrează la „transport + pază persoane simultan"? Necesită atestat specific pentru șofer-agent? | De verificat cu avocat (întrebare deja identificată în v1.0) |
| Escortă (V1) | Pază de persoane — verifică dacă atestatul standard de agent de pază acoperă toate contextele descrise (bancomat, club, dating, custodie). | De verificat cu avocat |
| Protecție cu ora (V1) | Similar Escortei, la scară de echipă — verifică reguli privind numărul de agenți per persoană protejată. | De verificat cu avocat |
| Trusted Meet (V2) | Verificare identitate ambele părți — implicații GDPR suplimentare (date despre terți, nu doar clientul direct). | De verificat |
| Kids (V2) | Transport minori — verifică cerințe suplimentare de atestare/evaluare psihologică impuse legal, nu doar de politica internă PROTEGO. | De verificat |
| Secure Delivery / Cargo (V3) | **Transport de valori peste plafon legal necesită licență dedicată — confirmat explicit ca fiind în afara scopului actual.** Sub plafon, verifică oricum ce documente de asigurare/declarare sunt necesare. | Marcat clar „nu în această fază" — reconfirmă pragul legal exact cu avocat |
| Night — split payment (V3) | Verifică dacă mecanismul de plată împărțită ridică probleme de servicii de plată reglementate (nu doar UX). | De verificat |
| Residence (V4) | **Intervenția la alarmă necesită licență de monitorizare/intervenție separată** — confirmat ca declanșator de licențiere suplimentară. | Marcat clar — nu se lansează fără licența corespunzătoare sau partener licențiat |
| Partner marketplace (V4) | Firmele afiliate operează sub propria licență — verifică structura contractuală de comision (15–25%) din perspectivă fiscală/juridică. | De verificat, relevant abia la V4 |

## 2. Formulare „nu suntem 112"

**Regulă obligatorie, fără excepție:** niciun text din aplicație, site sau materiale de marketing nu trebuie să sugereze că PROTEGO înlocuiește sau garantează un timp de răspuns echivalent serviciilor publice de urgență (112).

Puncte de verificare unde acest wording trebuie prezent și corect:
- Ecranul SOS din aplicația Client (buton + text explicativ).
- Termeni și condiții / politica de utilizare.
- Site-ul public (`protego-site.html` conține deja o formulare bună de referință: *„Nu suntem un ride-share. Suntem o firmă de pază cu aplicație"* + nota despre dispecerat — de verificat totuși dacă lipsește o mențiune explicită „nu înlocuim 112" care să fie completată).
- Materiale de marketing pentru fiecare val nou de servicii (mai ales Night/Cargo, unde percepția de „protecție totală" e mai ușor de suprapromis).
- Scriptul dispeceratului la SOS (`docs/operations/dispatcher-playbook.md`) — formulare clară către utilizator în timpul apelului.

## 3. GDPR / ANSPDCP

- **Temei legal pentru tracking locație:** consimțământ explicit necesar, colectat distinct de acceptul general al termenilor — de definit exact tipul de consimțământ (contractual vs. consimțământ separat) cu avocatul.
- **Retenție date:** traseele/locațiile trebuie să aibă o perioadă de retenție definită, urmată de anonimizare — valoarea exactă (număr de luni) nu e stabilită în MASTERPROMPT v2; de propus și confirmat.
- **Export/ștergere la cerere:** obligatoriu (drept de acces și drept la ștergere GDPR) — funcționalitate de produs necesară, nu doar politică scrisă.
- **DPO (responsabil cu protecția datelor):** desemnare necesară — de confirmat cine (intern sau extern) și dacă e obligatorie legal la scara pilotului sau doar recomandată.
- **Notificare ANSPDCP:** de verificat dacă activitatea (în special tracking locație + date sensibile precum cazier pentru agenți) impune notificare sau evaluare de impact (DPIA) înainte de lansare.
- **Date despre minori (Kids, V2):** regim special de consimțământ (parental) — de clarificat cu avocatul înainte de V2, nu blochează MVP-ul dar trebuie planificat din timp.

## 4. Contracte colaboratori & asigurare

- **Contract-cadru de colaborare** pentru agenții Verified — trebuie să reflecte juridic statutul de colaborator contractat al firmei licențiate (nu angajat, nu furnizor independent către client). Vezi `supply-model.md` §3.
- **Poliță RC extinsă pe colaboratori** — acoperire pentru activitatea prestată sub licența PROTEGO.
- **Documente cu expirare** (atestat IGPR etc.) — proces de reînnoire automată + blocare la expirare, deja specificat funcțional (`supply-model.md`), dar trebuie validat că frecvența alertelor respectă orice cerință legală de reatestare.

## 5. Rezumat — ce blochează ce

| Blocaj legal | Ce nu se poate finaliza fără el |
|---|---|
| Scopul exact al licenței (categorii acoperite) | Confirmarea definitivă a fiecărui serviciu MVP + planificarea Cargo/Residence |
| Temei legal GDPR pentru tracking | Textul exact de consimțământ din aplicație (M1) |
| Contract-cadru colaboratori + poliță RC | Onboarding-ul legal complet al agenților Verified (M3) |
| Prag legal transport valori | Specificația finală Secure Delivery (V3, M9) |
| Licență monitorizare/intervenție | Lansarea PROTEGO Residence (V4, M10) |

Toate aceste puncte sunt reluate, ca întrebări directe pentru avocat, în `questions-for-lawyer.md`.
