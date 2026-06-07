// /operator/fleet/media — internal media-discipline activity surface.
//
// The media fleet is agentplain's OWN go-to-market creative + platform org (see
// lib/fleet/roster.ts + docs/fleet/media-discipline-2026-06-06.md). It is NOT a
// customer-sellable discipline — it is the production + platform-execution ARM
// of the `marketing` discipline. This panel makes that internal fleet
// observable without contaminating the locked customer disciplines surface.
//
// Gate: lives under app/(operator)/layout.tsx which redirects non-operators to
// /app; we re-assert isOperator here for defense in depth (same pattern the
// sibling /operator/fleet page follows).
//
// Data sourcing per feedback_no_guesses_no_estimates.md:
//   - org chart + reporting lines → real (lib/fleet/roster.ts)
//   - standing crons + schedules  → real (lib/fleet/roster.ts MEDIA_CRONS,
//                                    same strings the Inngest fns register)
//   - per-agent activity          → NOT YET REAL. The media crons ship as honest
//                                    stubs (no media-fleet activity table exists),
//                                    so the activity section shows a labelled
//                                    "wires up when the runner lands" state — no
//                                    fabricated metrics, mirroring b2b-ceo-daily.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ApEyebrow, ApPaperCard, PlainoAvatar } from "@/components/ui/ap";
import { requireUser } from "@/lib/auth/server";
import {
  listMediaByTier,
  listMediaCrons,
  getMediaAgent,
  type MediaAgent,
  type MediaTier,
} from "@/lib/fleet/roster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIER_LABEL: Record<MediaTier, string> = {
  leadership: "Leadership · Class B",
  platform: "Platform specialists · Class C",
  creative: "Creative production · Class C",
};

const TIER_BLURB: Record<MediaTier, string> = {
  leadership:
    "Owns strategy, brand expression, and budget allocation. Final approver before work reaches Conner.",
  platform:
    "One specialist per platform — owns ads-manager planning, audiences, and algorithm-fit organic. Plans only; no spend.",
  creative:
    "Turns the message into films, statics, copy, voice, and the earned-media + attribution work behind it.",
};

function reportsToName(agent: MediaAgent): string {
  if (agent.reportsTo === "b2b-ceo") return "CEO tier (b2b-ceo) → Conner";
  return getMediaAgent(agent.reportsTo)?.name ?? agent.reportsTo;
}

