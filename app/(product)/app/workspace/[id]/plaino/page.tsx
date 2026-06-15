// "Plaino" tab (J2 — "Let me talk to Plaino"). In Phase A of the 5-tab IA
// this aliases the existing /talk surface so the customer-vocab URL renders
// the full conversation experience today. Phase B folds in support chat,
// memory, and voice. The /talk route stays reachable until Phase C.
//
// Route segment config is declared here (not re-exported) — Next.js only
// recognizes `dynamic`/`runtime` when assigned to a string literal in the
// page module itself, so re-exporting them silently falls back to defaults.
export { default } from "../talk/page";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
