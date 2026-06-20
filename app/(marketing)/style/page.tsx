import type { Metadata } from "next";
import Section from "@/components/Section";
import {
  ApHeritageButton,
  ApPaperCard,
  ApPullQuote,
  ApPlainoLoader,
  ApRootedLoader,
  PlainoStatus,
} from "@/components/ui/ap";
import { tokens } from "@/lib/brand/tokens";

// ── Internal style guide ──────────────────────────────────────────────────────
// A living documentation surface for the agentplain visual system: tokens +
// editorial components in use, plus the design-mirror's "generic SaaS does X, we
// do Y" contrast. Companion to docs/brand/design-mirror-2026-06-19.md and
// docs/product-design-language-2026-05-17.md.
//
// Routed under (marketing) so it inherits the real Header/Footer/Plaino chrome —
// the guide shows the system in its actual frame, not a sandbox. noindex: this is
// an internal reference, not a customer landing page.

export const metadata: Metadata = {
  title: "Style guide",
  description:
    "Internal reference for the agentplain visual system — tokens, editorial components, and the patterns that keep us from reading as generic-SaaS.",
  robots: { index: false, follow: false },
};

// Swatch — a single token chip. Square, hairline-framed, mono caption. No rounded
// corners, no shadow; the rule defines the edge (design-language §2.4/§2.5).
function Swatch({
  name,
  hex,
  className,
  note,
  onDark = false,
}: {
  name: string;
  hex: string;
  className: string;
  note?: string;
  onDark?: boolean;
}) {
  return (
    <div className="border border-rule bg-paper">
      <div
        className={`h-20 w-full border-b border-rule ${className} ${
          onDark ? "text-paper/70" : "text-ink/50"
        } flex items-end p-2`}
      >
        <span className="font-mono text-[10px] uppercase tracking-eyebrow">
          {note}
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="font-sans text-[13px] text-ink">{name}</p>
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          {hex}
        </p>
      </div>
    </div>
  );
}

// Contrast row — "generic SaaS does X, we do Y". The core thesis of the design-
// mirror, made literal.
function ContrastRow({ saas, us }: { saas: string; us: string }) {
  return (
    <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
      <div className="bg-paper-deep p-5 md:p-6">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
          Generic SaaS / AI
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{saas}</p>
      </div>
      <div className="bg-paper p-5 md:p-6">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
          agentplain
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink">{us}</p>
      </div>
    </div>
  );
}

