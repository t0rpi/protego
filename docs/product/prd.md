# PROTEGO — PRD (Product Requirements Document) — MVP / Valul 1

**Scop:** singurul document de cerințe activ pentru construcție curentă. Acoperă **exclusiv** cele patru servicii ale MVP-ului: **Shield-basic, Protect Ride, Escortă 1–2h, Protecție cu ora 2h+**, cu dispecerat manual, într-un singur oraș pilot.

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §2 (decizii închise), §3 (Valul 1), §5 (produs), §7 (roadmap M0–M7).

**Regulă strictă de milestone:** nimic din Valul 2–4 (`services-catalog.md`) nu se implementează în acest PRD. Dacă o cerință pare să necesite funcționalitate de val superior, se marchează „post-MVP" și se oprește discuția aici.

---

## 1. Obiectivul pilotului

Dovedirea unui singur lucru: că PROTEGO poate opera profitabil misiuni plătite (Protect Ride, Escortă, Protecție cu ora) într-un oraș, cu dispecerat manual și agenți proprii/Verified, la un nivel de încredere și siguranță perceput superior unui ride-share obișnuit. Shield gratuit rulează în paralel, dar lansarea sa publică e condiționată de dispeceratul rodat pe misiuni plătite (vezi M6 în `roadmap.md`).

