# PROTEGO — Fluxuri de utilizare (Client / Agent / Dispecerat)

**Sursă de adevăr:** `PROTEGO_MASTERPROMPT_v2.2.md` §5A–C. Acest document detaliază fluxurile happy-path și principalele cazuri de excepție (edge cases) pentru MVP. Nu descrie ecrane (vezi `PROTEGO Design`, prompt P3), ci logica de proces.

---

## 1. Flux Client — rezervare (happy path, 10 pași)

1. **Alege serviciul** — Protect Ride / Escortă / Protecție cu ora (Shield e mereu accesibil separat, tab permanent).
2. **Unde** — pickup (GPS/hartă/adresă); destinație la Protect Ride; locația misiunii la Escortă/Protecție cu ora.
3. **Când** — acum / programat (dată + oră).
4. **Cine e protejat** — client însuși sau o persoană salvată (copil, părinte etc.), număr de persoane.
5. **Echipa** — număr de agenți (cu recomandare automată pentru context), preferință de gen a agentului (unde disponibil), ținută (business formal / business casual / discret).
6. **Mobilitate** — vehicul PROTEGO / vehiculul clientului (cu consimțământ + checklist) / fără vehicul (pe jos).
7. **Chestionar scurt de context** (2–3 întrebări la serviciile cu risc) — dacă indică risc ridicat, misiunea e rutată către coada umană a dispeceratului, **fără confirmare automată**.
8. **Ofertă** — preț defalcat transparent + timp estimat de sosire.
9. **Plată** — preautorizare pe card (Stripe); (split payment doar la Night, post-MVP).
10. **Confirmare** — misiunea intră în coada dispeceratului pentru alocare agent.

### Misiunea activă
- Card agent vizibil clientului (poză, atestat, badge-uri, rating, vehicul).
- **Cod unic de verificare** — clientul îl cere agentului la sosire; dacă nu se potrivește, clientul apasă SOS.
- Tracking live + link de partajare a misiunii către cercul de încredere.
- Chat în aplicație + apel mascat (numerele nu se văd reciproc).
- SOS disponibil permanent.
- Statusuri: confirmat → agent pe drum → agent a ajuns → protecție activă → încheiat.
- Prelungire posibilă (overage, cu re-preautorizare — vezi `business-rules.md`).

### După misiune
- Rezumat + captură plată.
- Rating cu etichete + feedback text opțional.
- Raport PDF (unde e cazul) + factură automată pe email.
- Istoric + opțiune re-book cu un tap.

## 2. Edge cases — Client

| Situație | Comportament așteptat |
|---|---|
| Chestionarul de context indică risc ridicat | Misiunea nu se confirmă automat; intră în coada de risc ridicat a dispeceratului; clientul vede status „în verificare" cu mesaj explicativ, nu o eroare. |
| Clientul selectează „vehiculul meu" dar nu completează checklist-ul/asigurarea | Sistemul blochează trecerea la plată până la completarea integrală (consimțământ + foto + asigurare confirmată). |
| Codul de verificare nu se potrivește la sosirea agentului | Clientul este instruit explicit (în UI) să apese SOS; dispeceratul intervine imediat, inclusiv posibilă anulare/realocare. |
| Clientul cere prelungire (overage) | Cere confirmare explicită în aplicație înainte de orice re-preautorizare; fără confirmare, misiunea se încheie la ora programată. |
| Clientul anulează aproape de ora misiunii | Se aplică politica de anulare configurată (vezi `business-rules.md` — interval exact neconfirmat oficial). |
| Agentul alocat anulează/devine indisponibil | Reasignare automată în coada dispeceratului; clientul e notificat, fără cost suplimentar. |
| Client cu doar verificare nivel 1 (telefon) încearcă să confirme o misiune | Sistemul cere verificare nivel 2 (CI + selfie) înainte de a permite confirmarea primei misiuni. |

## 3. Flux Agent

1. **Disponibilitate on/off** — agentul își activează disponibilitatea din aplicație.
2. **Ofertă de misiune** — tip serviciu, zonă (adresa exactă doar după acceptare), durată estimată, câștig estimat. Fereastră de decizie: **45 secunde** accept/refuz.
3. **Brief misiune** — persoane protejate, preferințe client, cod de verificare, context (dacă a trecut prin coada de risc ridicat, agentul primește instrucțiuni suplimentare de la dispecerat).
4. **Navigație** — deep-link către Google Maps/Waze.
5. **Statusuri cu un tap** — plecat → ajuns → protecție începută → încheiat.
6. **Checklist vehicul client** (doar dacă misiunea folosește vehiculul clientului) — foto 360°, kilometraj, combustibil, semnătura clientului în aplicație.
7. **Raport de misiune ghidat** la final (~2 minute): evenimente, observații.
8. **Raport de incident** (separat, opțional dar prioritar) — foto/video, oră, martori — trimis instant dispeceratului.
9. **Buton de urgență agent** — disponibil permanent în timpul misiunii active.

