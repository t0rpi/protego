# PROTEGO — Modelul de date (entități)

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §5E. Acest document listează entitățile și scopul lor funcțional — **nu** este schema SQL finală (aceasta se produce în auditul tehnic P4, `docs/architecture/repository-audit.md`, pe baza acestui document).

**Convenție de maturitate**, folosită mai jos pentru fiecare entitate:
- **MVP** — folosită activ din M1–M7, în producție la pilot.
- **Pregătită (future-ready)** — tabela există în schemă încă din fazele timpurii, dar rămâne neutilizată funcțional până la valul care o activează. Se creează devreme ca să nu necesite migrări breaking ulterior.

---

## 1. Entități MVP (active din pilot)

### `users`
Cont de bază pentru orice rol (client, agent, dispecer, admin). Rolul determină politica RLS aplicată.

### `protected_persons`
Persoane salvate de un client ca fiind „protejate" într-o misiune (el însuși, copil, părinte etc.) — necesar din MVP pentru rezervări „pentru altcineva".

### `agents`
Profilul agentului (Elite sau Verified — sursa se marchează ca atribut, vezi `supply-model.md`), plus:
- **`agent_documents`** (sau echivalent, subtabelă/relație) — atestat, cazier, CI, permis, cu **dată de expirare** și status (valid/expirat) → declanșează alertele de reînnoire și blocarea automată descrise în `supply-model.md`.

### `vehicles`
Vehicule PROTEGO și/sau vehicule ale clienților folosite într-o misiune (cu istoricul checklist-urilor foto asociate).

### `services`
Catalogul de servicii, cu atribut de **val** (1–4) și switch on/off **per oraș** — mecanismul prin care activarea valurilor viitoare devine configurare, nu cod nou.

### `missions`
**Coloana vertebrală a sistemului** — mașină de statusuri (state machine). Statusuri minime necesare (MVP): confirmat → agent alocat → agent pe drum → agent a ajuns → protecție activă → încheiat, plus stări terminale de anulare. Leagă: client, persoane protejate, agent(ți), vehicul, serviciu, ofertă, plată, rating, eventual incident.

### `quotes`
Oferta calculată pentru o misiune (defalcare pe componente de preț — vezi `business-rules.md`), înainte de confirmare. Rezultat al motorului de prețuri v1, configurabil din `services`/config admin, **fără valori hardcodate**.

### `payments`
Preautorizări, capturi, refund-uri, overage — legate de o misiune. Manual capture (Stripe) conform fluxului din `system-architecture.md`.

### `incidents`
Rapoarte de incident (agent sau client), cu foto/video, oră, martori — folosite atât operațional (dispecerat) cât și pentru conformitate/audit legal.

### `ratings`
Evaluarea agentului după misiune (scor + etichete + feedback text opțional).

### `shield_events`
Evenimente generate de nivelul Shield (gratuit): SOS, expirare Walk With Me fără confirmare, activare partajare locație de urgență, apel fals declanșat. **Notă importantă de succesiune:** deși Shield este parte a MVP-ului (§2.4 MASTERPROMPT), activarea lui publică e programată abia la M6 — deci `shield_events` se proiectează din schema inițială, dar devine activă funcțional doar din M6, nu din M1. Nu este „future-ready" în sensul Valurilor 2–4, ci „activată mai târziu în interiorul MVP-ului".

### `audit_log`
Jurnal complet — cine a făcut ce și când. Obligatoriu într-un business de securitate licențiat; acoperă acțiuni admin, dispecerat (inclusiv intervenții SOS), și evenimente critice de sistem.

## 2. Entități pregătite din schemă, dar neactive funcțional în MVP (future-ready, Valuri 2–4)

### `subscriptions`
Abonamente (Drum Sigur, Kids, Senior, Familie, Business) — Valul 2 (M8). Schema se pregătește devreme pentru a evita migrări breaking, dar nicio funcționalitate de abonament nu se construiește sau expune în UI înainte de M8.

### `groups`
Grupuri pentru split-payment Night („Gardianul Serii") — Valul 3 (M9). Mecanismul UX exact rămâne o decizie deschisă (`open-decisions.md` #6); schema se proiectează suficient de flexibil încât să nu blocheze acea decizie ulterioară.

### `partners`
Firme de pază licențiate afiliate (marketplace) — Valul 4 (M10). Include, conceptual: licență, asigurare, listă agenți, rată de comision (15–25%).

## 3. Relații-cheie (la nivel conceptual)

```
users ──< protected_persons
users ──< agents (rol agent) ──< agent_documents
users ──< missions >── agents
missions ──< quotes
missions ──< payments
missions ──< incidents
missions ──< ratings
missions >── vehicles
missions >── services
users(Shield) ──< shield_events
[toate acțiunile critice] ──> audit_log
(post-MVP) users ──< subscriptions
(post-MVP) missions >── groups (Night)
(post-MVP) missions >── partners (Valul 4)
```

## 4. Reguli RLS (rezumat — detaliu tehnic în audit P4)

- Client: acces doar la propriile `missions`, `payments`, `protected_persons`, `ratings` emise/primite.
- Agent: acces doar la `missions` alocate lui, `agent_documents` proprii.
- Dispecer: acces operațional la toate `missions` active/neasignate, `shield_events`, consola SOS.
- Admin: acces la `services`, configurare prețuri, `audit_log` complet, rapoarte financiare.
- Locația live a agentului (parte din `missions` sau tabelă dedicată de tracking): vizibilă clientului asociat **doar** cât misiunea e activă.

## 5. Ce nu se detaliază aici

Tipurile exacte de coloane, constrângerile SQL, indexurile și strategia de migrare aparțin auditului tehnic P4 (`docs/architecture/repository-audit.md`), care se produce **după** acest document și **înainte** de M0.
