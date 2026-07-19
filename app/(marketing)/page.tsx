import Link from "next/link";
import Section from "@/components/Section";
import FAQ, { FAQ_ITEMS } from "@/components/FAQ";
import RoiCalculator from "@/components/RoiCalculator";
import { ValueLoopDiagram } from "@/components/explainers/ValueLoopDiagram";
import JsonLd from "@/components/seo/JsonLd";
import {
  Step,
  UniqueCard,
  KnowledgeStat,
  ProofCard,
  Card,
} from "@/components/marketing/HomeCards";
import { PriceTiers } from "@/components/marketing/PriceTiers";
import { uniques, proof } from "@/lib/marketing/home-content";
import {
  ApClosingBand,
  ApClosingBandAction,
  ApPaperCard,
} from "@/components/ui/ap";
import {
  organizationJsonLd,
  serviceJsonLd,
  softwareApplicationJsonLd,
  webSiteJsonLd,
  faqPageJsonLd,
} from "@/lib/seo/structured-data";
import { alternatesFor } from "@/lib/seo/metadata";
import TrustSection from "@/components/trust/TrustSection";
import { getAllVerticals, getVerticalContent } from "@/lib/verticals";
import { tokens } from "@/lib/brand/tokens";
import { SEED_COUNTS } from "@/lib/knowledge/seed-data";
import type { Metadata } from "next";

// Apex homepage metadata. Title inherits the root-layout default (locked
// wordmark + tagline); a homepage-specific description (≤155 chars,
// value-prop-led) overrides the longer site-wide default, plus the
// self-referential canonical + hreflang stub.
export const metadata: Metadata = {
  description:
    "A managed AI fleet for local businesses — pre-built for your vertical, your tools connected, run for you. We do the work; you run the business.",
  alternates: alternatesFor("/"),
};

// Marketing home.
//
// Required to answer ALL 9 questions per
// `project_agentplain_mission_and_positioning.md` (Q1–Q9). Banned framings
// enforced in this file:
//   - no specific agent count ("the fleet" is the unit; counts belong to spec docs)
//   - no real-estate-only on page 1 (all 10 verticals named upfront)
//   - no "pilot pricing" framing (killed per project_stripe_both_surfaces.md)
//   - no "AI assistant" framing
//   - no "automate everything" / "replace your team" framings
//   - no "coming soon" without date/qualification
//
// Sources for every concrete claim are footnoted with their memory file.
// Card primitives live in `components/marketing/HomeCards.tsx`; the data
// constants live in `lib/marketing/home-content.ts` — extracted from this
// file in the SEO/marketing pack PR so the page renderer stays scannable.

