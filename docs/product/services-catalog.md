# PROTEGO — Catalogul complet de servicii (pe valuri)

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §3 (catalogul pe valuri) și §4 (supply). Detalii operaționale suplimentare, neconflictuale, preluate din `PROTEGO_Servicii_si_Aplicatie_v1.1.md` (marcate explicit ca *detaliu draft, neconfirmat oficial*). **Nu se amestecă valurile** — orice construcție curentă respectă strict Valul 1 (MVP); restul e specificație pentru planificare, nu backlog activ.

Logica de construcție a catalogului: pornim de la **cine are nevoie de protecție și de ce**, nu de la ce știe firma să facă. Fiecare serviciu răspunde unei frici sau nevoi concrete, deja articulate în piață.

---

## VALUL 1 — MVP (activ acum, singurul construit)

| Serviciu | Nevoia clientului | Esența | Status |
|---|---|---|---|
| **Shield (gratuit)** | „Vreau să mă simt în siguranță mereu" | SOS → dispecerat real, Walk With Me (check-in cu timer), partajare locație cu cercul de încredere, apel fals de urgență. Gratuit = motor de adopție. | MVP — activare publică doar după M6, condiționată de dispecerat 24/7 rodat |
| **Protect Ride** | „Să ajung în siguranță din A în B" | Vehicul PROTEGO cu agent-șofer atestat SAU vehiculul clientului (consimțământ + checklist foto + asigurare). Cod unic de verificare a misiunii, tracking live, SOS. | MVP |
| **Escortă (1–2h)** | „Cineva lângă mine la un moment cu risc" | Însoțire pe jos sau cu vehicul: întâlniri OLX, bancomat, ieșire din club, dating, custodie tensionată. | MVP |
| **Protecție cu ora (2h+)** | „Protecție pe o perioadă" | Agent/echipă dedicată, recomandare automată a numărului de agenți, overage cu acord explicit în aplicație. | MVP |

