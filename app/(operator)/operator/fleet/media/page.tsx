// /operator/fleet/media — the Media discipline (distribution) activity surface.
//
// Media is agentplain's OWN distribution org: it routes finished creative to
// audiences — buys, earns, and measures placement. It is the peer of the
// Creative discipline (which MAKES the work — see /operator/fleet/creative).
// Both are arms of the `marketing` customer discipline, not customer-sellable
// disciplines of their own. This panel makes the Media arm observable without
// contaminating the locked customer disciplines surface.
//
// Gate: lives under app/(operator)/layout.tsx which redirects non-operators to
// /app; we re-assert isOperator here for defense in depth.
//
// Data sourcing per feedback_no_guesses_no_estimates.md:
//   - org chart + reporting lines → real (lib/fleet/roster.ts, Media arm)
//   - standing crons + schedules  → real (lib/fleet/roster.ts listMediaCrons)
//   - per-agent activity          → NOT YET REAL. The crons ship as honest
//                                    stubs; the activity section shows a
//                                    labelled "wires up when the runner lands"
//                                    state — no fabricated metrics.

import Link from "next/link";
import { redirect } from "next/navigation";
import { ApEyebrow, ApPaperCard, PlainoStatus } from "@/components/ui/ap";
import { requireUser } from "@/lib/auth/server";
import {
  listMediaByTier,
  listMediaCrons,
  getFleetAgent,
  type FleetAgent,
  type FleetTier,
} from "@/lib/fleet/roster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIER_LABEL: Partial<Record<FleetTier, string>> = {
  leadership: "Leadership · Class B",
  platform: "Platform specialists · Class C",
  earned: "Earned + measurement · Class C",
};

const TIER_BLURB: Partial<Record<FleetTier, string>> = {
  leadership:
    "Owns distribution strategy, channel-budget allocation, and attribution. Final approver before media work reaches Conner.",
  platform:
    "One specialist per platform — owns ads-manager planning, audiences, and algorithm-fit organic. Plans only; no spend.",
  earned:
    "Influencer partnerships, PR / earned media, and the analytics + attribution that measures where every placement landed.",
};

function reportsToName(agent: FleetAgent): string {
  if (agent.reportsTo === "b2b-ceo") return "CEO tier (b2b-ceo) → Conner";
  return getFleetAgent(agent.reportsTo)?.name ?? agent.reportsTo;
}

export default async function OperatorMediaFleetPage() {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }

  const leadership = listMediaByTier("leadership");
  const platform = listMediaByTier("platform");
  const earned = listMediaByTier("earned");
  const crons = listMediaCrons();
  const totalAgents = leadership.length + platform.length + earned.length;

  return (
    <div className="container-wide space-y-12 py-10">
      <header className="border-b border-rule pb-6">
        <ApEyebrow>operator · media discipline</ApEyebrow>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
          The fleet that distributes the work.
        </h1>
        <p className="mt-3 flex max-w-2xl items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
          <PlainoStatus state="herd" size={32} className="shrink-0" />
          <span>
            agentplain&rsquo;s own distribution org — it takes finished creative
            and decides where, how, and when it runs: paid, earned, and measured.
            Media is the peer of the{" "}
            <Link href="/operator/fleet/creative" className="underline-offset-2 hover:text-ink hover:underline">
              Creative discipline
            </Link>{" "}
            that makes the work. Both are arms of the <strong>marketing</strong>{" "}
            discipline, not customer-sellable disciplines of their own. Every
            agent drafts and proposes; Conner executes any paid placement.
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
          <Stat label="specialists · class C" value={(platform.length + earned.length).toString()} />
          <Stat
            label="standing crons"
            value={crons.length.toString()}
            hint="stubs awaiting runner port"
          />
        </div>
      </section>

      <TierSection tier="leadership" agents={leadership} />
      <TierSection tier="platform" agents={platform} />
      <TierSection tier="earned" agents={earned} />

      <section aria-labelledby="crons-heading" className="space-y-4">
        <header>
          <ApEyebrow id="crons-heading">standing work</ApEyebrow>
          <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">
            The cadence the fleet runs.
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            Two Inngest crons, registered and observable. They ship as honest
            stubs — they cost zero Anthropic tokens until the CronDefinition
            runner lands (the same port the b2b-* crons wait on). Schedules are
            real; nothing publishes or spends.
          </p>
        </header>
        <ul className="divide-y divide-rule border border-rule bg-paper">
          {crons.map((c) => {
            const owner = getFleetAgent(c.ownerSlug);
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
                        .map((s) => getFleetAgent(s)?.name ?? s)
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
            A distribution plan climbs the chain before any dollar is spent:
          </p>
          <ol className="mt-3 space-y-1 text-[14px] leading-relaxed text-ink">
            <li>
              <span className="font-mono text-[11px] text-mute">1 ·</span>{" "}
              <strong>Specialist</strong> drafts the channel plan (Class C).
            </li>
            <li>
              <span className="font-mono text-[11px] text-mute">2 ·</span>{" "}
              <strong>Media Director</strong> reviews the plan + budget split
              (Class B).
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
          + a fleet activity table land (tracked alongside the b2b-* runner
          port). When that ships, drafted digests and plans will appear here and
          in the cross-vertical{" "}
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
  tier: FleetTier;
  agents: readonly FleetAgent[];
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
            <AgentCard agent={a} reportsTo={reportsToName(a)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AgentCard({ agent, reportsTo }: { agent: FleetAgent; reportsTo: string }) {
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
        reports to {reportsTo}
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
