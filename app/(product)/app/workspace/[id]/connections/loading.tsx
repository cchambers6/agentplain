import { ApRootedLoader } from "@/components/ui/ap";

// Route-level loading state for the Connections hub. The hub does live DB
// work (credential counts, marketplace filtering, recommendations) before it
// can render, and a click that gives zero feedback reads as broken to a
// first-time user (audit 2026-07-02 shell finding F1). Copy per the audit's
// written line; hairline strip per design language §1.5 — no spinner.

export default function ConnectionsLoading() {
  return (
    <div className="py-10">
      <ApRootedLoader label="Reading your connected tools…" />
    </div>
  );
}