*Specificație de brand confirmată (MASTERPROMPT v2.1 §2, decizia #10):* vehiculul PROTEGO este definit la nivel de brand ca „vehicul negru, categorie premium/SUV"; flota exactă (mărci/modele) se stabilește la pilot, cu vehiculele reale ale firmei. „SUV negru" din prototip reprezintă direcția vizuală, nu o obligație de flotă.

Prețurile tuturor serviciilor din Valul 1 sunt **configurabile din admin**, fără nicio valoare hardcodată în produs. Valorile demo folosite doar pentru pilot/testare: 180 lei/h/agent, 60 lei/h vehicul, 20 lei taxă platformă (vezi `business-rules.md`).

---

## VALUL 2 — Recurent & consumer (2–4 luni după pilot)

- **Trusted Meet** — agentul ca gardian verificat al oricărei întâlniri riscante (vânzări auto/imobiliare, tranzacții P2P mari, dating). Include verificarea identității ambelor părți. Nu există un echivalent direct pe piața din România.
- **Drum Sigur** (abonament pentru siguranța femeilor) — curse nocturne incluse, opțiune agent femeie, prioritate la dispecerat, partajare permanentă a locației cu o persoană de încredere. Include și un buton dedicat „mă simt urmărită" → escortă rapidă (detaliu draft v1.1).
- **PROTEGO Kids** — transport școlar recurent: agenți cu verificare extinsă (cazier + evaluare psihologică + istoric misiuni impecabil), același agent pentru același copil, cod de siguranță cunoscut de copil, confirmare foto la predare/preluare.
- **PROTEGO Senior** — însoțire vârstnici (medic, bancă, pensie, cumpărături), plătit adesea din diaspora (interfață EN + card străin), raport foto/text către plătitor la final.
- **PROTEGO Events (echipe)** — 2–10 agenți cu șef de echipă pentru evenimente private/corporate; cerere de ofertă pentru echipe de 10+.

## VALUL 3 — Verticalele Night & Cargo (4–8 luni)

### PROTEGO Night (petreceri & viață de noapte)
- **Gardianul Serii** — un grup (3–8 prieteni) rezervă un agent pentru toată seara, care îi însoțește între locații. **Plată împărțită automat între membrii grupului** (split payment în aplicație, prin Stripe). Mecanismul UX exact al split-ului (cine inițiază, împărțire egală vs. custom, moment de preautorizare) e o decizie de design deschisă — vezi `open-decisions.md`.
- **Pachete petreceri** — burlăcițe/burlaci, majorate, aniversări: agent + vehicul + traseu planificat.
- **Parteneriate cluburi/localuri** — „PROTEGO Point" la ieșire: cod QR pentru cursă securizată imediată; clubul oferă siguranța ca beneficiu clienților.
- **Petreceri private & festivaluri** — echipe cu brief, acces control, coordonare cu organizatorul.

### PROTEGO Cargo (transport de bunuri)
- **Secure Delivery** — colete valoroase cu chain of custody: sigiliu numerotat, foto la preluare, OTP + semnătură la predare, valoare declarată, asigurare. **Strict sub plafoanele legale pentru transport de valori** — peste plafon e nevoie de licență dedicată, care NU se construiește în această fază.
- **Partener de livrare premium** — bijuterii, ceasuri, electronice scumpe, artă: magazinele oferă „livrare PROTEGO" la checkout.
- **Documente sensibile** — notariale, juridice, licitații: trasee cu dovadă completă.
- **Predare garantată P2P** — la vânzări între persoane (telefoane, ceasuri, biciclete scumpe): agentul verifică produsul și banii, ambele părți confirmă în aplicație. Combinat cu Trusted Meet = infrastructura de încredere a economiei second-hand.
- **Trasee recurente B2B** — plicuri/colete între sedii, pe abonament.

> **Notă de versiune (v1.1 → v2):** în draftul v1.1, Secure Delivery apărea în Valul 2. MASTERPROMPT v2 îl mută explicit în Valul 3, ca parte a verticalei Cargo. **v2 este sursa de adevăr** — acest document reflectă poziționarea din v2.

## VALUL 4 — Corporate, premium & platformă (8–18 luni)

- **PROTEGO Business** — cont companie, centre de cost, facturare lunară, beneficiu HR (angajate care pleacă târziu).
- **Abonamente Familie/Dedicat** — gardă personală recurentă administrată din aplicație.
- **PROTEGO Residence** — verificări programate la domiciliu, doar în limitele licenței proprii; **intervenția la alarmă necesită licență de monitorizare/intervenție**, deci se lansează doar direct (dacă licența acoperă) sau printr-un partener licențiat pe monitorizare.
- **VIP & Executive** — motorcade, advance planning, agent shadow discret; cerere de ofertă cu consultant, nu self-service.
- **Hotel & Venue Partners** — rezervare din recepție, comision pentru locație.
- **PROTEGO Partner (marketplace)** — firme de pază licențiate se afiliază (licență + asigurare + agenți), primesc misiuni în zonele lor, comision PROTEGO 15–25%. Motorul expansiunii naționale, apoi UE.
- **API Safety-as-a-Service** — butonul PROTEGO integrat în aplicații terțe (dating, imobiliare, marketplace-uri, bănci pentru retrageri mari). PROTEGO devine infrastructură, nu doar aplicație.
- **Academia PROTEGO** — recrutare + atestare foști militari/polițiști/civili; canal de supply + venit + control calitate.

---

## Reguli de menținere a acestui document

- Fiecare serviciu nou propus trebuie încadrat explicit într-un val, cu justificare de dependență (ce infrastructură de val anterior presupune).
- Niciun preț nu se hardcodează aici sau în produs — toate valorile sunt exemple sau valori demo, configurabile din admin.
- Orice serviciu cu implicații de licențiere neclare (transport valori peste plafon, monitorizare/alarme, split-payment) este semnalat și în `docs/legal/compliance-checklist.md` / `docs/legal/questions-for-lawyer.md`.