### Edge cases — Agent
| Situație | Comportament așteptat |
|---|---|
| Agentul nu răspunde în 45 sec la ofertă | Oferta expiră automat, misiunea revine în coada dispeceratului pentru realocare. |
| Documentul agentului (ex. atestat) expiră în timp ce e activ | Alertă de reînnoire înainte de expirare; la expirare, agentul e blocat automat din alocări noi (nu doar avertizat). |
| Client refuză checklist-ul foto la vehiculul propriu | Agentul nu poate porni misiunea cu acel vehicul; se renegociază mobilitatea (vehicul PROTEGO sau pe jos) sau misiunea se anulează. |
| Agent apasă butonul de urgență | Alertă prioritară către dispecerat, tratată similar unui SOS — protocol în `docs/operations/dispatcher-playbook.md`. |

## 4. Flux Dispecerat

1. **Monitorizare hartă live** — toți agenții activi + misiunile în curs, cod de culori pe status.
2. **Coada de misiuni neasignate**, cu timer de așteptare.
3. **Asignare manuală**, cu sugestii ordonate (distanță, rating, badge-uri, vehicul disponibil).
4. **Reasignare** la refuz/anulare/incident.
5. **Consola SOS** (inclusiv alerte de la utilizatorii Shield gratuiți, nu doar misiuni plătite): alertă sonoră+vizuală, locație, apel cu un click către client/agent, protocol pas-cu-pas afișat, jurnalizare **obligatorie** a intervenției.
6. **Coada de risc ridicat** — confirmare exclusiv umană, niciodată automată.
7. **Verificare agenți** — coada de aplicații/documente Verified noi sau reînnoiri.
8. **Plăți** — vizualizare preautorizări, capturi, refund-uri, dispute (execuție tehnică prin Stripe, dar dispeceratul/adminul are vizibilitate operațională).
9. **Rapoarte operaționale** — misiuni/zi, timp mediu de răspuns, rating mediu, incidente.

### Edge cases — Dispecerat
| Situație | Comportament așteptat |
|---|---|
| SOS de la un utilizator Shield gratuit (fără misiune activă) | Tratat cu aceeași prioritate ca un SOS din misiune plătită — consola SOS nu face distincție de prioritate pe baza tipului de cont. |
| Misiune de risc ridicat fără agent disponibil potrivit | Dispecerul poate cere informații suplimentare clientului sau amâna alocarea — niciodată nu forțează o confirmare automată. |
| Chat monitorizat semnalează un risc (cuvinte-cheie, ton) | Dispecerul poate interveni proactiv (apel, verificare status) — proces manual în MVP, fără automatizare AI. |
| Incident raportat de agent în timpul misiunii | Jurnalizare obligatorie în `incidents`; dacă gravitatea o cere, dispecerul poate iniția protocolul SOS chiar dacă alerta n-a venit de la client. |

## 5. Protocolul SOS (rezumat — detaliu complet în `docs/operations/dispatcher-playbook.md`)

1. Alertă primită în consola SOS (sursă: Shield gratuit sau misiune plătită) cu locație atașată.
2. Dispecerul sună imediat persoana care a declanșat alerta.
3. Dispecerul urmează scriptul afișat pas-cu-pas (evaluare situație, liniștire, informații relevante).
4. Dacă situația o cere, dispecerul **poate îndruma/escalada către 112** — PROTEGO nu se substituie niciodată serviciului public de urgență, doar facilitează contactul și oferă context.
5. Jurnalizarea intervenției este **obligatorie**, indiferent de rezultat.

## Asumpții vs. decizii

Toate fluxurile de mai sus derivă direct din decizii închise ale MASTERPROMPT v2 §5. Singurele puncte cu valori neconfirmate explicit sunt: intervalul exact al ferestrei de decizie a agentului (45 sec — preluat consecvent din v1.1 și v2, tratat ca decizie confirmată), și pragurile de timp folosite ca KPI de dispecerat (propuneri, nu decizii — vezi `prd.md` §1).
