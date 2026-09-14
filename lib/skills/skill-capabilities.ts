/**
 * lib/skills/skill-capabilities.ts
 *
 * Sidecar map: catalog skill slug -> the runtime CAPABILITY a workspace
 * must actually hold before that skill can do its job.
 *
 * Deliberately a sidecar, mirroring `lib/disciplines/skill-mapping.ts`.
 * The alternative -- declaring the capability on each roster card in
 * `lib/verticals/<slug>/content.ts` -- would mean eleven near-identical
 * edits to customer-facing marketing content to express one engineering
 * fact, and eleven places for that fact to drift. A card's capability
 * follows from the skill it is bound to, not from the vertical it appears
 * on, so it belongs next to the skill.
 *
 * -- What a capability is, and what it is not --------------------------
 *
 * `liveRequires.connectors` already answers "does the workspace have an
 * ACTIVE credential for one of these providers?". A capability answers the
 * harder question the connector check cannot: "does that credential
 * actually grant the permission this skill needs?".
 *
 * The gap between those two questions is not hypothetical. Gmail and
 * Google Calendar ride the SAME `GOOGLE` IntegrationCredential row (see
 * `google-calendar-mcp/auth.ts`, which resolves the Gmail credential), and
 * `GOOGLE_DEFAULT_SCOPES` requests no calendar scope. So every
 * Gmail-connected workspace satisfied `connectors: ["GOOGLE","M365"]`,
 * the Chief of Staff card rendered LIVE, the sweep ran every fifteen
 * minutes, and `calendar.events.list` 403'd at Google. The card was
 * telling the customer a capability was working on the strength of a
 * credential that could not perform it.
 *
 * -- Rules for adding an entry -----------------------------------------
 *
 * 1. A capability MUST have a real, scope-level verifier behind it
 *    (`calendar` -> `lib/integrations/calendar-scope.ts`). A capability
 *    with no verifier is worse than none: it reads as a check and
 *    enforces nothing, which is the shape of every suppression whose
 *    justification quietly went wrong.
 * 2. Only add a skill here when the credential it rides can plausibly
 *    exist WITHOUT the permission it needs. If provider presence implies
 *    the permission, the connector check is already sufficient and an
 *    entry here is noise.
 *
 * Left out on purpose: the mailbox skills (`inbox-triage-general`,
 * `follow-up-chaser-general`, `process-doc-drafter-general`). They need
 * mail scope, and mail scope is exactly what both connect flows DO
 * request, so for them provider presence really does imply capability.
 */

/**
 * Capabilities a skill can require. Closed union -- see rule 1 above.
 */
export type SkillCapability = 'calendar';

export const SKILL_CAPABILITY: Readonly<Record<string, SkillCapability>> = {
  // Reads the operator's calendar window to find open slots. Needs a
  // calendar READ scope; a mail-only GOOGLE grant cannot serve it.
  'chief-of-staff-scheduler': 'calendar',
};

/**
 * The capability a skill requires, or null when provider presence is
 * sufficient.
 */
export function capabilityForSkill(
  skillSlug: string | undefined | null,
): SkillCapability | null {
  if (!skillSlug) return null;
  return SKILL_CAPABILITY[skillSlug] ?? null;
}
