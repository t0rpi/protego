export type ContextKind = "usual" | "stranger" | "atm" | "club";
export type RiskLevel = "normal" | "high";

export interface ContextQuestionnaireAnswers {
  hasKnownThreat: boolean;
  contextKind: ContextKind;
}

/**
 * The 2-3 question context questionnaire (MASTERPROMPT §5A step 7;
 * business-rules.md §6): "dacă răspunsurile indică o amenințare
 * cunoscută [...] rutează misiunea către coada de risc ridicat" — the
 * literal, singular criterion given in the source docs is a known
 * threat. `contextKind` (drum obișnuit / întâlnire cu necunoscut /
 * retragere numerar / ieșire din club) is framed there as helping
 * "trimitem agentul potrivit" — agent-selection/routing information for
 * the brief, not a second independent risk trigger — so it does not by
 * itself flip risk to 'high' here. This is an interpretation call where
 * the source docs don't give a full decision table; flagged as such in
 * docs/architecture/repository-audit.md's M2 notes.
 *
 * Mirrored server-side by missions.derive_mission_risk_level() —
 * supabase/migrations/20260731100003_missions.sql — which recomputes
 * this from the raw answers on every write, so a client can never
 * submit risk_level='normal' while admitting hasKnownThreat=true.
 */
export function computeRiskLevel(answers: ContextQuestionnaireAnswers): RiskLevel {
  return answers.hasKnownThreat ? "high" : "normal";
}
