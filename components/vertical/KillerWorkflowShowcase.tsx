import Section from "@/components/Section";
import { verticalEnumFromSlug } from "@/lib/auth/vertical-enum";
import { totalSavedMinutes } from "@/lib/workflows/runtime";
import {
  killerWorkflowStoryFor,
  VERTICALS_WITH_STORY,
} from "@/lib/workflows/verticals";
import KillerWorkflowPlayer from "./KillerWorkflowPlayer";

// The named killer workflow, demoed live on the vertical landing page.
//
// Each live vertical has ONE canonical killer workflow (the registry in
// `lib/plaino/killer-workflow.ts` — locked headlines like "Every lead gets a
// first touch in 5 minutes"). Until now that promise only played inside the
// product; the landing page described value in prose. This section closes the
// gap: the SAME deterministic, LLM-free story the trial workspace plays
// (`lib/workflows/verticals/*`) runs right on the page — sample-data banner,
// step-by-step timing, calibrated saved-minute math and all. Because it reuses
// the product's own story + player, the marketing demo cannot overclaim: what
// the visitor watches here is what the trial shows on day one.
//
// Renders only for verticals with a bespoke authored story (the four live
// verticals). On-ramp and roadmap verticals return null rather than playing
// the general fallback story under a vertical-specific headline.
export default function KillerWorkflowShowcase({ slug }: { slug: string }) {
  const vertical = verticalEnumFromSlug(slug);
  if (!vertical || !VERTICALS_WITH_STORY.includes(vertical)) return null;

  const story = killerWorkflowStoryFor(vertical);
  const savedPerRun = totalSavedMinutes(story);

  return (
    <Section
      tone="deep"
      eyebrow="Watch it work"
      title={story.headline}
      intro={`This is the run a trial workspace plays on day one — the same steps, on sample data, before you connect a thing. One run like this saves about ${savedPerRun} minutes of hand work, and a trial typically catches ${story.runsPerTrial} of them. Nothing below is a mock; it is the product's own demo surface.`}
    >
      <div className="max-w-3xl border border-rule bg-paper p-6 md:p-8">
        <KillerWorkflowPlayer story={story} />
      </div>
    </Section>
  );
}