**KPI-uri de pilot** (ținte de lucru aprobate — MASTERPROMPT v2.1 §2, decizia #14; ajustabile după primele săptămâni de operare, dar nu mai sunt propuneri deschise):
- prim contact al dispecerului la SOS: sub 60 de secunde;
- agent alocat: sub 5 minute de la confirmarea misiunii;
- rating mediu agent: ≥ 4,7;
- **regulă absolută, nu KPI:** zero misiuni de risc ridicat confirmate automat.

**Metrici suplimentare, încă propuneri** (de confirmat cu fondatorul — nu apar în v2.1 §2.14):
- rata de misiuni finalizate fără incident;
- numărul de misiuni/săptămână necesar pentru prag de profitabilitate operațională.

## 2. Roluri implicate

- **Client** — persoana care rezervă și/sau este protejată (pot fi persoane diferite, vezi `user-flows.md`).
- **Agent** — colaborator contractat PROTEGO Elite sau Verified (vezi `supply-model.md`).
- **Dispecer** — operator uman care monitorizează, asignează manual și gestionează SOS (vezi `docs/operations/dispatcher-playbook.md`).
- **Admin** — configurează prețuri, servicii active pe oraș, utilizatori, rapoarte.

## 3. Shield-basic (nivel gratuit, tab permanent în aplicația Client)

Funcționalități MVP:
1. **SOS real** — buton vizibil permanent → alertă instant la dispecerat, cu locație. Dispecerul sună, escaladează, jurnalizează. Formulare legală obligatorie: PROTEGO **nu înlocuiește 112**.
2. **Walk With Me** — check-in cu timer: utilizatorul setează o durată estimată de deplasare; dacă nu confirmă sosirea la termen, se declanșează un protocol de verificare (contact cerc de încredere → dacă nu răspunde, alertă dispecerat).
3. **Cerc de încredere** — contacte desemnate de utilizator, cărora li se poate partaja locația live (link web) manual sau automat (la Walk With Me expirat / SOS).
4. **Apel fals** — utilizatorul programează un apel fals de urgență, cu scenariu, pentru a ieși dintr-o situație incomodă.

**Condiție de lansare publică:** Shield nu se activează pentru publicul larg până când dispeceratul nu funcționează stabil 24/7 pe misiunile plătite (M6, după M4–M5). Această regulă este obligatorie, nu opțională — un SOS gratuit fără răspuns distruge brandul.

## 4. Protect Ride

**Nevoia:** transport securizat din punct A în punct B.

Cerințe funcționale:
- Alegere mobilitate: **vehicul PROTEGO cu agent-șofer atestat** SAU **vehiculul clientului**, condus de agent, **doar** cu: consimțământ explicit al clientului, checklist foto al vehiculului (stare, KM, combustibil), confirmare asigurare validă.
- Rezervare acum / programată.
- Ofertă de preț defalcată transparent înainte de confirmare (fără valori ascunse).
- Preautorizare plată la confirmare, captură la finalul misiunii.
- **Cod unic de verificare a misiunii**, generat la confirmare, cerut de client agentului la sosire.
- Tracking live pe hartă + link de partajare către cercul de încredere.
- Chat în aplicație + apel mascat (numerele nu se văd reciproc).
- Buton SOS activ pe toată durata misiunii.
- Statusuri: confirmat → agent pe drum → agent a ajuns → protecție activă → încheiat.
- Prelungire posibilă din aplicație, cu re-preautorizare (overage).

## 5. Escortă (1–2 ore)

**Nevoia:** o persoană alături la un moment cu risc perceput (întâlnire cu necunoscut, ieșire din club, retragere de bani, dating, predare/preluare copil în context tensionat).

Cerințe funcționale:
- Mobilitate: pe jos, cu vehicul PROTEGO, sau cu vehiculul clientului (aceleași reguli de consimțământ ca la Protect Ride).
- Durată standard 1–2 ore; facturare pe oră, cu minim de facturare (valoare exactă configurabilă din admin — vezi `business-rules.md`).
- **Chestionar scurt de context** înainte de confirmare (ex.: „există o amenințare cunoscută?") — dacă răspunsurile indică risc ridicat, misiunea **nu se confirmă automat**, ci intră în coada de risc ridicat a dispeceratului pentru confirmare umană.
- Cod unic de verificare, tracking, SOS, chat/apel mascat — identic cu Protect Ride.

## 6. Protecție cu ora (2h+)

**Nevoia:** protecție dedicată pe o perioadă mai lungă (evenimente private, delegații, filmări, program de o zi).

Cerințe funcționale:
- Recomandare automată a numărului de agenți, în funcție de numărul de persoane protejate și de contextul declarat.
- Facturare orară dincolo de pragul de 2 ore; regula de degresivitate este confirmată la un prag de 8 ore (MASTERPROMPT v2.1 §2, decizia #8), ca valoare implicită **configurabilă din admin**, nu hardcodată (detaliu în `business-rules.md`).
- Overage automat propus dacă misiunea depășește durata rezervată, dar necesită **acordul explicit al clientului în aplicație** înainte de re-preautorizare.
- Aceeași bază de siguranță: cod de verificare, tracking, SOS, chat/apel mascat.

## 7. Cerințe transversale (toate cele 3 misiuni plătite)

- **Verificare identitate progresivă:** nivel 1 (telefon, OTP) suficient pentru estimări/explorare; **nivel 2 (CI + selfie) obligatoriu** înainte de prima misiune confirmată — protejează agenții de clienți-fantomă.
- **Persoane protejate salvate:** clientul poate salva profiluri (el însuși, copil, părinte) — relevant chiar din MVP pentru rezervări „pentru altcineva".
- **Plată:** Stripe, preautorizare la confirmare, captură la final, anulare/refund conform politicii din `business-rules.md`.
- **Rating:** 5 stele + etichete (punctual, profesionist, discret etc.) după fiecare misiune.
- **Raport & factură:** rezumat automat, factură pe email; raport PDF de misiune la serviciile care îl includ.
- **Istoric & re-book:** listă de misiuni anterioare, opțiune „repetă misiunea".
- **Localizare:** RO/EN complet din prima zi, monedă RON.
- **Temă:** dark mode nativ (identitate de brand).
- **Risc ridicat:** orice misiune marcată cu risc ridicat de chestionarul de context **nu se confirmă automat, niciodată** — regulă închisă, fără excepție de produs.

## 8. Admin — nivel minim necesar pentru pilot

Chiar dacă `docs/architecture` acoperă detaliile, PRD-ul reține cerința funcțională: admin trebuie să poată activa/dezactiva fiecare din cele 4 servicii MVP per oraș (switch), configura motorul de prețuri v1 (fără valori hardcodate în cod), și vedea audit log-ul acțiunilor critice.

## 9. Explicit NU în scop pentru MVP

- Orice serviciu din Valul 2, 3 sau 4 (`services-catalog.md`).
- Dispecerat automat / AI dispatch.
- Abonamente, split-payment, marketplace Partner, API extern.
- Transport de bunuri (Cargo) sau verticale Night.
- Suport pentru mai multe orașe simultan.

## 10. Asumpții vs. decizii

**Decizii închise** (nu se schimbă fără aprobare explicită în chatul de coordonare): scope-ul celor 4 servicii MVP, dispecerat manual, risc ridicat = confirmare umană obligatorie, prețuri niciodată hardcodate, KPI-urile de pilot din secțiunea 1 (MASTERPROMPT v2.1 §2, #14), pragul de degresivitate de 8h (§2, #8), minimul de facturare de 1h la Escortă (§2, #11).

**Asumpții/propuneri deschise** (de confirmat): metricile suplimentare din secțiunea 1 (rata de misiuni fără incident, prag de profitabilitate operațională). Vezi `open-decisions.md` pentru lista completă a punctelor rămase deschise la nivel de proiect (#1 oraș pilot, #2 categorii licență, #8 date operaționale).
