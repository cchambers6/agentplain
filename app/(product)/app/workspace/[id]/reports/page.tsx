// "Reports" tab (J4 — "Did I get my money's worth + is everything safe?").
// In Phase A of the 5-tab IA this promotes the existing /reports/weekly value
// report to the /reports home so the tab URL renders today. Phase B folds in
// the compliance-assurance section and the spend-vs-value line.
//
// IMPORTANT: /reports/weekly stays as a real route — the Friday value email's
// one-click-unsubscribe targets its #email-preferences anchor. Do not remove
// it (see spec Appendix, load-bearing machinery #5).
export { default } from "./weekly/page";
