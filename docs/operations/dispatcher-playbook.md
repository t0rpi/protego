# PROTEGO — Playbook Dispecerat

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §5C. Acest playbook este documentul operațional de referință pentru dispecerii PROTEGO din pilot (dispecerat manual, un singur oraș).

---

## 1. Rolul dispeceratului

Dispeceratul este singurul punct uman care: asignează misiuni manual, monitorizează hărți/statusuri live, gestionează consola SOS (inclusiv alerte gratuite din Shield), decide asupra misiunilor de risc ridicat, și jurnalizează orice intervenție critică. Nimic din aceste responsabilități nu e automatizat în MVP.

## 2. Monitorizare & asignare manuală

1. Hartă live cu toți agenții activi + toate misiunile în curs, codate pe culori după status.
2. Coada de misiuni neasignate, afișată cu un timer de așteptare vizibil (pentru a preveni întârzieri).
3. La asignare, dispecerul primește **sugestii ordonate** (distanță până la pickup, rating agent, badge-uri relevante, disponibilitate vehicul) — decizia finală rămâne manuală.
4. La refuz sau expirare a ferestrei de 45 secunde din partea agentului, misiunea revine automat în coadă pentru realocare de către dispecer.
5. Orice reasignare (refuz, anulare, incident) se jurnalizează.

## 3. Consola SOS — protocol pas-cu-pas

**Se aplică identic** indiferent dacă alerta vine dintr-o misiune plătită activă sau de la un utilizator Shield gratuit fără misiune activă — consola SOS nu prioritizează diferit în funcție de tipul de cont.

1. **Recepție alertă** — sonor + vizual, cu locația atașată afișată imediat pe hartă.
2. **Apel imediat** — dispecerul apasă „apel cu un click" către persoana care a declanșat SOS (client sau agent, după caz).
3. **Urmărire script** — protocol afișat pas-cu-pas în interfață:
   a. confirmă identitatea și situația persoanei;
   b. evaluează nivelul de urgență (pericol imediat vs. disconfort/precauție);
   c. liniștește și obține informații esențiale (locație exactă confirmată, natura amenințării, dacă mai e cineva implicat);
   d. dacă situația indică pericol real și imediat, **îndrumă/facilitează contactul cu 112** — dispecerul nu se substituie serviciului de urgență public, ci facilitează și oferă context (locație, istoric misiune) dacă e util.
4. **Escaladare internă** — dacă e nevoie de sprijin suplimentar (ex.: alt agent trimis în zonă, notificare management), dispecerul escaladează conform procedurii interne a firmei.
5. **Jurnalizare obligatorie** — indiferent de rezultat, fiecare intervenție SOS se înregistrează complet (oră, acțiuni luate, rezultat) în `audit_log`/`shield_events` sau `incidents`, după caz.

**Regulă de formulare, valabilă pe tot parcursul apelului:** dispecerul nu promite niciodată un timp de răspuns echivalent 112 și nu afirmă că PROTEGO înlocuiește intervenția poliției/ambulanței. Vezi `docs/legal/compliance-checklist.md` §2.

## 4. Coada de risc ridicat

- Orice misiune rutată de chestionarul de context al clientului către risc ridicat intră într-o **coadă separată**, vizibilă distinct de coada normală.
- **Regulă necondiționată:** aceste misiuni **nu se confirmă niciodată automat** — un dispecer trebuie să evalueze explicit și să decidă asignarea (sau să solicite informații suplimentare clientului înainte de a decide).
- Dacă dispecerul consideră că informațiile disponibile sunt insuficiente pentru o decizie sigură, poate contacta clientul direct înainte de alocare.

## 5. Alerte Shield (nivel gratuit)

- Utilizatorii Shield (fără misiune plătită activă) pot genera: SOS direct, expirare Walk With Me fără check-in, activare manuală a partajării locației către cercul de încredere.
- Toate aceste evenimente ajung în aceeași consolă SOS, cu același protocol de la punctul 3.
- **Notă de guvernanță importantă:** Shield nu se activează pentru publicul larg până când acest protocol nu este validat funcțional pe misiunile plătite (M6, condiționat de M4–M5 rodate) — vezi `docs/product/roadmap.md`.

## 6. Verificarea agenților

- Coadă dedicată pentru aplicații noi și reînnoiri de documente (agenți Verified).
- Dispecerul/echipa de operațiuni verifică documentele încărcate (atestat, cazier, CI, permis, asigurare) înainte de a aproba trecerea la statusul „activ".
- Documentele cu expirare declanșează alerte automate; la expirare fără reînnoire, agentul e blocat automat din alocări — dispecerul nu poate suprascrie manual această blocare fără o procedură explicită de excepție (de definit, nu implicit permisă).

## 7. Plăți — vizibilitate operațională

- Dispeceratul are vizibilitate asupra preautorizărilor, capturilor și refund-urilor legate de misiuni, pentru a putea răspunde la întrebări ale clienților sau agenților în timp real.
- Disputele de plată se escaladează către rolul Admin/financiar — dispeceratul nu procesează direct refund-uri fără procedura stabilită.

## 8. Rapoarte operaționale zilnice

- Număr de misiuni/zi, timp mediu de răspuns (asignare + SOS), rating mediu, număr de incidente.
- Aceste rapoarte alimentează KPI-urile propuse în `docs/product/prd.md` §1 (neconfirmate încă ca decizii finale).

## 9. Predarea turei (shift handover)

Recomandare operațională (nu decizie formală în MASTERPROMPT): la schimbarea turei, dispecerul care predă trebuie să comunice explicit misiunile active, orice situație de risc ridicat în curs de evaluare, și orice incident/SOS recent nerezolvat complet. De formalizat ca procedură scrisă înainte de pilot.

## 10. Ce nu face dispeceratul (limite explicite)

- Nu confirmă automat nicio misiune de risc ridicat.
- Nu promite intervenție de tip 112.
- Nu autorizează plăți/refund-uri în afara procedurii stabilite cu rolul Admin.
- Nu suprascrie blocarea automată a unui agent cu documente expirate fără o procedură de excepție documentată separat.
