import { ApRootedLoader } from "@/components/ui/ap";

// Skill-settings loading fallback. Contextual copy — we're reading the
// per-skill config (follow-up, triage, scheduler) to render the cards.

export default function SkillsSettingsLoading() {
  return (
    <div>
      <ApRootedLoader label="Reading your skill settings…" />
    </div>
  );
}
