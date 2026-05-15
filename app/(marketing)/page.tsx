import Link from "next/link";
import Section from "@/components/Section";
import FAQ from "@/components/FAQ";
import VerticalChipRow from "@/components/marketing/VerticalChipRow";
import ReplaceIntegrateAugment from "@/components/marketing/ReplaceIntegrateAugment";
import RoiPreview from "@/components/marketing/RoiPreview";
import RootedInRealityProof from "@/components/marketing/RootedInRealityProof";
import { getVerticalContent } from "@/lib/verticals";
import { tokens } from "@/lib/brand/tokens";

// Homepage — 9-question story arc.
//
// Source-of-truth files (load-bearing — do NOT diverge):
//   - `project_agentplain_mission_and_positioning.md` — locked mission, vision,
//     tagline + the 9 questions every customer surface must answer
//   - `feedback_everything_tells_a_story.md` — every section must advance the
//     arc OR serve a functional purpose; filler banned
//   - `project_stripe_both_surfaces.md` — ONE Regular tier surfaced; Plus/Max
//     stay schema-only; pilot pricing dead
//   - `project_vertical_tier_mapping.md` — 10 active verticals on page 1
//
// Arc mapping (visible in section comments below):
//   Q1 Why does agentplain exist?
//   Q2 What is agentplain  →  per-vertical chip row (all 10)
//   Q3 What's the app?
//   Q4 What makes it unique → REPLACE / INTEGRATE / AUGMENT three pillars
//   Q5 Why is it easy?
//   Q6 Why believe? — rooted in reality (dogfood / counsel / ROI math)
//   Q7 ROI — preview block; full calculator on /pricing
//   Q8 Future of work / vision (locked vision line verbatim)
//   Q9 Why now / CTA
//
// Banned framings (presence = revert per `feedback_everything_tells_a_story.md`):
//   "V0" / "Phase 0" / "MVP" / "pilot" / "invite only" / "AI assistant"
//   any specific agent count ("the fleet" is the unit; counts belong in spec docs)
//   single-vertical framing on page 1
//   3-column tier comparisons (one tier surfaced; rest routes to /custom)
//   the three pilot tiers $1,500 / $2,750 / $4,500 (killed)
//   "we do not aim to replace your CRM" (wrong shape — use the three pillars)

const ladderBands = [
  { band: "Solo (1 seat)", price: "$199" },
  { band: "2–9 seats", price: "$179" },
  { band: "10–24 seats", price: "$149" },
  { band: "25–49 seats", price: "$119" },
  { band: "50–99 seats", price: "$99" },
];

