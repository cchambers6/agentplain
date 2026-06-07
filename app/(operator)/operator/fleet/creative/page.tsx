// /operator/fleet/creative — the Creative discipline (production) activity surface.
//
// Creative is agentplain's OWN production org: it MAKES the work — an asset goes
// from brief to finished file. It is the peer of the Media discipline (which
// distributes the work — see /operator/fleet/media). Both are arms of the
// `marketing` customer discipline, not customer-sellable disciplines of their
// own. The discipline's spine is the creative-router ("ask first, improvise
// never"), which routes every request to the right tool or to a human via the
// CreatorBrief handoff (/operator/creative-briefs).
//
// Gate: lives under app/(operator)/layout.tsx which redirects non-operators to
// /app; we re-assert isOperator here for defense in depth.
//
// Data sourcing per feedback_no_guesses_no_estimates.md: org chart + crons are
// real (lib/fleet/roster.ts, Creative arm); per-agent activity is not yet real
// (the weekly creative review cron is an honest stub awaiting the runner port).

import Link from "next/link";
import { redirect } from "next/navigation";
import { ApEyebrow, ApPaperCard, PlainoAvatar } from "@/components/ui/ap";
import { requireUser } from "@/lib/auth/server";
import {
  listCreativeByTier,
  listCreativeCrons,
  getFleetAgent,
  type FleetAgent,
  type FleetTier,
} from "@/lib/fleet/roster";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIER_LABEL: Partial<Record<FleetTier, string>> = {
  leadership: "Leadership · Class B",
  production: "Production pool · Class C",
};

const TIER_BLURB: Partial<Record<FleetTier, string>> = {
  leadership:
    "Owns brand expression in every asset, sets production guardrails, and runs the acceptance review on human-creator deliveries. Peer to the Head of Media.",
  production:
    "The makers — video, static, long-form + direct-response copy, voice — plus the creative-router that picks the right tool for each job and hands brand-defining work to a human. Drafts only; nothing reaches distribution until the Creative Director signs it.",
};

function reportsToName(agent: FleetAgent): string {
  if (agent.reportsTo === "b2b-ceo") return "CEO tier (b2b-ceo) → Conner";
  return getFleetAgent(agent.reportsTo)?.name ?? agent.reportsTo;
}

export default async function OperatorCreativeFleetPage() {
  const session = await requireUser();
  if (!session.isOperator) {
    redirect("/app");
  }

  const leadership = listCreativeByTier("leadership");
  const production = listCreativeByTier("production");
  const crons = listCreativeCrons();
  const totalAgents = leadership.length + production.length;

  return (
    <div className="container-wide space-y-12 py-10">
      <header className="border-b border-rule pb-6">
        <ApEyebrow>operator · creative discipline</ApEyebrow>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink md:text-4xl">
          The fleet that makes the work.
        </h1>
        <p className="mt-3 flex max-w-2xl items-start gap-3 text-[15px] leading-relaxed text-ink-soft">
          <PlainoAvatar size="md" className="shrink-0" />
          <span>
            agentplain&rsquo;s own production org — it turns a brief into a
            finished asset: films, statics, copy, voice. Its spine is the{" "}
            <strong>creative-router</strong> (&ldquo;ask first, improvise
            never&rdquo;): every request is routed to the right tool or handed to
            a human. Creative is the peer of the{" "}
            <Link href="/operator/fleet/media" className="underline-offset-2 hover:text-ink hover:underline">
              Media discipline
            </Link>{" "}
            that distributes the work. Both are arms of the{" "}
            <strong>marketing</strong> discipline. Every agent drafts and
            proposes; nothing brand-defining is rendered by an agent.
          </span>
        </p>
        <p className="mt-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          <Link href="/operator/fleet" className="hover:text-ink">
            ← cross-vertical fleet
          </Link>
        </p>
      </header>

      <section aria-labelledby="creative-totals-heading" className="space-y-4">
        <ApEyebrow id="creative-totals-heading">discipline · totals</ApEyebrow>
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="creative agents" value={totalAgents.toString()} />
          <Stat label="leadership · class B" value={leadership.length.toString()} />
          <Stat label="production · class C" value={production.length.toString()} />
          <Stat
            label="standing crons"
            value={crons.length.toString()}
            hint="stub awaiting runner port"
          />
        </div>
      </section>

      <section aria-labelledby="capability-heading" className="space-y-3">
        <ApEyebrow id="capability-heading">creative-asset capability</ApEyebrow>
        <ApPaperCard density="default">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            The discipline does <strong>not</strong> improvise brand assets in
            raw SVG/PNG. Every request runs through the creative-router, which
            reads the{" "}
            <code className="font-mono text-ink">JOB_TO_TOOL_MATRIX</code> and
            picks the right tool — or, for brand-defining work, assembles a brief
            for an outside human creator. Open briefs and acceptance reviews live
            on the{" "}
            <Link
              href="/operator/creative-briefs"
              className="text-clay underline-offset-2 hover:underline"
            >
              creative-briefs queue
            </Link>
            .
          </p>
        </ApPaperCard>
      </section>

      <TierSection tier="leadership" agents={leadership} />
      <TierSection tier="production" agents={production} />

      <section aria-labelledby="crons-heading" className="space-y-4">
        <header>
          <ApEyebrow id="crons-heading">standing work</ApEyebrow>
          <h2 className="mt-2 font-display text-2xl text-ink md:text-3xl">
            The cadence the fleet runs.
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-soft">
            One Inngest cron, registered and observable. It ships as an honest
            stub — zero Anthropic tokens until the CronDefinition runner lands.
            Schedule is real; nothing publishes.
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
            An asset climbs the chain before it ships to distribution:
          </p>
          <ol className="mt-3 space-y-1 text-[14px] leading-relaxed text-ink">
            <li>
              <span className="font-mono text-[11px] text-mute">1 ·</span>{" "}
              <strong>Creative-router</strong> picks the tool — or files a
              CreatorBrief for a human.
            </li>
            <li>
              <span className="font-mono text-[11px] text-mute">2 ·</span>{" "}
              <strong>Maker</strong> produces with the named tool (Class C).
            </li>
            <li>
              <span className="font-mono text-[11px] text-mute">3 ·</span>{" "}
              <strong>Creative Director</strong> reviews every asset for brand
              expression and accepts human deliveries (Class B).
            </li>
            <li>
              <span className="font-mono text-[11px] text-mute">4 ·</span>{" "}
              Approved asset is handed to{" "}
              <Link href="/operator/fleet/media" className="underline-offset-2 hover:text-ink hover:underline">
                Media
              </Link>{" "}
              for distribution.
            </li>
          </ol>
        </ApPaperCard>
      </section>

      <section aria-labelledby="activity-heading" className="space-y-4">
        <ApEyebrow id="activity-heading">discipline · activity</ApEyebrow>
        <div className="border border-dashed border-rule bg-paper p-6 text-[13px] leading-relaxed text-mute">
          No creative-fleet activity yet. The cron above registers and fires on
          schedule, but it records no work until the CronDefinition runner port +
          a fleet activity table land. CreatorBrief deliveries, by contrast, are
          real now — see the{" "}
          <Link href="/operator/creative-briefs" className="underline-offset-2 hover:text-ink hover:underline">
            creative-briefs queue
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
          <code className="font-mono">~/.claude/skills/creative-*</code>.
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
