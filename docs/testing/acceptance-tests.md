# PROTEGO — Teste de acceptanță (Given/When/Then), per milestone

**Sursă de adevăr:** cerințele din `docs/product/prd.md`, `docs/product/business-rules.md`, `docs/product/user-flows.md`, mapate pe roadmap-ul din `docs/product/roadmap.md` (M0–M7 obligatorii pentru pilot; M8–M10 doar schițate, pentru referință viitoare).

**Regulă de proces:** niciun milestone nu se declară „gata" fără ca testele lui de acceptanță să treacă. Testele de mai jos sunt nivelul minim — echipa de implementare poate adăuga teste suplimentare, dar nu poate elimina din cele de aici fără aprobare explicită.

---

## M0 — Fundament

**Given** monorepo-ul este inițializat,
**When** rulez comenzile de lint, typecheck și test din CI,
**Then** toate trec fără erori, fără nicio funcționalitate de auth/booking/plăți/hărți prezentă încă.

**Given** fișierul `.env.example`,
**When** îl inspectez,
**Then** nu conține nicio cheie reală, doar nume de variabile necesare.

## M1 — Conturi & roluri

**Given** un utilizator nou,
**When** se înregistrează cu telefon (OTP) și email,
**Then** contul e creat cu rol implicit „client" și nivel de verificare 1.

**Given** un client cu verificare nivel 1 (doar telefon),
**When** încearcă să confirme prima misiune,
**Then** sistemul blochează confirmarea și cere verificare nivel 2 (CI + selfie).

**Given** un agent autentificat,
**When** interoghează datele altui agent sau ale unui client prin API,
**Then** RLS blochează accesul — primește doar propriile date.

**Given** un client autentificat,
**When** interoghează misiunile altui client,
**Then** RLS blochează accesul complet.

## M2 — Booking (Protect Ride, Escortă, Protecție cu ora)

**Given** un client parcurge fluxul de rezervare pentru oricare din cele 3 servicii plătite,
**When** ajunge la pasul de ofertă,
**Then** vede o defalcare de preț pe componente (nu o sumă globală opacă), calculată din motorul de prețuri configurabil din admin — nicio valoare hardcodată în cod.

**Given** răspunsurile clientului la chestionarul scurt de context indică risc ridicat,
**When** încearcă să confirme misiunea,
**Then** misiunea **nu se confirmă automat** și intră în coada de risc ridicat a dispeceratului.

**Given** un client selectează „vehiculul meu" ca opțiune de mobilitate,
**When** nu a completat consimțământul, checklist-ul foto și confirmarea asigurării,
**Then** sistemul blochează trecerea la pasul de plată.

**Given** admin modifică un parametru al motorului de prețuri (ex. lei/oră/agent) pentru un oraș,
**When** un client generează o nouă ofertă în acel oraș,
**Then** oferta reflectă noua valoare, fără a necesita deploy de cod.

## M3 — Aplicația Agent

**Given** un candidat agent aplică cu toate documentele cerute,
**When** finalizează interviul video și misiunea de probă,
**Then** statusul contului trece prin „în verificare" → „aprobat" → „activ", în această ordine, fără posibilitatea de a sări direct la „activ".

**Given** un agent activ primește o ofertă de misiune,
**When** nu răspunde în 45 de secunde,
**Then** oferta expiră automat și misiunea revine în coada dispeceratului.

**Given** un document al agentului (ex. atestat) își atinge data de expirare,
**When** nu a fost reînnoit,
**Then** agentul este blocat automat din alocări de misiuni noi, fără intervenție manuală necesară.

**Given** o misiune care folosește vehiculul clientului,
**When** agentul încearcă să pornească misiunea fără checklist foto complet,
**Then** sistemul nu permite trecerea la statusul „protecție începută".

## M4 — Live Ops (tracking, chat, SOS, dispecerat)

**Given** o misiune activă,
**When** clientul apasă butonul SOS,
**Then** alerta ajunge instant în consola SOS a dispeceratului, cu locația atașată, și declanșează protocolul definit în `docs/operations/dispatcher-playbook.md`.

**Given** o misiune activă în afara ferestrei ei,
**When** un utilizator terț încearcă să acceseze locația live a agentului,
**Then** accesul este refuzat (RLS) — locația e vizibilă exclusiv clientului asociat, exclusiv în timpul misiunii active.

**Given** o misiune neasignată în coadă,
**When** dispecerul o asignează manual,
**Then** sistemul afișează sugestii ordonate (distanță, rating, badge, vehicul), dar decizia finală necesită acțiune explicită a dispecerului.

## M5 — Plăți

**Given** un client confirmă o misiune,
**When** confirmarea are loc,
**Then** se creează o preautorizare (hold) pe card, nu o captură imediată.

**Given** o misiune se încheie,
**When** statusul trece la „încheiat",
**Then** se declanșează captura sumei finale, calculată pe baza duratei/traseului real.

**Given** un client cere prelungirea (overage) unei misiuni active,
**When** nu confirmă explicit în aplicație,
**Then** nicio re-preautorizare nu se emite și misiunea se încheie la ora programată inițial.

**Given** un client anulează o misiune,
**When** anularea are loc în intervalul configurat ca gratuit,
**Then** preautorizarea este eliberată integral, fără captură.

## M6 — Shield

**Given** dispeceratul funcționează stabil pe misiunile plătite (M4–M5 validate),
**When** Shield este activat public,
**Then** orice utilizator (cu sau fără misiune activă) poate declanșa SOS, Walk With Me, partajare cu cercul de încredere, sau apel fals.

**Given** un utilizator activează Walk With Me cu un timer,
**When** timpul expiră fără check-in de confirmare,
**Then** sistemul contactează automat cercul de încredere și/sau escaladează spre dispecerat, conform protocolului definit.

**Given** Shield NU a fost încă validat pe M4–M5,
**When** cineva propune activarea publică a Shield mai devreme,
**Then** activarea este blocată — condiția de poartă (gate) este obligatorie, nu opțională.

## M7 — QA & Pilot

**Given** build-urile finale (Android/iOS) sunt generate,
**When** rulează suita completă de teste de acceptanță M1–M6,
**Then** toate trec, iar orice eșec blochează lansarea pilotului.

**Given** pilotul pornește într-un oraș,
**When** un client rezervă oricare din cele 3 servicii plătite,
**Then** fluxul complet (rezervare → alocare → misiune activă → finalizare → rating/factură) funcționează end-to-end, cu dispecerat manual real, fără nicio funcționalitate din Valul 2–4 vizibilă.

---

## M8–M10 — schiță pentru referință viitoare (nu se implementează în pilot)

- **M8 (Valul 2):** teste pentru abonamente (activare/dezactivare plan, ore rămase), verificare extinsă pentru agenți Kids, facturare recurentă.
- **M9 (Night & Cargo):** teste pentru split-payment (fiecare membru al grupului confirmă separat, misiunea nu pornește dacă nu toți confirmă — mecanism exact de definit, vezi `docs/product/open-decisions.md` #6), chain of custody Cargo (sigiliu + foto + OTP + semnătură, misiunea nu se poate încheia fără toate dovezile).
- **M10 (Platformă):** teste pentru onboarding Partner (licență + asigurare verificate înainte de activare), calcul comision 15–25%, autentificare API extern.

Aceste teste se detaliază complet abia când valul respectiv intră în construcție, pentru a nu ancora produsul prematur pe decizii încă deschise.
