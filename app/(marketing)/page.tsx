import Link from "next/link";
import Section from "@/components/Section";
import FAQ, { FAQ_ITEMS } from "@/components/FAQ";
import RoiCalculator from "@/components/RoiCalculator";
import JsonLd from "@/components/seo/JsonLd";
import {
  Step,
  UniqueCard,
  ContrastRow,
  KnowledgeStat,
  ProofCard,
  Card,
  TierCard,
} from "@/components/marketing/HomeCards";
import {
  ladderBands,
  partnerBands,
  uniques,
  chatbotContrast,
  proof,
} from "@/lib/marketing/home-content";
import {
  organizationJsonLd,
  serviceJsonLd,
  faqPageJsonLd,
} from "@/lib/seo/structured-data";
import { getAllVerticals, getVerticalContent } from "@/lib/verticals";
import { tokens } from "@/lib/brand/tokens";
import { SEED_COUNTS } from "@/lib/knowledge/seed-data";

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
      <JsonLd id="ld-service" data={serviceJsonLd()} />
      <JsonLd id="ld-faqpage" data={faqPageJsonLd(FAQ_ITEMS)} />

      {/* HERO — wordmark + tagline + locked mission line + all 10 verticals */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide pb-24 pt-20 md:pb-28 md:pt-24">
          {/* Wordmark-and-tagline lockup. The wordmark is rendered by the
              header logo above; this hero echoes the brand thesis line.
              Visual hierarchy: tagline is a small eyebrow above the mission
              line so the h1 is unambiguously the page headline (the locked
              mission line — words unchanged, sizing dominates). */}
          <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
            {tokens.tagline}
          </p>
          <h1 className="mt-6 max-w-[58rem] font-display text-4xl leading-[1.08] text-ink sm:text-5xl md:text-[4.5rem] md:leading-[1.04]">
            We lift up{" "}
            <span className="text-clay">local businesses</span> by doing the
            work that takes their time and money away from the people they
            serve.
          </h1>
          <p className="mt-8 max-w-3xl font-display text-xl leading-snug text-ink-soft md:text-2xl">
            Your AI ops team — without hiring one.
          </p>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ink-soft md:text-xl">
            {tokens.wordmark} is a service partnership. We install the fleet of
            capable AI partners inside your business, configure it for your
            vertical, run weekly reviews, and customize as your ops change.
            The fleet reads from your email, calendar, CRM, and documents,
            categorizes what's important, drafts what you'd otherwise type,
            schedules what needs scheduling, and coordinates across threads.
            You stay in control: the fleet drafts and proposes; you approve and
            send. We run the operation; you run the business.
          </p>
          {/* Supporting copy from Conner's first-pass mission articulation —
              preserved per the canonical rule as useful supporting framing. */}
          <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-mute">
            More relationship building. More of the work you enjoy. Less of
            the work that takes your time and money away from the people you
            serve.
          </p>

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

      {/* Q1 — Why do we exist? */}
      <Section
        eyebrow="Why we exist"
        title="Local business owners spend most of their week on the work they don't love."
        intro="Email triage, copying data between tools, drafting boilerplate, scheduling, status updates — 60–70% of the week, in most surveys. The work that built the business in the first place — client relationships, judgment calls, growing the book — gets the leftover time."
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
          reacts in real time to push events as they arrive. There is no
          idle hour where the crew has stopped working.
        </p>

        {/* Three honest follow-on panels — what's true TODAY, with the
            file-source line kept honest about fixtures vs. live Drive. */}
        <div className="mt-12 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
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
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              Nothing leaves without your name on it
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
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

      {/* Q4 follow-on — the "why pay vs. free" objection, answered head-on.
          Names Claude for Small Business + ChatGPT explicitly per the
          service-partnership lock (`project_service_partnership_positioning`,
          ratified 2026-05-15 in response to Anthropic's Claude for SMB
          launch). Two columns (product-vs-alternative axis — NOT a 3-column
          pricing grid). Reuses the gap-px / bg-rule hairline pattern so the
          rule shows through as the divider between columns and rows. */}
      <Section
        eyebrow="Claude gives you the tool. We run it for you."
        title={
          <>
            Claude for Small Business, or a service partner who{" "}
            <span className="text-clay">runs it for you?</span>
          </>
        }
        intro="Anthropic's Claude for Small Business and OpenAI's ChatGPT are real, useful tools — and they're cheap or free. They hand you a horizontal model and a tool catalog and expect you to figure out workflows, write prompts, and stitch integrations on your own. That's a different product than what we sell. agentplain is the opposite: we install the fleet, connect your systems, run weekly reviews, and customize as your ops shift. You stay focused on serving your customers."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          {/* LEFT column head — Claude for Small Business (named per the
              2026-05-15 positioning lock) */}
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
              Claude for Small Business (or any free chatbot)
            </p>
            <p className="mt-2 font-display text-base leading-snug text-ink-soft">
              You get the tool.
            </p>
          </div>
          {/* RIGHT column head — agentplain, run for you */}
          <div className="bg-paper p-7 md:p-8">
            <p className="font-mono text-[11px] tracking-eyebrow uppercase text-clay">
              agentplain, run for you
            </p>
            <p className="mt-2 font-display text-base leading-snug text-ink">
              We run it for you.
            </p>
          </div>

          {/* Rows. Each contrast renders LEFT then RIGHT so the hairline
              grid keeps the two columns aligned across breakpoints. */}
          {chatbotContrast.map((row) => (
            <ContrastRow key={row.us} free={row.free} us={row.us} />
          ))}
        </div>
      </Section>

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
        tone="deep"
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

      {/* Q6 — Why should anyone believe us? */}
      <Section
        eyebrow="Rooted in reality"
        title="Here's what we mean by &lsquo;rooted in reality.&rsquo;"
        intro="Four things we can point at today. Not magic, not pixie dust — real product, real operators, real outcomes. We don't claim 'built for X' without the per-vertical compliance corpus + JTBD tables; we don't claim 'integrates with X' without the value-loop demo. The bar is functional, not marketing."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-2">
          {proof.map((p) => (
            <ProofCard key={p.label} {...p} />
          ))}
        </div>
      </Section>

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
        intro="Three ways to partner with us. Every tier includes the fleet, the per-vertical compliance corpus, and a service team that installs, reviews, and customizes alongside you. The calculator below is anchored to Regular; Partner adds dedicated overlay; Max is quoted to scope."
      >
        <RoiCalculator />

        <div className="mt-12 grid gap-px overflow-hidden border border-rule bg-rule lg:grid-cols-3">
          <TierCard
            name="Regular"
            tagline="Standard service partnership."
            description="Our team installs the fleet, configures it for your vertical, and runs a monthly review. Day-to-day, the fleet drafts inside the workspace you log into."
            bands={ladderBands}
            ctaLabel="Start free trial"
            ctaHref="/app/sign-up"
            ctaStyle="primary"
            footnote="First month free. Month-to-month. Per seat."
          />
          <TierCard
            name="Partner"
            tagline="Named service partner."
            description="Same fleet, with a dedicated service partner who runs weekly reviews, owns customization, and handles change management as your ops shift."
            bands={partnerBands}
            ctaLabel="Talk to a service partner"
            ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Partner%20tier%20interest"
            ctaStyle="secondary"
            footnote="First month free. Month-to-month. Per seat."
            featured
          />
          <TierCard
            name="Max"
            tagline="Ad-hoc service partnership."
            description="For firms whose ops don't fit the productized shape — quoted to scope, not by seat. Talk to us about what you need and we'll come back with a written engagement."
            quotedNote="Quoted per engagement"
            ctaLabel="Talk to us"
            ctaHref="mailto:hello@agentplain.com?subject=agentplain%20Max%20tier%20inquiry"
            ctaStyle="secondary"
            footnote="Sales-led — no self-checkout."
          />
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-[2fr_1fr]">
          <div className="max-w-prose">
            <p className="eyebrow mb-3">What ships with every tier</p>
            <ul className="grid gap-2 text-[15px] leading-relaxed text-ink-soft sm:grid-cols-2">
              <li>— A service partner who installs and runs reviews</li>
              <li>— Human review on every customer-facing output</li>
              <li>— Liability for licensed activities stays with you</li>
              <li>— Per-vertical compliance corpus, counsel-reviewed</li>
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
            <span className="text-clay">
              affordable, best-in-class tools and services.
            </span>
          </>
        }
        intro="That's the vision. AI doesn't replace local business owners; it changes WHICH parts of the job they do. Local businesses have been over-rotated toward administrative work for two decades — CRMs, scheduling, compliance, status reports. The judgment work gets squeezed."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <Card
            number="Q8"
            title="The future of work"
            body="agentplain inverts the ratio. The fleet handles the systematic work; the human gets back to client relationships, deal architecture, advisory. Solo practitioners compete with mid-size firms on operational depth. Mid-size firms compete with enterprise on agility. Affordable access to the same operational depth that used to require an enterprise budget — that's the leveling effect."
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
          Q9 double CTA: primary self-start, secondary talk-to-a-service-partner. */}
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
            the time you&apos;d pay for month two, your service team has
            either earned its seat or it hasn&apos;t.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/app/sign-up"
              className="inline-flex items-center justify-center gap-2 border border-paper bg-paper px-6 py-3 text-sm font-medium text-ink transition hover:bg-paper-deep"
            >
              Start free trial
              <span aria-hidden>→</span>
            </Link>
            <a
              href="mailto:hello@agentplain.com?subject=agentplain%20service%20partner%20conversation"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Talk to a service partner
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/custom"
              className="inline-flex items-center justify-center gap-2 border border-paper/40 bg-transparent px-6 py-3 text-sm font-medium text-paper transition hover:border-paper"
            >
              Build with us
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/verticals"
              className="inline-flex items-center justify-center gap-2 border border-paper/20 bg-transparent px-6 py-3 text-sm font-medium text-paper/80 transition hover:border-paper hover:text-paper"
            >
              See all ten verticals
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