export default function HomePage() {
  // All ten verticals named on page 1 per the mission rule. Real estate is
  // one of ten — never the only one mentioned upfront.
  const verticals = getAllVerticals();
  const realEstateExample = getVerticalContent("real-estate")?.valueLoopExample;

  return (
    <>
      {/* Structured data — Organization + Service for the publisher, and a
          FAQPage payload built from the same FAQ_ITEMS the page renders.
          Per `lib/seo/structured-data.ts`: no invented claims, no review
          counts, no schema we can't substantiate from existing content. */}
      <JsonLd id="ld-organization" data={organizationJsonLd()} />
      <JsonLd id="ld-website" data={webSiteJsonLd()} />
      <JsonLd id="ld-software" data={softwareApplicationJsonLd()} />
      <JsonLd id="ld-service" data={serviceJsonLd()} />
      <JsonLd id="ld-faqpage" data={faqPageJsonLd(FAQ_ITEMS)} />

      {/* HERO — wordmark + tagline + locked mission line + all 10 verticals.
          The heritage Plaino illustration is a CONTAINED editorial figure (a
          hairline-bordered picture with a mono caption), NOT a full-bleed
          watermark behind the copy. On lg+ it sits as a right-hand figure
          column beside the copy; below lg it drops full-width under the copy,
          object-contain so the landscape scene is never cropped to a sliver.
          The image is the best brand asset we own — it reads as a picture, not
          a texture (Conner, 2026-06-11). Hero padding is squared to the global
          Section rhythm (py-20 md:py-28) so the first fold doesn't sit tighter
          than every block below it. */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
            {/* COPY COLUMN */}
            <div>
              {/* Wordmark-and-tagline lockup. The wordmark is rendered by the
                  header logo above; this hero echoes the brand thesis line.
                  Visual hierarchy: tagline is a small eyebrow above the mission
                  line so the h1 is unambiguously the page headline (the locked
                  mission line — words unchanged, sizing dominates). */}
              <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
                {tokens.tagline}
              </p>
              <h1 className="mt-6 max-w-[58rem] font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4.25rem] md:leading-[1.04]">
                We lift up{" "}
                <span className="text-clay">local businesses</span> by doing the
                work that takes their time and money away from the people they
                serve.
              </h1>
              <p className="mt-8 max-w-3xl font-display text-xl leading-snug text-ink-soft md:text-2xl">
                The best AI tools are powerful. Most owners don&apos;t have time
                to figure them out. We do it for you.
              </p>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
                {tokens.wordmark} is the service partner that runs it. We bring
                the pre-built skills and agents you&apos;d otherwise have to
                build yourself, manage the memory that keeps it useful, connect
                the tools you already run, and operate the whole thing for a low
                flat fee — plug-and-play, not a configure-it-yourself project.
                You stay in control: the fleet drafts and proposes; you approve
                and send. We run the operation; you run the business.
              </p>
              {/* Supporting copy from Conner's first-pass mission articulation —
                  preserved per the canonical rule as useful supporting framing. */}
              <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-mute">
                More relationship building. More of the work you enjoy. Less of
                the work that takes your time and money away from the people you
                serve.
              </p>

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

            {/* FIGURE COLUMN — contained heritage illustration. Full-width
                under the copy on mobile; right-hand figure on lg+. object-contain
                + natural aspect so the landscape scene is shown whole, never
                cropped. Hairline border + mono caption = editorial figure, not
                a background texture. */}
            <figure className="m-0">
              <div className="border border-rule bg-paper-deep">
                {/* eslint-disable-next-line @next/next/no-img-element -- local
                    brand raster; next/image avoided product-wide (see Plaino.tsx) */}
                <img
                  src="/brand/plaino-system/heritage.png"
                  alt="Plaino, the agentplain service dog, standing watch over a working plain at first light."
                  className="block h-auto w-full object-contain"
                  width={495}
                  height={235}
                />
              </div>
              <figcaption className="mt-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                Plaino, standing watch on the plain
              </figcaption>
            </figure>
          </div>

          {/* All 10 verticals as a chip row.
              `/general` is NOT a chip — the chip row enumerates the ratified
              ten per `feedback_no_new_verticals_finish_locked.md`. The
              on-ramp surface is offered immediately below as a separate
              "Don't see your industry?" link so businesses outside the ten
              still have an honest landing path. */}
          <div className="mt-10">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              Built for ten kinds of local business — pick yours
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {verticals.map((v) => (
                <Link
                  key={v.slug}
                  href={`/${v.slug}`}
                  className="group inline-flex items-center gap-2 border border-rule bg-paper px-3 py-2 text-sm text-ink transition hover:border-ink hover:bg-paper-deep"
                >
                  <span className="font-display">{v.name}</span>
                  <span
                    aria-hidden
                    className="font-mono text-[10px] tracking-eyebrow text-mute group-hover:text-clay"
                  >
                    →
                  </span>
                </Link>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-mute">
              Don&apos;t see your industry?{" "}
              <Link href="/general" className="text-ink underline">
                Same service partnership, lighter scaffolding →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* V01 — The value loop (docs/explainer-visual-system-2026-06-07.md §3).
          The 30-second answer to "what even is this?" sits directly under the
          hero: a closed loop where the human (your approval queue) is the clay
          node — nothing leaves until your name is on it. CODE-SVG, so the five
          labels stay matched to the no-outbound architecture. */}
      <Section
        tone="forest"
        eyebrow="The shape of it"
        title="Your tools in. Drafts out. You approve. Nothing sends on its own."
        intro="The fleet reads what's already in your systems, does the work that lives between your tools, and lands every result in your queue. You stay the only one who hits send."
      >
        {/* The conceptual anchor sits on the grounded forest band — one bold
            pause where the diagram reads as a cream plate on deep field green. */}
        <div className="border border-mid-rule bg-paper-bright p-4 md:p-8">
          <ValueLoopDiagram />
        </div>
      </Section>

      {/* RUN-IT-YOURSELF VS RUN-FOR-YOU — near the top, by design.
          Vendor-generic per the 2026-06-11 customer-surface rule: the underlying
          AI model is never named on a customer surface. The premise is the
          honest "why pay when capable AI tools are cheap or free?" objection,
          answered without naming any vendor. We are NOT positioned against any
          one tool — the contrast is do-it-yourself vs. have-it-run-for-you. The
          four pillars are stated plainly: pre-built skills + agents, memory
          management, low-cost plug-and-play, and a human-staffed service. */}
      <Section
        id="run-for-you"
        eyebrow="A powerful tool you could run yourself — or a partner who runs it"
        title={
          <>
            The best AI tools are powerful.{" "}
            <span className="text-clay">We make them actually usable.</span>
          </>
        }
        intro="Capable general-purpose AI tools are real, and some are cheap or free. But they hand you a horizontal model and expect you to figure out which skills to write, which agents to build, what to put in memory, and how to wire your tools. Most owners don't have the time — or the engineer. agentplain brings all of that pre-built, manages it for you, and runs it for a low flat fee. You don't configure it; we run it."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Pre-built skills + agents
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              You don&apos;t figure out what skills to write or what agents to
              build. We bring the per-vertical fleet — the jobs your industry
              actually needs — ready on day one.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Memory, managed
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              The persistent context the fleet needs to stay useful long-term —
              what to remember, what to prune, what not to let go stale — we
              curate and maintain it. You never touch a config file.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Low-cost, plug-and-play
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              One bundled flat fee. One Connect button per integration. No
              per-skill setup, no prompt engineering, no months of
              configuration before you see value.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              A resource, not a tool
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              A human-staffed service partner installs it, runs reviews, and
              customizes as your ops shift. Done-for-you — not
              configure-it-yourself.
            </p>
          </div>
        </div>
        <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-mute">
          The model is the engine. The service is the difference. That&apos;s the
          part you can&apos;t get by signing up for the model alone.
        </p>
      </Section>

      {/* Q1 — Why do we exist? */}
      <Section
        eyebrow="Why we exist"
        title="Local business owners spend most of their week on the work they don't love."
        intro="Email triage, copying data between tools, drafting boilerplate, scheduling, status updates: 60–70% of the week, in most surveys. The work that built the business in the first place — client relationships, judgment calls, growing the book — gets the leftover time."
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

      {/* Q3 — What the crew actually does.
          v4 (`outputs/agentplain-how-it-works-v4.md`, 2026-05-24) reframes
          how-it-works around the RUNTIME loop the runner actually executes
          on every fire — read → categorize → coordinate → schedule → draft.
          The earlier install-flow framing was the onboarding journey, not
          the working loop; it lives in the FAQ now. The supporting panels
          surface three claims v4 promotes as truthful today:
            - the preference-learning loop (onboarding tunes + every edit
              becomes the next prompt's teacher) — captured in
              `lib/preferences/` and consumed by the runner's prompt
              composer, not a stub.
            - file ingestion runs against on-disk fixtures today; live
              Drive lands the same way once OAuth connects (per the
              `DriveFileSource` adapter — `lib/customer-files/drive-source.ts`).
            - the no-outbound discipline (every draft is a PENDING
              ApprovalRow; customer systems execute) — see
              `project_no_outbound_architecture.md`. */}
      <Section
        id="how"
        tone="deep"
        eyebrow="How it works"
        title="Read. Categorize. Coordinate. Schedule. Draft."
        intro="Five steps, every fire. The crew runs the same loop on every inbound thing — an email, a Pub/Sub push, a webhook from your CRM. It runs in the background, all day, on its own. You touch it when you choose to."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-5">
          <Step
            number="01"
            title="Read."
            body="Pull the message, parse the thread, find the newest reply. The crew never starts from a blank prompt — it starts from what just landed."
          />
          <Step
            number="02"
            title="Categorize."
            body="Decide what kind of thing it is — a real lead, a scheduling ask, a vendor pitch, noise, an admin note, something you'd want a draft of. The categorization is workspace-tuned, not a generic chatbot guess."
          />
          <Step
            number="03"
            title="Coordinate."
            body="Walk back the thread, summarize what's already been said, pick up the referenced documents. The draft is grounded in the workspace's actual files, not the model's training prior."
          />
          <Step
            number="04"
            title="Schedule."
            body="When something needs a time, propose slots inside your stated hours — never outside them, never without checking what's already on your calendar."
          />
          <Step
            number="05"
            title="Draft."
            body="Write the reply in your voice, grounded in your files and the edits you've made before. Hand it to the approval queue. Nothing leaves without your name on it."
          />
        </div>

        <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-mute">
          The chain runs every five minutes against your inbox backlog and
          reacts to push events as your tools are connected. There is no
          idle hour where the crew has stopped working.
        </p>

        {/* Two honest follow-on panels — what's true TODAY, with the
            file-source line kept honest about fixtures vs. live Drive. */}
        <div className="mt-12 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Tell us once, and it adjusts
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Onboarding captures your tone, your default hours, and the
              categorization quirks of your business — and those choices
              ride into every prompt every fire. Every edit you make to a
              draft becomes a learned note: <em>&ldquo;Owner shortened the
              draft by 22%, removed &lsquo;pleased to assist.&rsquo;&rdquo;</em>
              The very next fire sees what you taught — no model retraining,
              no waiting. Every signal is workspace-scoped and append-only.
            </p>
          </div>
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              It sounds like you because it works from your files
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              Connect a file source — a Drive folder of past offers,
              playbooks, objection-handling notes — and the crew ingests it
              into a workspace-scoped knowledge store. Every draft prompt
              pulls the most-relevant snippets and writes against them.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-mute">
              Today the file source runs against on-disk fixtures for the
              inbox-loop demo path, and Google Drive lands the same way the
              moment the OAuth scopes are connected on your{" "}
              <code className="text-[12px]">/integrations</code> page. The
              pipeline doesn&apos;t change — just the source flips from
              fixture to live.
            </p>
          </div>
        </div>

        {/* The approval moment, made literal — Plaino fetching the sealed
            envelope to your queue. This is the no-outbound promise the whole
            architecture turns on, so it gets a contained figure (hairline
            border + mono caption) paired with the copy, full-width on mobile
            so the phone gets a second visual anchor below the hero. The
            fetching pose PNG is re-cropped by a parallel wave at this path. */}
        <div className="mt-12 grid items-center gap-px overflow-hidden border border-rule bg-rule md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <figure className="m-0 flex items-center justify-center bg-paper-deep p-8">
            {/* eslint-disable-next-line @next/next/no-img-element -- local brand
                raster; next/image avoided product-wide (see Plaino.tsx) */}
            <img
              src="/brand/plaino-system/poses/fetching.png"
              alt="Plaino carrying a sealed envelope stamped with the clay 'a' to the approval queue."
              className="block h-auto w-full max-w-[220px] object-contain"
              width={250}
              height={278}
            />
          </figure>
          <div className="bg-paper p-7 md:p-10">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Nothing leaves without your name on it
            </p>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft md:text-base">
              Every draft — a buyer reply, an admin acknowledgement, a
              scheduling proposal — lands in your approvals queue as a
              <code className="mx-1 text-[12px]">PENDING</code> row.
              Nothing in the architecture sends anything outbound. The crew
              advises and drafts; <em>you</em> execute, from inside your
              own email, calendar, and CRM, where your name and your
              domain are already on the message.
            </p>
          </div>
        </div>
      </Section>

      {/* Q4 — What makes agentplain unique */}
      <Section
        eyebrow="What makes us different"
        title="Five things you won't get from a generic AI tool."
        intro="Generic AI is horizontal and self-serve — you figure it out. agentplain is a service partnership: we pick three jobs on day one and run them for you. We REPLACE the manual work that lives between your tools. We INTEGRATE with the systems you already pay for. We AUGMENT the human judgment you keep. Each unique below is a commitment your service partner owns — not a feature you configure."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {uniques.map((u, i) => (
            <UniqueCard
              key={u.label}
              number={String(i + 1).padStart(2, "0")}
              label={u.label}
              body={u.body}
            />
          ))}
        </div>
      </Section>

      {/* NOTE (Wave A3, 2026-06-11): the standalone "free chatbot vs. run it
          for you" contrast Section was CUT here. It restated the same
          run-it-yourself-vs-run-for-you argument the four-pillar "run-for-you"
          section near the top already makes, plus the "You stay in control" /
          "Integrates, not replaces" uniques — two full sections answering one
          objection violated `feedback_everything_tells_a_story.md` (every
          element earns its place). The objection is answered once, where it
          first arises (the run-for-you section under the value loop). The
          `chatbotContrast` data + `ContrastRow` primitive remain available for
          a vertical page that wants the comparative table. */}

      {/* Concrete value-loop example (real-estate sample, with a deep link to
          every other vertical's example). */}
      {realEstateExample ? (
        <Section
          tone="deep"
          eyebrow="A day in the life"
          title="What the fleet drafts before you open the laptop."
          intro="One concrete example. The scenario, what a practitioner does today, what changes after the fleet lands. Every vertical page carries its own version."
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

      {/* Knowledge substrate proof — VERIFIABLE counts pulled from the seed
          assembly in `lib/knowledge/seed-data.ts`. Numbers are computed at
          build time from the actual rows the substrate loads at install:
            - SKILL = the 5 value-loop skill docs + architecture chunks
            - VERTICAL = per-vertical hero/JTBD/ROI/claims/integrations/loop
                         chunks + per-role JTBD synthesis across the 10
                         locked verticals (+ /general on-ramp)
            - COMPLIANCE = original 5 real-estate fixtures + per-vertical
                           sentinel rules that have been VERIFIED (unverified
                           placeholders are skipped per seed-data.ts)
            - CROSS_CUSTOMER = ratified positioning/pricing/brand/mission
                               doctrine docs
          Per `feedback_no_guesses_no_estimates.md`: every number here cites
          the artifact (seed-data.ts SEED_COUNTS) — none invented. */}
      <Section
        eyebrow="What the fleet knows on day one"
        title="A working knowledge base, not a blank prompt box."
        intro="The fleet doesn't start cold. Before a customer signs up, the knowledge substrate already ships pre-loaded with vertical-specific jobs-to-be-done, the value-loop skill docs the runner consumes, a per-vertical compliance corpus, and the ratified product doctrine that grounds every draft. Counts below are computed at build time from the actual rows the substrate loads — not aspirational, not invented."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          <KnowledgeStat
            count={SEED_COUNTS.VERTICAL}
            label="Vertical knowledge chunks"
            body="Per-vertical hero, JTBD per role, ROI math, claims, integrations, and day-in-the-life example. Indexed across the ten locked verticals plus the /general on-ramp."
          />
          <KnowledgeStat
            count={SEED_COUNTS.COMPLIANCE}
            label="Compliance rules"
            body="Per-vertical regulatory rules drafted with the citation in place. The real-estate fair-housing literal-match scanner (HUD-enumerated trigger phrases) fires today; the other verticals' rules are loaded as drafts and don't fire until counsel red-lines them."
          />
          <KnowledgeStat
            count={SEED_COUNTS.SKILL}
            label="Skill + architecture docs"
            body="The five value-loop skills (read / categorize / coordinate / schedule / draft) plus the architecture chunks that describe how the runner composes them."
          />
          <KnowledgeStat
            count={SEED_COUNTS.CROSS_CUSTOMER}
            label="Ratified doctrine docs"
            body="Locked positioning, pricing, brand semantics, mission, design language, and architectural decisions — so every draft reflects today's truth, not the model's training prior."
          />
        </div>
        <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-mute">
          Counts are computed at build time from the rows the substrate
          actually loads. Nothing here is aspirational.
        </p>
      </Section>

      {/* Q6 — Why should anyone believe us?
          The converting numbers get the page's premium visual weight: the ROI
          proof is set as a captioned ledger exhibit (mono figures, hairline-
          ruled header, paper-bright plate — the Stripe-style "show the real
          thing" frame), not a flat text card. The foil that used to sit on the
          Q8 mission copy is retired from cream grounds entirely — its light
          gradient stops read at 1.3–2.1:1 there (kaizen 2026-07-02 friction
          6); the exhibit frame carries the premium moment instead. */}
      <Section
        eyebrow="Rooted in reality"
        title="Here's what we mean by &lsquo;rooted in reality.&rsquo;"
        intro="Four things we can point at today. Not a pitch — working software, the people who run it, and a brokerage we run it on. We don't claim 'built for X' without the per-vertical compliance corpus + JTBD tables; we don't claim 'integrates with X' without the value-loop demo. The bar is functional, not marketing."
      >
        <ApPaperCard
          variant="ledger"
          eyebrow="Exhibit · the working math, at our stated assumptions"
        >
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="font-mono text-3xl text-ink md:text-4xl">10 hrs</p>
              <p className="mt-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                a week back · the assumption
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl text-ink md:text-4xl">$4,300</p>
              <p className="mt-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                modeled value per month
              </p>
            </div>
            <div>
              <p className="font-mono text-3xl text-ink md:text-4xl">
                $99–$199
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
                per seat per month
              </p>
            </div>
          </div>
          <p className="mt-6 max-w-prose text-[14px] leading-relaxed text-ink-soft">
            Those are the ROI calculator&apos;s own defaults — 10 saved hours a
            week valued at $100 an hour — not your numbers.{" "}
            <Link href="#pricing" className="text-ink underline underline-offset-4">
              Run yours in the calculator below.
            </Link>
          </p>
        </ApPaperCard>

        <div className="mt-px grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
          {proof
            .filter((p) => p.label !== "ROI math, not vibes")
            .map((p) => (
              <ProofCard key={p.label} {...p} />
            ))}
        </div>
      </Section>

      {/* Social proof scaffolding (2026-07-19) — sits between the
          rooted-in-reality claims and pricing, where a prospect asks "who
          else trusts you?" before asking "what does it cost?". Every block
          reads lib/trust/proof.ts and holds an honest empty state until real
          proof lands; populating a registry lights this up with no page
          edits. */}
      <TrustSection />

      {/* Q6/Q7 — Pricing + ROI under the service-partnership lock.
          Three tiers (Regular / Partner / Max) reframe the per-seat ladder
          as the entry price for a service partnership, not a self-serve
          plan. /custom remains a separate surface for bespoke engagements
          outside the tier ladder. */}
      <Section
        id="pricing"
        tone="deep"
        eyebrow="Pricing + ROI"
        title="Affordable access to enterprise-grade tools — with the service team that runs them."
        intro="Three ways to partner with us. Every tier includes the fleet, the per-vertical compliance corpus, and a service team that installs, reviews, and customizes alongside you. The calculator below is anchored to Regular; Partner adds priority support and a quarterly check-in; Max is quoted to scope."
      >
        <RoiCalculator />

        {/* Tier grid extracted to PriceTiers (2026-07-08): the ladders come
            from lib/pricing/tiers.ts and the trial/guarantee facts from
            lib/billing/facts.ts, so this block can no longer drift from
            billing truth. */}
        <div className="mt-12">
          <PriceTiers />
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="max-w-prose">
            <p className="eyebrow mb-3">What ships with every tier</p>
            <ul className="grid gap-2 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
              <li>— A service partner who installs and runs reviews</li>
              <li>— Human review on every customer-facing output</li>
              <li>— Liability for licensed activities stays with you</li>
              <li>— Per-vertical compliance corpus — real-estate scanner fires live; others gated until counsel review</li>
              <li>— No data resold; no client list used to train models</li>
              <li>— You own the work product</li>
            </ul>
          </div>

          <div className="border-l border-rule pl-6">
            <p className="eyebrow mb-3">Outside the tiers?</p>
            <p className="text-[15px] leading-relaxed text-ink-soft">
              Bespoke compliance corpus, white-label, custom integration to a
              tool off the roadmap, 100+ seats — anything the productized
              tiers don&apos;t cover, we scope as a Custom engagement on
              /custom. Different from Max (which is a service-partnership
              tier with non-standard scope): /custom is engagement work
              against a written spec.
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

      {/* Q8 — How do we think about the future of work? + Q9 — Why now? */}
      <Section
        eyebrow="Where we're going"
        title={
          <>
            Local businesses can thrive through access to{" "}
            {/* Foil retired from cream grounds (its light stops read at
                1.3–2.1:1 there — kaizen 2026-07-02 friction 6; the ledger
                exhibit above now carries the page's premium moment). The
                thesis emphasis uses the same clay span as the hero. */}
            <span className="text-clay">
              affordable, best-in-class tools and services.
            </span>
          </>
        }
        intro="That's the vision. Local businesses have been over-rotated toward administrative work for two decades — CRMs, scheduling, compliance, status reports — and the judgment work that built the business gets squeezed. We're betting that changes."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <Card
            number="Q8"
            title="The future of work"
            body="AI doesn't replace local business owners; it changes which parts of the job they do. The fleet takes the systematic work; the owner gets back the judgment work — client relationships, deal architecture, advisory. Affordable access to the operational depth that used to require an enterprise budget is the leveling effect we're building toward."
          />
          <Card
            number="Q9"
            title="Why now"
            body="Models got good enough in 2025 to do real categorization, drafting, scheduling on real-world data — not benchmarks. Vendor APIs (Gmail, Outlook, every major CRM) stabilized enough to build multi-tenant integrations. Compliance frameworks (TCPA, GLBA) are clear enough to build per-vertical corpuses against. Early enough to define the category, late enough that the tech actually works."
          />
        </div>
      </Section>

      {/* FAQ — Q2/Q3/Q4/Q5/Q6 follow-ups in one place */}
      <Section
        id="faq"
        tone="deep"
        eyebrow="Questions worth asking"
        title="The honest version."
      >
        <FAQ />
      </Section>

      {/* CLOSING CTA — locked mission line, no realty-only framing.
          Q9 double CTA: primary self-start, secondary talk-to-a-service-partner.
          Set with ApClosingBand (2026-07-08): the one grounded close every long
          page now shares — forest-deep, letterpress inverted, wheat focus
          rings, hairline seam against the footer. The money-back promise now
          LINKS to /guarantee, which previously had zero inbound links (audit
          2026-07-02 finding 5). */}
      <ApClosingBand
        title={
          <>
            We lift up local businesses by doing the work that takes their
            time and money{" "}
            <span className="block mt-4 text-paper/70">
              away from the people they serve.
            </span>
          </>
        }
        body={
          <>
            7-day free trial, card at signup. Month-to-month from day one.
            Cancel anytime. By the time the trial ends, your service team has
            either earned its seat or it hasn&apos;t — and there&apos;s a{" "}
            <Link
              href="/guarantee"
              className="text-paper underline underline-offset-4 hover:text-wheat"
            >
              14-day money-back guarantee
            </Link>{" "}
            if it hasn&apos;t.
          </>
        }
        actions={
          <>
            <ApClosingBandAction href="/app/sign-up" variant="primary">
              Start free trial
            </ApClosingBandAction>
            <ApClosingBandAction href="mailto:hello@agentplain.com?subject=agentplain%20service%20partner%20conversation">
              Talk to a service partner
            </ApClosingBandAction>
            <ApClosingBandAction href="/custom">
              Build with us
            </ApClosingBandAction>
            <ApClosingBandAction href="/verticals" variant="quiet" withArrow={false}>
              See all ten verticals
            </ApClosingBandAction>
          </>
        }
      />
    </>
  );
}

