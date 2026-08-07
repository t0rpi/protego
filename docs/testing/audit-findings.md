# PROTEGO — Audit Findings (2026-08-05)

**Scope:** M1–M7 acceptance criteria from `docs/testing/acceptance-tests.md`, checked against the actual current codebase (migrations, edge functions, mobile app) as of commit `980e33b`. **Method:** direct code/schema inspection with file:line evidence for every claim — not a rubber-stamp pass, and not a live-device E2E run (that distinction is called out per finding below). Findings are reported here, not silently patched — triage and fix decisions are the founder's.

**Severity scale:** Critical (data loss / security / money) · High (breaks a core flow) · Medium (real gap, no immediate breakage) · Low (polish / observability).

---

## Findings

### F1 — MEDIUM — Failed payment capture on mission completion has no alert path
**Area:** M5 payments, `apps/mobile/app/(agent)/mission/[missionId]/index.tsx:271-275`

`complete_mission()` correctly computes and persists the final capture amount server-side. The agent app then calls `captureMissionPayment()` to actually tell Stripe to capture — but a failure there is only `console.error`'d, with a code comment noting "the capture can be retried from the admin payments screen." Nothing pushes a notification to the dispatcher/admin, and nothing marks the mission as needing attention. If nobody proactively opens the admin payments screen after every mission, a failed capture can go unnoticed indefinitely — real revenue at risk, not a cosmetic issue.

**Recommendation:** at minimum, insert a `notification_log`/dispatcher-visible flag (or a `payments.status = 'capture_failed'` filter already surfaced on the admin payments list) when this call fails, so it's not purely opt-in discovery.

### F2 — LOW — Shield's "M4/M5 must be validated first" gate is an admin toggle, not a system check
**Area:** M6, `supabase/migrations/20260731140002_shield_public_gate.sql:19`

The acceptance test reads: *"Shield NU a fost încă validat pe M4–M5 → activarea este blocată — condiția de poartă e obligatorie, nu opțională."* The actual implementation is a single boolean config row (`shield_public_enabled`) an admin flips manually — the migration's own comment says so explicitly: *"an admin decision, never a code condition."* There is no structural check anywhere that M4/M5 have actually been validated on paid traffic before that flag can be set to true.

This may be intentional scope (a human gate is still a gate) — flagging because the acceptance test's literal wording ("obligatorie, nu opțională") reads as wanting a system-enforced precondition, which doesn't exist. Founder call on whether this is acceptable as-is.

### F3 — MEDIUM — Local pgTAP regression suite has not run green end-to-end recently
**Area:** process/coverage, all milestones

The repo has 30 pgTAP test files (`supabase/tests/database/`) covering RLS and business logic across every milestone. During this session, the local Docker-in-WSL stack repeatedly failed to come up healthy (containers unhealthy after `kong`/`edge-runtime` health-check timeouts, traced to unusually high in-WSL network latency — an environment issue, not a code issue). The newest features (v2.4 pricing, chained rides) were instead verified correct via direct RPC calls against the live linked Supabase project, matching hand-calculated expected values exactly — solid verification for those specific features, but **not equivalent to a full regression run**, so an unrelated regression in older RLS policies from this session's schema changes would not have been caught automatically.

**Recommendation:** get the local pgTAP stack healthy (or run it via CI/GitHub Actions against a fresh Postgres, sidestepping the local Docker/WSL networking issue entirely) and confirm all 30 files pass before the pilot launch checklist is signed off.

### F4 — LOW — Agent-preference selector still shows "Indiferent"/"Male" chips
**Area:** M2 booking UI, `apps/mobile/app/(client)/booking/[service].tsx:687`

Not a regression — this is exactly what was asked for on 2026-08-03 (remove only the "female" option; "any"/"male" stay, per the code comment: *"Stays in the data model... comes back with Drum Sigur in Wave 2"*). Flagging only because the founder's most recent message described this as unexpected ("Indiferent button still visible"). If the intent has changed to removing the whole preference selector (always book with no preference), that's a new decision, not a bug fix — needs an explicit call before touching it.

---

## Verified — no issues found (evidence-based)