export default function HomePage() {
  // One concrete value-loop example surfaces real estate by default; the
  // "not in real estate?" link below routes to the other nine. Page 1 still
  // names all 10 verticals via the chip row at the top — Q2 stays universal.
  const realEstateExample = getVerticalContent("real-estate")?.valueLoopExample;

  return (
    <>
      {/* HERO + Q2 — wordmark anchored by tagline; locked mission line; all
          10 verticals named immediately so non-real-estate visitors see
          themselves on page 1 before the fold ends. */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-24 pt-20 md:pb-28 md:pt-24">
          <p className="font-display text-base leading-snug text-clay md:text-lg">
            {tokens.tagline}
          </p>
          <h1 className="mt-6 max-w-[58rem] font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4.5rem] md:leading-[1.04]">
            We lift up{" "}
            <span className="text-clay">local businesses</span> by doing the
            work that takes their time and money away from the people they
            serve.
          </h1>
          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            {tokens.wordmark} is a fleet of capable AI partners that runs
            inside your business. The fleet reads from your email, calendar,
            CRM, and documents, categorizes what&apos;s important, drafts
            what you&apos;d otherwise type, schedules what needs scheduling,
            and coordinates across threads. You stay in control: the fleet
            drafts and proposes; you approve and send.
          </p>

          {/* Q2 — chip row, above the fold of section 2 per the story arc */}
          <div className="mt-10">
            <VerticalChipRow />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/app/sign-up" className="btn-primary">
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link href="#how" className="btn-secondary">
              See how it works
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Q1 — Why does agentplain exist? */}
      <Section
        eyebrow="Q1 — Why we exist"
        title="Local business owners spend most of their week on the work they don't love."
        intro="Email triage, copying data between tools, drafting boilerplate, scheduling, status updates — 60–70% of the week, in most surveys. The work that built the business in the first place — client relationships, judgment calls, growing the book — gets the leftover time. agentplain inverts that ratio."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <div className="bg-paper p-8 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-mute">
              The status quo
            </p>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              The CRM nags. The compliance flag fires after the draft goes out.
              The lead routes to whoever opens the inbox first. The production
              report happens twice a year because nobody has time. The owner
              answers everything because nobody else can keep the threads
              straight.
            </p>
          </div>
          <div className="bg-paper p-8 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-clay">
              The inversion agentplain delivers
            </p>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink">
              The fleet does the systematic work. The practitioner does the
              relationship work. Solo practitioners compete on operational
              depth. Mid-size firms compete on agility. The leveling effect is
              the long-term thesis.
            </p>
          </div>
        </div>
      </Section>

      {/* Q3 — What's the app? */}
      <Section
        id="how"
        tone="deep"
        eyebrow="Q3 — What's the app"
        title="One product. Solo practitioner today. Mid-size firm tomorrow."
        intro="Same code, same UX, different scale. The app shows live agent activity (what's running now), today's progress (drafts ready, meetings coordinated, time saved), and next actions (1–3 items the human should handle today). No setup wizards spanning days. No implementation services package."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <AppFacet
            label="Live activity"
            body="See every agent in motion — which thread it's reading, which draft it's queuing, which compliance flag it caught. Open feedback loop; nothing happens behind the curtain."
          />
          <AppFacet
            label="Daily progress"
            body="Today's drafts to review, meetings coordinated, hours recovered. The dashboard answers 'what did the fleet do for me?' before you've had your second coffee."
          />
          <AppFacet
            label="Next actions"
            body="One-to-three items the fleet surfaces for the human's day — judgment calls, send-this-or-edit-it decisions, the high-leverage moves only you should make."
          />
        </div>
      </Section>

      {/* Q4 — What makes it unique → REPLACE / INTEGRATE / AUGMENT */}
      <Section
        eyebrow="Q4 — What makes us different"
        title="Replace. Integrate. Augment."
        intro="The shape of the value: the fleet replaces the work you shouldn't be doing, integrates with the tools you already pay for, and augments the work that has to stay human. Concrete examples below — every entry is a commitment, not a slogan."
      >
        <ReplaceIntegrateAugment />
      </Section>

      {/* Q5 — Why is it easy? */}
      <Section
        tone="deep"
        eyebrow="Q5 — Why it's easy"
        title="Sign up free. Connect one tool. See drafts in minutes."
        intro="No setup wizard that spans days. No implementation services package. No prompt engineering. Each of the ten verticals ships with its own JTBD table, integration list, and compliance corpus — the fleet is configured before you arrive."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <Step
            number="01"
            title="Pick your vertical."
            body="Real estate, mortgage, insurance, property management, title & escrow, recruiting, home services, CPA, law, or RIA. Each vertical ships pre-configured — no custom build."
          />
          <Step
            number="02"
            title="Connect your tools."
            body="Read-only OAuth into the CRM, inbox, calendar, and accounting tools you already use. The fleet watches what's already there. 60 seconds, not a project."
          />
          <Step
            number="03"
            title="The fleet drafts; you decide."
            body="Every customer-facing output queues for your review. Approve, edit, or reject. Your existing systems send. The fleet never reaches the customer on its own."
          />
        </div>
      </Section>

      {/* Concrete value-loop example — Q5 supporting (what it actually feels
          like once it's running). Real-estate by default; deep link to the
          other nine sits below. */}
      {realEstateExample ? (
        <Section
          eyebrow="A day in the life"
          title="What the fleet drafts before you open the laptop."
          intro="One concrete example. The scenario, what you do today, what changes after the fleet lands. Every vertical page carries its own version."
        >
          <div className="border border-rule bg-paper p-6 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow text-clay">
              Real estate · solo agent
            </p>
            <p className="mt-4 max-w-3xl font-display text-2xl leading-snug text-ink md:text-3xl md:leading-snug">
              {realEstateExample.scenario}
            </p>
            <div className="mt-10 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
              <div className="bg-paper p-6 md:p-7">
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                  Today
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                  {realEstateExample.before}
                </p>
              </div>
              <div className="bg-paper p-6 md:p-7">
                <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                  With agentplain
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink">
                  {realEstateExample.after}
                </p>
              </div>
            </div>
            <div className="mt-8 border-l-2 border-clay pl-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                Outcome
              </p>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink">
                {realEstateExample.outcome}
              </p>
            </div>
            <div className="mt-10 border-t border-rule pt-6 text-[13px] text-mute">
              <p>
                Not in real estate?{" "}
                <Link href="/verticals" className="text-ink underline">
                  See the day-in-the-life example for your vertical →
                </Link>
              </p>
            </div>
          </div>
        </Section>
      ) : null}

      {/* Q6 — Why believe? Rooted in reality */}
      <Section
        tone="deep"
        eyebrow="Q6 — Rooted in reality"
        title={
          <>
            Here&apos;s what we mean by{" "}
            <span className="text-clay">&lsquo;rooted in reality.&rsquo;</span>
          </>
        }
        intro="Three things we can point at today. Not magic, not pixie dust — real product, real operators, real outcomes. We don't claim 'built for X' without the per-vertical compliance corpus + JTBD tables. We don't claim 'integrates with X' without the value-loop demo. The bar is functional, not marketing."
      >
        <RootedInRealityProof />
      </Section>

      {/* Q7 — ROI preview + pricing teaser */}
      <Section
        id="pricing"
        eyebrow="Q7 — Pricing + ROI"
        title="Affordable access to enterprise-grade tools."
        intro="That's the vision — and the math is auditable. One productized tier, per-seat, month-to-month, first month free. Anything beyond plug-and-play routes to a Custom engagement. No three-column tier comparison, no minimums, no annual lock-in."
      >
        <RoiPreview />

        <div className="mt-12 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-5">
          {ladderBands.map((row) => (
            <div key={row.band} className="bg-paper p-5">
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                {row.band}
              </p>
              <p className="mt-3 font-display text-3xl leading-none text-ink">
                {row.price}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-mute">
                per seat / mo
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="max-w-prose">
            <p className="eyebrow mb-3">What ships with every seat</p>
            <ul className="grid gap-2 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
              <li>— First month free; month-to-month after</li>
              <li>— Human review on every customer-facing output</li>
              <li>— Liability for licensed activities stays with you</li>
              <li>— Weekly outcome digest</li>
              <li>— No data resold, no client list retained</li>
              <li>— You own the work product</li>
            </ul>
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center gap-2 text-ink underline"
            >
              Full pricing + ROI calculator →
            </Link>
          </div>

          <div className="border-l border-rule pl-6">
            <p className="eyebrow mb-3">Need more?</p>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Bespoke compliance corpus, white-label, dedicated success, custom
              integration, 100+ seats — anything Regular doesn&apos;t cover
              plug-and-play, we scope as a Custom engagement.
            </p>
            <Link
              href="/custom"
              className="mt-4 inline-flex items-center gap-2 text-ink underline"
            >
              Build with us →
            </Link>
          </div>
        </div>
      </Section>

      {/* Q8 — Future of work (locked vision line verbatim) */}
      <Section
        tone="deep"
        eyebrow="Q8 — Where we're going"
        title={
          <>
            Local businesses can thrive through access to{" "}
            <span className="text-clay">
              affordable, best-in-class tools and services.
            </span>
          </>
        }
        intro="That's the vision. AI doesn't replace local business owners; it changes WHICH parts of the job they do. Local businesses have been over-rotated toward administrative work for two decades — CRMs, scheduling, compliance, status reports. The judgment work gets squeezed."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <Card
            label="The leveling effect"
            body="Solo practitioners compete with mid-size firms on operational depth. Mid-size firms compete with enterprise on agility. Affordable access to the same depth that used to require an enterprise budget — that's the long-term thesis."
          />
          <Card
            label="What the human keeps"
            body="Client relationships. Deal architecture. Advisory judgment. The work that built the business in the first place. The fleet handles the systematic work so the human gets back to the work that compounds."
          />
        </div>
      </Section>

      {/* Q9 — Why now */}
      <Section
        eyebrow="Q9 — Why now"
        title="Three things had to be true at once. As of 2026, they are."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
          <Card
            label="Models are good enough"
            body="2025 was the inflection. Categorization, drafting, scheduling, multi-step coordination at human-grade quality on real-world data — not just clean benchmarks."
          />
          <Card
            label="Vendor APIs stabilized"
            body="Gmail, Outlook, every major CRM, the transaction tools — the integration surface is buildable now. Multi-tenant OAuth is no longer a research project."
          />
          <Card
            label="Compliance is mappable"
            body="TCPA, GLBA, RESPA, fair-housing, GDPR for state-regulated industries — clear enough to build per-vertical corpuses against. Counsel-reviewable, not vibes."
          />
        </div>
      </Section>

      {/* FAQ — supporting answers across Q2–Q6 */}
      <Section
        id="faq"
        tone="deep"
        eyebrow="Questions worth asking"
        title="The honest version."
      >
        <FAQ />
      </Section>

      {/* CLOSING CTA — locked tagline + locked mission line; no realty-only
          framing, no pilot pricing, no agent counts */}
      <section className="border-b border-rule bg-ink text-paper">
        <div className="container-wide py-24 md:py-32">
          <p className="eyebrow mb-6 text-paper/60">{tokens.tagline}</p>
          <p className="max-w-3xl font-display text-3xl leading-[1.15] md:text-5xl md:leading-[1.08]">
            We lift up local businesses by doing the work that takes their
            time and money{" "}
            <span className="block mt-4 text-paper/70">
              away from the people they serve.
            </span>
          </p>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper/75">
            First month free. Month-to-month from day one. Cancel anytime. By
            the time you&apos;d pay for month two, the fleet has either earned
            its seat or it hasn&apos;t.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/verticals"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              See all ten verticals
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow text-clay">
        {number}
      </p>
      <h3 className="mt-4 font-display text-xl leading-tight text-ink md:text-2xl">
        {title}
      </h3>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function AppFacet({ label, body }: { label: string; body: string }) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {label}
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Card({ label, body }: { label: string; body: string }) {
  return (
    <div className="bg-paper p-8 md:p-10">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
        {label}
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
