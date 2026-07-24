# PROTEGO — Decizii deschise / contradicții de rezolvat

Acest document colectează toate punctele unde materialele disponibile (MASTERPROMPT v2, draftul v1.0/v1.1, prototipurile HTML) fie se contrazic, fie lasă o valoare neconfirmată explicit ca decizie închisă. Conform regulii de lucru, **nu s-a inventat nicio rezolvare** pentru punctele de mai jos — fiecare așteaptă decizie explicită în chatul de coordonare.

Sursa de adevăr rămâne `PROTEGO_MASTERPROMPT_v2.2.md`; unde acesta tace, se listează aici.

---

### 1. Orașul pilot — ✅ REZOLVAT
- **Ce spunea v1.0:** „Oradea sau Satu Mare — de confirmat" (Master Plan v1.0, §0.8).
- **Ce spunea v2.0:** nimic explicit — „pilot, un oraș", fără nume.
- **Ce spunea prototipul site:** `protego-site.html` afirmă direct „Lansăm programul pilot în Oradea".
- **Rezolvare (MASTERPROMPT v2.2 §2, decizia #15):** orașul pilot este **ORADEA**, confirmat explicit de fondator. Geofencing, recrutarea agenților și marketingul local se fac pe Oradea. Reflectat deja în `strings.ro.json`/`strings.en.json` (`booking.zoneNote`, `agentApp.availableSub`, `subs.note`) și în seed-ul de date al pilotului (`docs/architecture/repository-audit.md` §7, M7).
- **Impact:** zone de operare (geofencing), recrutare agenți locali, buget marketing local — toate pe Oradea, nu mai sunt condiționate de o decizie viitoare.

### 2. Scopul exact al licenței firmei (Legea 333/2003)
- **Ce spune v1.0:** listată explicit ca informație blocantă necesară de la fondator — ce categorii acoperă licența (pază bunuri/persoane, gardă de corp, transport valori, monitorizare)?
- **Ce spune v2:** confirmă doar principiul (operator licențiat, fără arme letale), nu categoriile exacte acoperite.
- **Impact:** direct asupra `compliance-checklist.md` — fără acest răspuns nu se poate confirma definitiv că Escortă, Protecție cu ora și (ulterior) Cargo/Residence se încadrează fără completări de licență.
- **Necesită:** copie/rezumat al licenței, verificat cu avocatul — vezi `docs/legal/questions-for-lawyer.md`.

### 3. Pragul de degresivitate la Protecție cu ora — ✅ REZOLVAT
- **Ce spunea v1.1:** tarif degresiv „peste 8 ore".
- **Ce spunea v2.0:** nu repeta acest prag ca decizie închisă.
- **Rezolvare (MASTERPROMPT v2.1 §2, decizia #8):** prag de referință confirmat la 8 ore, ca valoare implicită **configurabilă** din admin (nu hardcodată). Reflectat în `business-rules.md` și `prd.md`.

### 4. Fereastra de anulare gratuită — ✅ REZOLVAT
- **Ce spunea prototipul:** 60 de minute înainte de misiune, anulare gratuită.
- **Ce spunea v2.0:** nu specifica o valoare.
- **Rezolvare (MASTERPROMPT v2.1 §2, decizia #9):** 60 de minute înainte de misiune, ca valoare implicită **configurabilă** din admin; sub prag se pot aplica penalizări, de asemenea configurabile. Reflectat în `business-rules.md` §3.

### 5. Vehiculul PROTEGO — specificație de flotă — ✅ REZOLVAT
- **Ce spunea v1.1/prototip:** „SUV negru" ca vehicul PROTEGO implicit.
- **Ce spunea v2.0:** nu specifica marcă/model/tip caroserie.
- **Rezolvare (MASTERPROMPT v2.1 §2, decizia #10):** specificație de brand confirmată = „vehicul negru, categorie premium/SUV"; flota exactă (mărci/modele) se definește la pilot, cu vehiculele reale ale firmei. „SUV negru" din prototip rămâne direcție vizuală, nu obligație de flotă. Reflectat în `services-catalog.md`.

### 6. Mecanismul UX al split-payment (PROTEGO Night, Valul 3) — ⏸ AMÂNAT FORMAL
- **Ce spune v2.1 (§2, decizia #12):** decizie de produs **amânată oficial pentru Valul 3 (M9)**; nu blochează nimic din M0–M7; schema `groups` rămâne future-ready (vezi `data-model.md`).
- **Întrebări rămase deschise, de rezolvat la M9, nu înainte:** cine inițiază split-ul (organizatorul grupului sau oricine)? Împărțire strict egală sau ajustabilă? Se preautorizează individual la confirmarea misiunii sau abia la începutul serii? Ce se întâmplă dacă un membru al grupului nu confirmă plata?
- **Impact:** design UX + schema `groups`/`payments`, exclusiv pentru Valul 3 (M9) — fără impact asupra MVP.

### 7. Minimul de facturare la Escortă — ✅ REZOLVAT
- **Ce spunea v1.1:** „minim 1 oră" în cadrul serviciului etichetat 1–2 ore.
- **Ce spunea v2.0:** păstra denumirea „Escortă (1–2h)" fără a repeta minimul explicit.
- **Rezolvare (MASTERPROMPT v2.1 §2, decizia #11):** minim de facturare confirmat la 1 oră, valoare implicită **configurabilă** din admin. Reflectat în `business-rules.md` și `prd.md`.

### 8. Informații operaționale de la fondator, marcate blocante în v1.0 și nereconfirmate în v2
Listă originală (Master Plan v1.0 §9), stare necunoscută la data acestui document:
- numărul exact de agenți atestați disponibili pentru pilot și vehiculele aferente (marcă/model/an);
- bugetul lunar aproximativ de operare;
- dacă domeniul protego.ro e cumpărat (prototipul site sugerează că da, dar nu e confirmat oficial aici);
- confirmarea mediului de lucru (Windows) pentru comenzile exacte de instalare a uneltelor de dezvoltare.
- **Necesită:** reconfirmare rapidă — posibil deja rezolvate între timp, dar nu apar ca atare în MASTERPROMPT v2.

### 9. Notă de versiune deja rezolvată (informativă, nu un open decision activ)
Secure Delivery apărea în Valul 2 în draftul v1.1; MASTERPROMPT v2 îl mută explicit în Valul 3 (Cargo). **v2 este autoritativă** — `services-catalog.md` reflectă deja poziționarea corectă. Menționat aici doar pentru trasabilitate istorică.

---

## Cum se închide un punct din acest document

1. Decizia se ia explicit în chatul de coordonare.
2. `PROTEGO_MASTERPROMPT_v2.2.md` se actualizează la o versiune nouă (v2.3...) cu decizia inclusă în secțiunea 2 (decizii închise) sau secțiunea relevantă.
3. Documentul de aici se actualizează — punctul se marchează „rezolvat" cu trimitere la versiunea MASTERPROMPT care îl conține, sau se elimină.
4. Documentele derivate (`business-rules.md`, `services-catalog.md` etc.) se actualizează pentru a elimina mențiunea „neconfirmat".
