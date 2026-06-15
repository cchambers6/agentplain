// "Connections" tab (J3 — "What can Plaino do + is it wired in?"). In Phase A
// of the 5-tab IA this aliases the existing /integrations surface so the
// customer-vocab URL renders today. Phase B folds in the marketplace, the
// agent roster, and the discipline activation toggle. /integrations stays
// reachable until Phase C.
//
// Route segment config is declared here (not re-exported) — Next.js only
// recognizes `dynamic`/`runtime` when assigned to a string literal in the
// page module itself, so re-exporting them silently falls back to defaults.
export { default } from "../integrations/page";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