export default function StyleGuidePage() {
  const c = tokens.colors;

  return (
    <>
      {/* HERO — editorial, not SaaS-template: a dateline, a single serif headline,
          one lede, one confident CTA. No gradient, no centered three-column. */}
      <section className="border-b border-rule bg-paper">
        <div className="container-wide py-20 md:py-28">
          <span className="dateline mb-6">Internal · rooted in reality</span>
          <h1 className="max-w-[48rem] font-display text-4xl leading-[1.06] text-ink sm:text-5xl md:text-[3.75rem]">
            The visual system, and the line between{" "}
            <span className="text-clay">heritage</span> and generic.
          </h1>
          <p className="drop-cap mt-8 max-w-2xl text-lg leading-relaxed text-ink-soft">
            This is the working reference for how agentplain looks and why. The
            short version: we read as made-by-a-person — paper and ink, one
            spent accent, hairline edges, real artifacts shown as figures, and a
            working dog named Plaino — and we refuse the moves that make
            software feel machine-extruded. Every token and component below is on
            the page in its real frame, with the generic pattern it replaces set
            beside it.
          </p>
          <div className="mt-10">
            <ApHeritageButton variant="primary" size="lg" href="#tokens" withArrow>
              see the tokens
            </ApHeritageButton>
          </div>
          <p className="field-note mt-8 max-w-xl">
            Field note — sourced from docs/brand/design-mirror-2026-06-19.md, a
            mirror of seven brands that don&apos;t feel like AI: Linear, MUJI,
            Patagonia, early Stripe, pre-Intuit Mailchimp, heritage Americana,
            and the robot-dog precedents.
          </p>
        </div>
      </section>

      {/* TOKENS — color */}
      <Section
        id="tokens"
        eyebrow="Color"
        title="A palette from dirt and light, not a swatch picker."
        intro="Paper and ink carry 90% of every surface. Clay is the single charge — spent once per view. The support tones (forest, wheat, paper-bright, clay-wash) are the 2026-06-19 additions: heritage earth tones for tonal layering and rare focal moments. Clay stays primary; the support tones never compete for the charge."
      >
        <div>
          <p className="eyebrow mb-4">Core — ratified v0</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Swatch name="paper" hex={c.paper.hex} className="bg-paper" note="substrate" />
            <Swatch name="paper-deep" hex={c.paperDeep.hex} className="bg-paper-deep" note="strip" />
            <Swatch name="ink" hex={c.ink.hex} className="bg-ink" note="text" onDark />
            <Swatch name="ink-soft" hex={c.inkSoft.hex} className="bg-ink-soft" note="secondary" onDark />
            <Swatch name="clay" hex={c.clay.hex} className="bg-clay" note="the charge" onDark />
            <Swatch name="clay-deep" hex={c.clayDeep.hex} className="bg-clay-deep" note="hover" onDark />
            <Swatch name="moss" hex={c.moss.hex} className="bg-moss" note="verified only" onDark />
            <Swatch name="flag" hex={c.flag.hex} className="bg-flag" note="error only" onDark />
            <Swatch name="mute" hex={c.mute.hex} className="bg-mute" note="captions" onDark />
            <Swatch name="rule" hex={c.rule.hex} className="bg-rule" note="hairline" />
          </div>

          <p className="eyebrow mb-4 mt-10">
            Support — added 2026-06-19 · pending Conner sign-off
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <Swatch name="forest" hex={c.forest!.hex} className="bg-forest" note="deep field" onDark />
            <Swatch name="wheat" hex={c.wheat!.hex} className="bg-wheat" note="rare accent" onDark />
            <Swatch name="paper-bright" hex={c.paperBright!.hex} className="bg-paper-bright" note="lift" />
            <Swatch name="clay-wash" hex={c.clayWash!.hex} className="bg-clay-wash" note="band" />
            <Swatch name="mid-rule" hex={c.midRule!.hex} className="bg-mid-rule" note="figure edge" />
          </div>
          <p className="mt-8 max-w-prose text-[13px] leading-relaxed text-mute">
            New tokens are registered through the canonical channel —
            lib/brand/tokens.ts → app/globals.css → tailwind.config.ts →
            tools/brand/brand-gate.mjs — so the brand gate stays green and no
            surface can smuggle an off-token hex.
          </p>
        </div>
      </Section>

      {/* TYPOGRAPHY */}
      <Section
        tone="deep"
        eyebrow="Typography"
        title="Three families, one job each."
        intro="Fraunces sets every heading and the rare display line, loaded with its optical-size axis so big headlines render in the high-contrast broadsheet cut. Inter carries body and UI. JetBrains Mono is reserved for eyebrows, datelines, IDs, and figures. The human flourishes — drop-cap, pull-quote — are Fraunces doing work a template never asks of its type."
      >
        <div className="space-y-8">
          <div className="border border-rule bg-paper p-6 md:p-8">
            <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              Fraunces · display
            </p>
            <p className="mt-3 font-display text-5xl leading-[1.05] text-ink">
              Intelligence rooted in reality.
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              Inter · body
            </p>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              The fleet reads what&apos;s already in your systems, does the work
              that lives between your tools, and lands every result in your
              queue. You stay the only one who hits send.
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              JetBrains Mono · figures + labels
            </p>
            <p className="mt-3 font-mono text-sm text-ink-soft">
              est. 2026 · threshold: low · confidence: 0.92 · 08:12 ET
            </p>
          </div>
        </div>
      </Section>

      {/* THE PULL-QUOTE — the one charge, spent on a focal device */}
      <Section
        eyebrow="Editorial devices"
        title="Spend the one charge on a real focal point."
        intro="Linear and Mailchimp don't tint every block — they save the accent for one device that earns it. The pull-quote is ours: clay-wash ground, clay rule, Fraunces. Use it once on a long page; it IS the clay charge for that view."
      >
        <ApPullQuote cite="Mission · locked 2026-05-11">
          We lift up local businesses by doing the work that takes their time and
          money away from the people they serve.
        </ApPullQuote>
      </Section>

      {/* CARDS — default vs ledger */}
      <Section
        tone="deep"
        eyebrow="Cards"
        title="Hairline by default. A figure frame when we show the real thing."
        intro="The workhorse card is paper with a hairline edge — no shadow, the rule is the edge. The ledger variant (early-Stripe pull) frames a real artifact as a captioned monospace figure on a paper-bright body, lifting tonally with no shadow at all."
      >
        <div className="grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-2">
          <div className="bg-paper-deep p-6 md:p-8">
            <ApPaperCard
              eyebrow="today's progress"
              title="3 drafts ready"
            >
              <p className="text-[15px] leading-relaxed text-ink-soft">
                Your fleet drafted three replies overnight. None flagged.
              </p>
            </ApPaperCard>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              default · the workhorse
            </p>
          </div>
          <div className="bg-paper-deep p-6 md:p-8">
            <ApPaperCard
              variant="ledger"
              eyebrow="draft reply · buyer-inquiry-router · 12 min ago"
            >
              <p className="font-mono text-[13px] leading-relaxed text-ink">
                Hi Sarah — Tuesday 10:30 works on our side. I&apos;ll confirm the
                listing agent and circle back by EOD with the disclosure packet.
              </p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                threshold: low · confidence: 0.92
              </p>
            </ApPaperCard>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              ledger · a real artifact, framed
            </p>
          </div>
        </div>
      </Section>

      {/* BUTTONS */}
      <Section
        eyebrow="Buttons"
        title="Square, plain, confident — never a rounded pill."
        intro="Verb-led, lowercase labels. The lg size is the confident heritage CTA for a single hero moment; one per fold, never stacked."
      >
        <div className="flex flex-wrap items-center gap-4 border border-rule bg-paper p-6 md:p-8">
          <ApHeritageButton variant="primary" withArrow>
            approve draft
          </ApHeritageButton>
          <ApHeritageButton variant="secondary">connect gmail</ApHeritageButton>
          <ApHeritageButton variant="ghost" withArrow>
            see fleet
          </ApHeritageButton>
          <ApHeritageButton variant="primary" size="lg" withArrow>
            open workspace
          </ApHeritageButton>
        </div>
      </Section>

      {/* LOADING — Plaino persona moment */}
      <Section
        tone="deep"
        eyebrow="Loading"
        title="No spinner. A working dog and a hairline strip."
        intro="Generic SaaS fills the dead loading slot with a pulsing gradient skeleton. We fill it with Plaino actually at work — posture matched to the task — beside the quiet clay strip that reports what's really happening. The robot-dog precedents (Boston Dynamics, Aibo) are the proof: warmth comes from posture, not a face."
      >
        <div className="space-y-6 border border-rule bg-paper p-6 md:p-8">
          <ApPlainoLoader kind="drafting" />
          <div className="rule" />
          <ApPlainoLoader kind="reading-queue" />
          <div className="rule" />
          <ApPlainoLoader kind="first-load" />
          <div className="rule" />
          <div>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              the strip alone, under 800ms
            </p>
            <ApRootedLoader kind="connecting" />
          </div>
        </div>
      </Section>

      {/* PHOTO TREATMENT */}
      <Section
        eyebrow="Imagery"
        title="One warm grade, so one hand looks like it shot everything."
        intro="MUJI and Patagonia never let two images fight. The .img-heritage grade applies a single warm desaturation + gentle contrast to any real photography, framed paper-deep with a mono caption so it reads as an editorial figure, not a background texture. (Shown here on the Plaino heritage illustration as a stand-in until real photography ships.)"
      >
        <figure className="m-0 max-w-xl">
          <div className="border border-rule bg-paper-deep">
            {/* eslint-disable-next-line @next/next/no-img-element -- local brand
                raster; next/image avoided product-wide (see Plaino.tsx) */}
            <img
              src="/brand/plaino-system/heritage.png"
              alt="Plaino standing watch over a working plain at first light, shown with the heritage photo grade."
              className="img-heritage block h-auto w-full object-contain"
              width={495}
              height={235}
            />
          </div>
          <figcaption className="mt-3 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            .img-heritage · warm grade + paper-deep frame
          </figcaption>
        </figure>
      </Section>

      {/* THE CONTRAST — generic SaaS does X, we do Y */}
      <Section
        tone="deep"
        eyebrow="The line"
        title="Generic SaaS does X. We do Y."
        intro="The whole point, made literal. Each row is a place where the default machine-extruded move would have read as AI — and the heritage move we make instead."
      >
        <div className="space-y-px">
          <ContrastRow
            saas="Diagonal blue-to-purple gradient hero with a 3D-rendered abstract shape and a centered headline."
            us="Paper ground, one serif headline left-aligned, a dateline, and a single contained heritage figure with a mono caption."
          />
          <ContrastRow
            saas="Cards floating on drop-shadows; deeply rounded corners; hover lifts the card with a bigger shadow."
            us="Square corners, hairline rule for the edge, hover darkens the border. The ledger card lifts by warmth, not shadow."
          />
          <ContrastRow
            saas="A pill-shaped CTA in a saturated brand-blue, sentence-case 'Get Started!' with an exclamation."
            us="Square clay button, verb-led lowercase 'open workspace'. The accent is spent once per view."
          />
          <ContrastRow
            saas="A pulsing skeleton-card shimmer or a spinning ring while data loads, captioned 'Loading…'."
            us="A hairline clay strip that says what's actually happening, with Plaino in a matching working pose."
          />
          <ContrastRow
            saas="Stock photography of diverse people smiling at laptops, or an AI-orb mascot glowing in the corner."
            us="Real photography under one warm grade, framed as a figure — or Plaino, whose warmth is posture, never a face."
          />
          <ContrastRow
            saas="Twelve KPI tiles in a 4×3 grid, every one a different accent color, badges and 'new!' pills everywhere."
            us="Three numbers and a list. One charge. The work is the proof; nothing badges for attention."
          />
        </div>
        <p className="mt-10 max-w-prose text-[13px] leading-relaxed text-mute">
          Full per-brand findings and the to-borrow list live in
          docs/brand/design-mirror-2026-06-19.md. The component rulebook is
          docs/product-design-language-2026-05-17.md. This page is the living
          proof that the two agree.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <PlainoStatus state="sit" size={28} />
          <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            Plaino, your service partner at agentplain
          </span>
        </div>
      </Section>
    </>
  );
}