export default async function OperatorMediaFleetPage() {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }

  const leadership = listMediaByTier("leadership");
  const platform = listMediaByTier("platform");
  const creative = listMediaByTier("creative");
  const crons = listMediaCrons();
  const totalAgents = leadership.length + platform.length + creative.length;

  return (
    <div className="container-wide space-y-12 py-10">
      <header className="border-b border-rule pb-6">
        <ApEyebrow>operator · media discipline</ApEyebrow>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
          The fleet that makes the work.
        </h1>
        <p className="mt-3 flex max-w-2xl items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
          <PlainoAvatar size="md" className="shrink-0" />
          <span>
            agentplain&rsquo;s own creative + platform org — from ad concept to
            live-campaign plan to reporting. It is the production and
            platform-execution arm of the <strong>marketing</strong> discipline,
            not a customer-sellable discipline of its own. Every agent drafts and
            proposes; Conner executes any paid placement.
          </span>
        </p>
        <p className="mt-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          <Link href="/operator/fleet" className="hover:text-ink">
            ← cross-vertical fleet
          </Link>
        </p>
      </header>

      <section aria-labelledby="media-totals-heading" className="space-y-4">
        <ApEyebrow id="media-totals-heading">discipline · totals</ApEyebrow>
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="media agents" value={totalAgents.toString()} />
          <Stat label="leadership · class B" value={leadership.length.toString()} />
          <Stat label="specialists · class C" value={(platform.length + creative.length).toString()} />
          <Stat
            label="standing crons"
            value={crons.length.toString()}
            hint="stubs awaiting runner port"
          />
        </div>
      </section>

      <TierSection tier="leadership" agents={leadership} />
      <TierSection tier="platform" agents={platform} />
      <TierSection tier="creative" agents={creative} />

      <section aria-labelledby="crons-heading" className="space-y-4">
        <header>
          <ApEyebrow id="crons-heading">standing work</ApEyebrow>
          <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">
            The cadence the fleet runs.
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            Three Inngest crons, registered and observable. They ship as honest
            stubs — they cost zero Anthropic tokens until the CronDefinition
            runner lands (the same port the b2b-* crons wait on). Schedules are
            real; nothing publishes or spends.
          </p>
        </header>
        <ul className="divide-y divide-rule border border-rule bg-paper">
          {crons.map((c) => {
            const owner = getMediaAgent(c.ownerSlug);
            return (
              <li key={c.functionId} className="px-4 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-display text-lg text-ink">{c.name}</p>
                  <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                    {c.cadence}
                  </p>
                </div>
                <p className="mt-1 font-mono text-[11px] text-mute">
                  {c.functionId} · cron <code className="text-ink">{c.cron}</code>
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                  {c.drafts}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-mute">
                  owned by{" "}
                  <span className="font-mono text-ink">{owner?.name ?? c.ownerSlug}</span>
                  {c.contributorSlugs.length > 0 ? (
                    <>
                      {" "}· fed by{" "}
                      {c.contributorSlugs
                        .map((s) => getMediaAgent(s)?.name ?? s)
                        .join(", ")}
                    </>
                  ) : null}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="cascade-heading" className="space-y-4">
        <ApEyebrow id="cascade-heading">approval cascade</ApEyebrow>
        <ApPaperCard density="default">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            Work climbs the chain before any dollar is spent or any pixel ships:
          </p>
          <ol className="mt-3 space-y-1 text-[14px] leading-relaxed text-ink">
            <li>
              <span className="font-mono text-[11px] text-mute">1 ·</span>{" "}
              <strong>Specialist</strong> drafts the asset / plan (Class C).
            </li>
            <li>
              <span className="font-mono text-[11px] text-mute">2 ·</span>{" "}
              <strong>Creative Director</strong> reviews every asset for brand
              expression; <strong>Media Director</strong> reviews every plan +
              budget split (Class B).
            </li>
            <li>
              <span className="font-mono text-[11px] text-mute">3 ·</span>{" "}
              <strong>Head of Media</strong> greenlights the campaign.
            </li>
            <li>
              <span className="font-mono text-[11px] text-mute">4 ·</span>{" "}
              <strong>CEO tier → Conner</strong> approves spend. Paid placement
              is executed by Conner (or the customer&rsquo;s system) — never by an
              agent.
            </li>
          </ol>
        </ApPaperCard>
      </section>

      <section aria-labelledby="activity-heading" className="space-y-4">
        <ApEyebrow id="activity-heading">discipline · activity</ApEyebrow>
        <div className="border border-dashed border-rule bg-paper p-6 text-[13px] leading-relaxed text-mute">
          No media-fleet activity yet. The crons above register and fire on
          schedule, but they record no work until the CronDefinition runner port
          + a media-fleet activity table land (tracked alongside the b2b-* runner
          port). When that ships, drafted reviews, digests, and plans will appear
          here and in the cross-vertical{" "}
          <Link href="/operator/fleet" className="underline-offset-2 hover:text-ink hover:underline">
            fleet feed
          </Link>
          . No fabricated numbers until then.
        </div>
      </section>

      <footer className="border-t border-rule pt-6 text-[12px] leading-relaxed text-mute">
        <p>
          Owner-only surface (operator gate at{" "}
          <code className="font-mono">app/(operator)/layout.tsx</code> ·{" "}
          <code className="font-mono">requireUser().isOperator</code>). Roster is
          read-only here — edit{" "}
          <code className="font-mono">lib/fleet/roster.ts</code> to change agents
          or reporting lines; agent definitions live in{" "}
          <code className="font-mono">~/.claude/skills/media-*</code>.
        </p>
      </footer>
    </div>
  );
}

function TierSection({
  tier,
  agents,
}: {
  tier: MediaTier;
  agents: readonly MediaAgent[];
}) {
  return (
    <section aria-label={TIER_LABEL[tier]} className="space-y-4">
      <header>
        <ApEyebrow>{TIER_LABEL[tier]}</ApEyebrow>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
          {TIER_BLURB[tier]}
        </p>
      </header>
      <ul className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <li key={a.slug}>
            <AgentCard agent={a} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgentCard({ agent }: { agent: MediaAgent }) {
  return (
    <div className="h-full bg-paper p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          {agent.slug}
        </p>
        <span className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          {agent.recommendedModel}
        </span>
      </div>
      <p className="mt-2 font-display text-lg leading-tight text-ink">
        {agent.name}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
        {agent.role}
      </p>
      <p className="mt-3 font-mono text-[11px] text-mute">
        reports to {reportsToName(agent)}
      </p>
      <div className="mt-3">
        <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
          owns
        </p>
        <ul className="mt-1 space-y-0.5 text-[12px] leading-relaxed text-ink-soft">
          {agent.ownedOutputs.map((o) => (
            <li key={o}>· {o}</li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-mute">
        <span className="font-mono uppercase tracking-eyebrow">tools</span>{" "}
        {agent.primaryTools.join(" · ")}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ApPaperCard density="dense" className="border-0">
      <p className="font-mono text-[10px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl leading-none text-ink">{value}</p>
      {hint ? (
        <p className="mt-2 text-[12px] leading-relaxed text-mute">{hint}</p>
      ) : null}
    </ApPaperCard>
  );
}