| # | Criterion (paraphrased) | Evidence |
|---|---|---|
| M1 | Level-1 client blocked from confirming a mission until verification level 2 | `missions.sql:149`, `mission_transitions_agent.sql:60/88`, `high_risk_call_gate_and_handover.sql:66/94`, `payments.sql:180/211` — `coalesce(v_verification_level,1) < 2` checked server-side at every confirm-adjacent transition |
| M1 | RLS isolates agents/clients from each other's data | Enforced by the 30-file pgTAP suite's own design (see F3 for current run-status caveat) |
| M2 | Price breakdown always componentized, never a hardcoded opaque total | `compute_quote()`/`compute_segment_quote()` read `pricing_config` live; no price constant anywhere in `packages/domain` or the SQL functions (explicit project rule, verified by design throughout this session's work) |
| M2 | High-risk questionnaire blocks auto-confirm, routes to review queue | `missions.sql:138-146` — `quoted→confirmed` rejected when `risk_level='high'`; only `quoted→review` is allowed for that state |
| M2 | `client_vehicle` mobility blocks payment step without consent+insurance+signature | `missions.sql:153-165` |
| M2 | Admin price change reflects immediately, no deploy needed | `compute_quote()` queries `pricing_config` on every call, no caching layer |
| M3 | Agent status can't skip straight to "active" | `agents_extensions.sql:98-109` — transition guard only allows `in_review→approved/blocked`, `approved→active/blocked`, `active→blocked`, `blocked→approved` |
| M3 | Expired agent document blocks new mission offers automatically | `agent_has_no_expired_documents()` checked in `mission_offers.sql`'s `create_mission_offer()` |
| M3 | client_vehicle missions can't start without the 6-photo checklist | Enforced twice (defense-in-depth): trigger at `mission_transitions_agent.sql:146-151` AND inside `start_mission_protection()` at line 327-332 |
| M4 | Live location visible ONLY to the mission's own client, ONLY during enroute/arrived/active | `mission_tracking.sql:31-41`, re-checked per-query (not just at write time), matching the acceptance test's literal wording (the migration's own comment quotes it) |
| M4 | Dispatcher mission assignment requires explicit action, not auto-assign | Ranking logic lives in `packages/domain/src/dispatch/ranking.ts` (produces sorted *suggestions*); assignment itself is a separate dispatcher-initiated call |
| M5 | Mission confirm creates a preauth hold, not an immediate capture | Stripe `capture_method: "manual"` used throughout (`authorize-mission-payment`, `create-overage-payment`, `create-segment-payment`) |
| M5 | Mission overage never re-preauthorizes without explicit client confirmation | `OverageButton`'s `requestOverage()` only fires on `onPress` — no automatic trigger anywhere in the codebase |
| M5 | Free-window cancellation releases the hold in full | `cancel_mission_by_client()` in `payments.sql:376+`, gated on `scheduled_at - now() >= free_cancel_minutes` (config-driven, not hardcoded) |

## Not verified in this pass (needs live device/runtime testing, not just code inspection)

- **SOS → dispatcher console latency** ("alerta ajunge instant") — the pipeline exists (`sos_alerts` + Realtime), but "instant" is a timing claim that needs an actual stopwatch test on a real device, not code review.
- **Walk With Me timer → actual escalation firing** — `extend_walk_with_me()`/the grace-window logic exists; whether the escalation notification actually reaches the trusted circle in practice wasn't re-tested this pass.
- **Full M7 E2E flow for Escort and Hourly services** — this session's real-device testing was concentrated on Protect Ride (booking, chained rides, GPS, tracking). Escort/Hourly's booking→completion→rating flow hasn't been walked end-to-end on-device recently.
- **Agent-side E2E** (offer → accept → brief → checklist → in-progress → completion → earnings) — not re-walked on a real device this session; only specific pieces (checklist gating, completion→capture chaining) were verified via code.
- **45-second offer expiry timing** — the mechanism exists (`mission_offers.sql`, server-side expiry job from M4), but the actual 45s duration wasn't stopwatched against a live offer.

---

## Delta pass — 2026-08-07

**Scope:** everything the 2026-08-05 pass above did not cover — commits `f4d2046` through `c51d143` (the auth-lockout fix, plus the founder's dispatcher+client QA round: high-risk approval → client notification, GPS prefill re-arm, GPS enable prompt, dispatcher console clock/timestamps/detail/roster/alerts, pull-to-refresh). Same method: direct code inspection with file:line evidence, findings reported not silently patched. This is the gate check before Pass B.

### F5 — MEDIUM — A client who closes the app while a high-risk mission is "in review" has no way back to it once confirmed
**Area:** `apps/mobile/app/(client)/booking/[service].tsx:213-226`, `apps/mobile/app/(client)/(tabs)/index.tsx`

The new poll in the booking wizard's "result" step (fixing the founder's "no push/status update on the phone" report) only runs while that screen stays mounted. If the client force-quits or backgrounds the app for long enough to get evicted while the mission sits in `review`, and a dispatcher confirms it in the meantime, there is nothing that routes the client back to `/mission/[missionId]` on next open — Home (`(tabs)/index.tsx`) has no "you have a mission in progress" banner, and History (`(tabs)/history.tsx`) only lists `status = 'done'` missions. The client would have to already know the URL, which they don't. This narrows the gap the fix was meant to close (it works reliably as long as the app stays open) rather than closing it completely.

**Recommendation:** Home should check for an active/review mission for the current client on load and surface a "continue to your mission" card, the same way it already checks `profile.role`.

### F6 — LOW — GPS prefill can re-trigger while a client is mid-edit clearing the pickup field
**Area:** `apps/mobile/app/(client)/booking/[service].tsx:328-334`

The `useFocusEffect` added to re-arm the GPS prefill on every booking entry resets `gpsStatus` to `"idle"` whenever `pickupAddress` is empty — and it re-evaluates on every keystroke, not just on a real screen-focus event, because its memoized callback's identity depends on `pickupAddress`. A client who backspaces the pickup field down to empty (meaning to type a different address) will trigger a fresh GPS lookup mid-edit, which can silently refill the field with their device's current coordinates a moment later — overwriting what they were about to type. Recoverable (they can just edit again) but a real, reproducible surprise directly caused by this fix.

**Recommendation:** track "client explicitly cleared the field" (e.g. a ref set on manual `onChangeText`) separately from "field is empty because nothing has loaded yet," and skip the reset in the former case.

### F7 — MEDIUM — Declining the Android "enable location" prompt still forces the client into Settings
**Area:** `apps/mobile/lib/gps-location.ts` (`promptEnableLocation`)

`Location.enableNetworkProviderAsync()` rejects both when the user taps "No thanks" on the native dialog and when the device/OS doesn't support it. The current code catches both cases identically and falls through to `Linking.openSettings()` — so a client who deliberately declines the location prompt is immediately redirected into their phone's Settings app anyway, every time they refocus the field. This reads as the app overriding a clear "no."

**Recommendation:** distinguish user-declined (stop there, respect the choice, let them type manually) from unsupported/errored (fall back to Settings) — `enableNetworkProviderAsync()`'s rejection doesn't currently carry enough information to tell them apart, so this needs either a different API call or accepting a single fallback behavior deliberately rather than by accident.

### F8 — MEDIUM — Dispatcher console's audible alert can be silently blocked by the browser's autoplay policy
**Area:** `apps/web/app/(dispatcher)/dispatcher/console/console-client.tsx:23-48` (`playAlertBeep`)

Most browsers keep a fresh `AudioContext` in a `"suspended"` state until the page has registered a user gesture (click, keypress). `playAlertBeep()` never checks `ctx.state` or calls `ctx.resume()`, so if a new SOS or mission arrives via the 5s/8s poll before the dispatcher has clicked anywhere on the page — plausible right after the console loads at shift start — the alert can fire with no audible result and no visual indicator that it "should have" played. This directly undercuts the point of the feature (F5-equivalent risk: the one alert dispatchers are meant to rely on when not staring at the screen).

**Recommendation:** call `ctx.resume()` before scheduling the oscillators and check `ctx.state === "running"` afterward; if it's still suspended, show a visible "🔇 click anywhere to enable alert sounds" banner rather than failing silently.

### Minor, not severity-tracked
- `playAlertBeep()` (same location as F8) creates a new `AudioContext` on every call and never closes it — harmless for a short test session, worth a `ctx.close()` after the beep finishes for a console left open a full shift.
- The `create_mission_offer` RPC (`supabase/migrations/20260731110002_mission_offers.sql:83-85`) does already reject an offer to a since-become-unavailable agent server-side, so the new agent dropdown's client-side "disponibil/ocupat" state going briefly stale between polls (Dispatcher-4) is not a real gap — checked specifically because it looked like one; confirmed safe.

---

*Compiled 2026-08-05, in direct response to the founder's post-overnight-crash instruction: "the QA audit pass producing docs/testing/audit-findings.md (severity list, no silent fixes)." Delta pass compiled 2026-08-07 against commits `f4d2046`..`c51d143`, per explicit instruction: "targeted delta pass... give me the COMPLETE picture for triage." Nothing in either pass was changed as part of writing this document — F1-F8 are reported for triage, not applied.*
