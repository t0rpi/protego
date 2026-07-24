# PROTEGO — Întrebări pentru avocat

Compilare a tuturor punctelor legale care nu pot fi rezolvate intern, identificate în `compliance-checklist.md` și în materialele sursă (MASTERPROMPT v2, Master Plan v1.0). Organizat pe teme, în ordinea priorității pentru pilot (MVP).

---

## A. Licențiere (Legea 333/2003) — prioritate maximă, blochează M1–M2

1. Ce categorii de servicii acoperă exact licența actuală a firmei? (pază bunuri, pază persoane, gardă de corp, transport valori, monitorizare/intervenție la alarmă — care dintre acestea sunt incluse explicit?)
2. Serviciul **Protect Ride** combină transport + pază de persoane în același timp — necesită această combinație o încadrare/atestare specifică, diferită de pază simplă?
3. Serviciul **Escortă** acoperă contexte foarte variate (întâlnire cu necunoscut, retragere numerar, ieșire din club, custodie tensionată) — există vreo limitare legală pe tipul de context în care poate interveni un agent de pază contractat ca PROTEGO Verified?
4. Ce obligații de evidență a misiunilor și raportare către poliție/IGPR există pentru o firmă de pază care operează prin aplicație (self-service, rezervare instant)?
5. Care este exact pragul legal (valoare) peste care transportul de bunuri valoroase (Secure Delivery, Valul 3) necesită licențiere/vehicule dedicate suplimentare?
6. Ce presupune legal „licență de monitorizare/intervenție" pentru PROTEGO Residence (Valul 4) — se poate obține ca extensie a licenței actuale sau necesită parteneriat cu o firmă deja licențiată pe monitorizare?

## B. Contracte de colaborare (agenți Verified)

7. Ce structură contractuală respectă corect statutul de „colaborator contractat al firmei licențiate" (nu angajat, nu furnizor independent) pentru agenții din surse externe (foști Uber/Bolt, foști MAI/MApN)?
8. Ce clauze minime trebuie să conțină contractul-cadru de colaborare (confidențialitate, respectarea protocoalelor PROTEGO, folosirea licenței firmei, răspundere)?
9. Ce tip exact de poliță RC (extinsă) e necesară pentru activitatea colaboratorilor sub licența PROTEGO, și cine o achiziționează (firma sau agentul, cu confirmare din partea firmei)?

## C. GDPR / date cu caracter personal

10. Care este temeiul legal corect pentru colectarea și procesarea locației în timp real a clientului și agentului (consimțământ explicit distinct vs. necesitate contractuală)?
11. Ce perioadă de retenție este recomandată/impusă pentru traseele de misiune înainte de anonimizare?
12. Este necesară o evaluare de impact asupra protecției datelor (DPIA) înainte de lansarea pilotului, dat fiind că se procesează inclusiv date sensibile ale agenților (cazier judiciar)?
13. Este obligatorie notificarea ANSPDCP pentru activitatea descrisă, sau doar desemnarea unui DPO?
14. Pentru serviciul Kids (Valul 2): ce regim de consimțământ parental și ce cerințe suplimentare de verificare a agenților sunt impuse legal (dincolo de politica internă PROTEGO)?

## D. Formulare și comunicare publică

15. Este suficientă formularea actuală de tip „nu înlocuim 112" din materialele de prototip, sau există un text/disclaimer standard recomandat legal pentru acest tip de serviciu?
16. Există riscuri de răspundere dacă un utilizator interpretează greșit promisiunea de siguranță din marketing (ex.: „ești protejat") ca o garanție de rezultat?

## E. Servicii viitoare (nu blochează MVP, dar necesită răspuns înainte de valul respectiv)

17. Split-payment (Night, Valul 3): mecanismul de plată împărțită între membrii unui grup ridică probleme de reglementare a serviciilor de plată (dincolo de simpla procesare Stripe)?
18. Comisionul Partner (15–25%, Valul 4): ce structură contractuală/fiscală e recomandată pentru relația PROTEGO – firmă de pază afiliată?
19. API Safety-as-a-Service (Valul 4): ce răspundere are PROTEGO când „butonul" e integrat într-o aplicație terță și utilizatorul final nu e client direct PROTEGO?

## F. Informații administrative conexe (nu strict juridice, dar relevante pentru avocat/context)

20. Orașul pilot este confirmat oficial? (materialele de prototip menționează Oradea — vezi `docs/product/open-decisions.md` #1)
21. Există deja o evaluare a numărului de agenți atestați disponibili și a licențierii lor individuale pentru pilot?

---

## Status

Toate întrebările de mai sus sunt **deschise** la data acestui document (23 iulie 2026). Pe măsură ce primesc răspuns, se actualizează `compliance-checklist.md` și, dacă răspunsul schimbă o decizie de produs, `docs/product/open-decisions.md` și `PROTEGO_MASTERPROMPT_v2.2.md` (versiune nouă).
