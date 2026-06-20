import type { Metadata } from "next";
import { Fraunces, Newsreader } from "next/font/google";
import "./editorial.css";

// ── Direction 5 — Editorial Newsroom ─────────────────────────────────────────
// A self-contained design exploration: agentplain rendered as a publication you
// would subscribe to, not a SaaS landing page. Layout-as-narrative — a feature
// front, a how-it-works told as a feature story, a vertical told as the story of
// one firm, pricing as a printed rate card, a dashboard as a box-score ledger,
// and Plaino documented through the page like a recurring photographic subject.
//
// SCOPING: everything is namespaced under `.ed5` (see editorial.css). Fonts are
// loaded LOCALLY here, not in app/layout.tsx, so this island ships its editorial
// type without touching shared infrastructure or the brand tokens. Routed under
// (marketing) so it inherits the real chrome; noindex — internal reference.

// Display serif — Fraunces, the ratified brand display, loaded here with its
// optical-size axis + italic so big heds render in the high-contrast broadsheet
// cut. Scoped to this page via --ed-display.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--ed-display",
  display: "swap",
});

// Workmanlike body serif — Newsreader: a magazine text face with a genuine
// italic, used for running copy, decks, captions, and pull-quotes. Scoped via
// --ed-body-font (the brand body face, Inter, is untouched elsewhere).
const body = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--ed-body-font",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Direction 5 — Editorial Newsroom",
  description:
    "A design exploration: agentplain as a publication you'd subscribe to. Statement serif, newsprint palette, layout-as-narrative, Plaino as a recurring photographic subject.",
  robots: { index: false, follow: false },
};

export default function EditorialNewsroomPage() {
  return (
    <div className={`ed5 ${display.variable} ${body.variable}`}>
      <div className="ed5-wrap">
        {/* ══ MASTHEAD ═══════════════════════════════════════════════════════ */}
        <header className="ed5-section" style={{ paddingBottom: "2.5rem" }}>
          <div className="ed5-wide">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <span className="ed5-dateline">Vol. I · No. 5 · Field Edition</span>
              <span className="ed5-dateline">Direction 5 / 5 — Editorial Newsroom</span>
            </div>
            <hr className="ed5-rule--double" style={{ margin: "1.1rem 0 1.4rem" }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <h1 className="ed5-nameplate">agentplain</h1>
              <p
                className="ed5-deck"
                style={{ marginBottom: "0.4rem", fontSize: "1.05rem" }}
              >
                Intelligence rooted in reality.
              </p>
            </div>
            <hr className="ed5-rule--strong" style={{ margin: "1.4rem 0 0" }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
                paddingTop: "0.7rem",
              }}
            >
              <span className="ed5-kicker ed5-kicker--ink">
                The work that takes time away from the people you serve
              </span>
              <span className="ed5-kicker">Read inside →</span>
            </div>
          </div>
        </header>

        {/* ══ HERO — the feature front ═══════════════════════════════════════ */}
        <section className="ed5-section" style={{ paddingTop: 0 }}>
          <div className="ed5-wide">
            <div className="ed5-grid-feature">
              <div>
                <span className="ed5-kicker">The Cover Story</span>
                <h2 className="ed5-hed" style={{ marginTop: "1rem" }}>
                  The office that runs itself overnight, and the one&nbsp;rule that
                  keeps it&nbsp;honest.
                </h2>
                <p className="ed5-deck" style={{ marginTop: "1.4rem" }}>
                  A managed fleet reads what is already in your systems, does the
                  work that lives between your tools, and leaves every result in
                  your queue by morning. You stay the only one who hits send.
                </p>
                <p className="ed5-byline" style={{ marginTop: "1.6rem" }}>
                  By <b>The agentplain Field Desk</b> · Photographs of Plaino on
                  assignment
                </p>
                <div
                  style={{
                    marginTop: "1.8rem",
                    display: "flex",
                    gap: "0.8rem",
                    flexWrap: "wrap",
                  }}
                >
                  <a href="#story" className="ed5-btn">
                    Begin reading →
                  </a>
                  <a href="#rates" className="ed5-btn ed5-btn--ghost">
                    See the rate card
                  </a>
                </div>
              </div>

              <aside>
                <div className="ed5-sidebar">
                  <span className="ed5-kicker">In This Issue</span>
                  <ol
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0.9rem 0 0",
                    }}
                  >
                    {[
                      ["No. 1", "How the fleet works — a field report"],
                      ["No. 2", "A firm of three, and the night shift it never hired"],
                      ["No. 3", "The rate card, printed plainly"],
                      ["No. 4", "The Morning Ledger"],
                      ["No. 5", "Plaino, photographed"],
                    ].map(([no, title]) => (
                      <li
                        key={no}
                        style={{
                          display: "flex",
                          gap: "0.8rem",
                          padding: "0.6rem 0",
                          borderTop: "1px solid var(--news-rule)",
                          alignItems: "baseline",
                        }}
                      >
                        <span
                          className="ed5-kicker ed5-kicker--ink"
                          style={{ minWidth: "3ch" }}
                        >
                          {no}
                        </span>
                        <span style={{ fontSize: "1rem", lineHeight: 1.3 }}>
                          {title}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </aside>
            </div>
          </div>

          {/* Full-bleed feature photograph */}
          <figure className="ed5-figure" style={{ marginTop: "2.6rem" }}>
            <div className="ed5-bleed">
              {/* eslint-disable-next-line @next/next/no-img-element -- local brand
                  raster, documentary grade applied in-CSS */}
              <img
                src="/brand/plaino-system/heritage.png"
                alt="Plaino standing watch over a working plain at first light."
              />
            </div>
            <div className="ed5-wide" style={{ marginTop: "0.7rem" }}>
              <figcaption className="ed5-caption">
                <b>Fig. 1</b> Plaino keeps the first watch over the plain at dawn,
                before the inbox wakes. <em>Photograph on assignment, Field Desk.</em>
              </figcaption>
            </div>
          </figure>
        </section>

        <div className="ed5-wide">
          <hr className="ed5-rule" />
        </div>

        {/* ══ STORY / HOW IT WORKS — feature report ═════════════════════════ */}
        <section id="story" className="ed5-section">
          <div className="ed5-wide">
            <span className="ed5-kicker">No. 1 — Feature Report</span>
            <h2 className="ed5-hed--story" style={{ marginTop: "0.9rem", maxWidth: "26ch" }}>
              How the fleet actually works, told from the floor.
            </h2>
          </div>

          <div className="ed5-measure" style={{ marginTop: "2rem" }}>
            <div className="ed5-body">
              <p className="ed5-lede ed5-dropcap">
                Most software arrives as a dashboard and a promise. The promise is
                that you will have time, once you finish the setup. The fleet
                arrives differently. It reads the systems you already keep — the
                inbox, the calendar, the books — and starts doing the work that
                lives in the gaps between them, the chasing and the drafting and
                the reconciling that no one was ever hired to love.
              </p>
              <p>
                There is one rule, and the whole product hangs on it: nothing
                leaves without you. The fleet drafts. It files. It flags what it is
                unsure of. Then it stops at the edge of your name and waits. You
                read three things over coffee and decide which of them is true.
              </p>
            </div>
          </div>

          {/* Three numbered chapters, each with a documentary photo */}
          <div className="ed5-wide" style={{ marginTop: "3rem" }}>
            <hr className="ed5-rule" style={{ marginBottom: "2.4rem" }} />
            <div className="ed5-grid-chapters">
              {[
                {
                  no: "01",
                  pose: "scouting.png",
                  cap: "Plaino on the maintenance route",
                  head: "It reads what is already there.",
                  body:
                    "No migration, no fresh data entry. The fleet connects to the tools you run today and reads them in flight — it never copies your records into a vault it then has to defend.",
                },
                {
                  no: "02",
                  pose: "herding.png",
                  cap: "Plaino moving the day's work into one place",
                  head: "It does the work between the tools.",
                  body:
                    "The invoice that needs chasing, the inquiry that needs a reply, the close that needs reconciling. The fleet handles the connective tissue — the labor that is real but never sat in one app.",
                },
                {
                  no: "03",
                  pose: "sitting-alert.png",
                  cap: "Plaino at the queue, waiting for the word",
                  head: "It stops at your name.",
                  body:
                    "Every result lands in a queue as a draft, with its reasoning shown plainly. You approve, edit, or decline. The decline is generative: it names the gap and offers to close it.",
                },
              ].map((ch) => (
                <article key={ch.no}>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      alignItems: "baseline",
                    }}
                  >
                    <span className="ed5-chapno">{ch.no}</span>
                    <h3 className="ed5-subhed" style={{ paddingTop: "0.3rem" }}>
                      {ch.head}
                    </h3>
                  </div>
                  <figure className="ed5-figure" style={{ margin: "1.2rem 0" }}>
                    <div className="ed5-figure-frame">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/brand/plaino-system/poses/${ch.pose}`}
                        alt={ch.cap}
                        style={{ maxHeight: "200px", objectFit: "contain", margin: "0 auto" }}
                      />
                    </div>
                    <figcaption className="ed5-caption" style={{ marginTop: "0.6rem" }}>
                      <b>Fig. {ch.no}</b> {ch.cap}.
                    </figcaption>
                  </figure>
                  <p style={{ fontSize: "1.02rem" }}>{ch.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PULL QUOTE — the single red charge ════════════════════════════ */}
        <section className="ed5-section" style={{ paddingBlock: "1rem 3.5rem" }}>
          <div className="ed5-measure">
            <blockquote className="ed5-pullquote">
              “We lift up local businesses by doing the work that takes their time
              and money away from the people they serve.”
              <cite>The Mission · locked into the masthead, 2026</cite>
            </blockquote>
          </div>
        </section>

        {/* ══ VERTICAL — the story of a firm (Law) ══════════════════════════ */}
        <section className="ed5-section" style={{ background: "var(--news-paper-2)" }}>
          <div className="ed5-wide">
            <span className="ed5-kicker">No. 2 — The Profile</span>
            <h2 className="ed5-hed--story" style={{ marginTop: "0.9rem", maxWidth: "24ch" }}>
              A firm of three, and the night shift it never had&nbsp;to hire.
            </h2>
            <p className="ed5-byline" style={{ marginTop: "1rem" }}>
              A small-practice profile · Filed from the Law desk
            </p>
            <hr className="ed5-rule" style={{ margin: "1.8rem 0 2.2rem" }} />

            <div className="ed5-grid-feature">
              <div>
                <div className="ed5-body ed5-cols-2">
                  <p className="ed5-lede ed5-dropcap" style={{ columnSpan: "all" }}>
                    The partners at a three-attorney practice did not want more
                    software. They wanted Thursdays back. The intake forms came in
                    at all hours and sat until someone had a free morning; by then
                    the client had called twice and the goodwill was spent.
                  </p>
                  <p>
                    The fleet took the part no one wanted. Overnight it triaged the
                    new intakes, drafted the conflict-check requests, assembled the
                    engagement letters from the firm&rsquo;s own templates, and
                    laid each one in the queue with the matter summarized at the
                    top.
                  </p>
                  <p>
                    Nothing was sent. A partner read the queue with her coffee,
                    approved four, edited one, and declined the fifth because the
                    conflict was real — exactly the judgment the fleet had flagged
                    and left for a person to make.
                  </p>
                  <p>
                    By the second week the Thursday backlog was a memory. The work
                    that used to eat the morning now arrived already done, waiting
                    only for a name on it.
                  </p>
                </div>

                <figure className="ed5-figure" style={{ marginTop: "2rem" }}>
                  <div className="ed5-figure-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/brand/illustrations/law/step-2.svg"
                      alt="The fleet assembling an engagement letter from the firm's templates."
                      style={{ maxHeight: "300px", objectFit: "contain", margin: "0 auto" }}
                    />
                  </div>
                  <figcaption className="ed5-caption" style={{ marginTop: "0.7rem" }}>
                    <b>Plaino at the firm</b> Drafting the engagement letter from
                    the practice&rsquo;s own forms — never from a template it
                    invented.
                  </figcaption>
                </figure>
              </div>

              <aside>
                <div className="ed5-sidebar">
                  <span className="ed5-kicker">The Ledger of One Night</span>
                  <ul style={{ listStyle: "none", padding: 0, margin: "1rem 0 0" }}>
                    {[
                      ["7", "intakes triaged before 7 a.m."],
                      ["5", "engagement letters drafted"],
                      ["1", "conflict flagged for the partner"],
                      ["0", "sent without a human"],
                    ].map(([n, l]) => (
                      <li
                        key={l}
                        style={{
                          display: "flex",
                          gap: "0.9rem",
                          alignItems: "baseline",
                          padding: "0.7rem 0",
                          borderTop: "1px solid var(--news-rule)",
                        }}
                      >
                        <span className="ed5-ledger-num">{n}</span>
                        <span style={{ fontSize: "0.98rem", lineHeight: 1.3 }}>
                          {l}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p
                    className="ed5-caption"
                    style={{ marginTop: "1rem", fontStyle: "italic" }}
                  >
                    The fifth letter is the point. The fleet earns trust by being
                    the thing that stops.
                  </p>
                </div>
                <p className="ed5-continued" style={{ marginTop: "1.2rem" }}>
                  Continued on the rate card →
                </p>
              </aside>
            </div>
          </div>
        </section>

        {/* ══ PRICING — the rate card ═══════════════════════════════════════ */}
        <section id="rates" className="ed5-section">
          <div className="ed5-measure">
            <div style={{ textAlign: "center" }}>
              <span className="ed5-kicker">No. 3 — Rate Card</span>
              <h2 className="ed5-hed--story" style={{ marginTop: "0.9rem" }}>
                Subscriptions, printed plainly.
              </h2>
              <p className="ed5-deck" style={{ marginTop: "1rem", fontStyle: "italic" }}>
                Per month. Cancel anytime. The work is the proof — there is no
                tier that charges you for hope.
              </p>
            </div>

            <div className="ed5-ratecard" style={{ marginTop: "2.4rem" }}>
              {[
                {
                  name: "Trial Edition",
                  price: "$0",
                  unit: "/ 7 days",
                  desc: "A full week of the fleet at work in your own systems, so the first value arrives before the first invoice.",
                },
                {
                  name: "Standard Subscription",
                  price: "$—",
                  unit: "/ month",
                  desc: "The managed fleet for one vertical: installed, run, and tuned for your practice. Every result lands in your queue.",
                },
                {
                  name: "Full Press",
                  price: "$—",
                  unit: "/ month",
                  desc: "Priority service, a quarterly check-in with a human, and the connectors your work depends on, kept current.",
                },
                {
                  name: "Custom Bureau",
                  price: "By arrangement",
                  unit: "",
                  desc: "For firms that want the fleet shaped to a workflow of their own. Scoped with you, quoted plainly.",
                },
              ].map((tier) => (
                <div className="ed5-raterow" key={tier.name}>
                  <span className="ed5-rate-name">{tier.name}</span>
                  <span className="ed5-rate-price">
                    {tier.price} {tier.unit && <span>{tier.unit}</span>}
                  </span>
                  <span className="ed5-rate-desc">{tier.desc}</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: "2.2rem" }}>
              <a href="#" className="ed5-btn">
                Begin the trial edition →
              </a>
              <p className="ed5-caption" style={{ marginTop: "1rem" }}>
                Prices shown as placeholders in this design exploration. The ladder
                of record lives in the pricing system, not here.
              </p>
            </div>
          </div>
        </section>

        <div className="ed5-wide">
          <hr className="ed5-rule" />
        </div>

        {/* ══ DASHBOARD WIDGET — The Morning Ledger ═════════════════════════ */}
        <section className="ed5-section">
          <div className="ed5-wide">
            <div className="ed5-grid-feature">
              <div>
                <span className="ed5-kicker">No. 4 — The Product, As a Figure</span>
                <h2 className="ed5-hed--story" style={{ marginTop: "0.9rem", maxWidth: "20ch" }}>
                  The Morning Ledger, read like a box score.
                </h2>
                <p className="ed5-deck" style={{ marginTop: "1.2rem" }}>
                  The dashboard refuses the wall of tiles. It is three numbers and a
                  short list — what the fleet did while you slept, and the one thing
                  it needs you to decide.
                </p>
                <p style={{ marginTop: "1.2rem", fontSize: "1.02rem" }}>
                  Set in the same hand as the rest of the page: a ruled table, a
                  mono dateline, the single red number where a decision is owed. It
                  reads as a figure clipped from a publication, not a control panel.
                </p>
              </div>

              <div className="ed5-ledger">
                <div className="ed5-ledger-head">
                  <span className="ed5-kicker ed5-kicker--ink">The Morning Ledger</span>
                  <span className="ed5-ledger-meta">08:12 ET · overnight</span>
                </div>
                {[
                  ["3", "Drafts ready for review", "buyer-inquiry · invoices · intake"],
                  ["2", "Invoices chased on schedule", "no reply yet · day 7 + 14"],
                  ["1", "Flagged — needs your eyes", "possible conflict of interest"],
                ].map(([n, label, meta]) => (
                  <div className="ed5-ledger-row" key={label}>
                    <span className="ed5-ledger-num">{n}</span>
                    <span className="ed5-ledger-label">{label}</span>
                    <span className="ed5-ledger-meta">{meta}</span>
                  </div>
                ))}
                <div
                  style={{
                    padding: "0.9rem 1.2rem",
                    borderTop: "1.5px solid var(--news-ink)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="ed5-ledger-meta">
                    Nothing has been sent. You hold the only pen.
                  </span>
                  <a href="#" className="ed5-readmore">
                    Open the queue →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ PLAINO MOMENT — documentary portrait ══════════════════════════ */}
        <section className="ed5-section ed5-forest">
          <div className="ed5-wide">
            <span className="ed5-kicker ed5-kicker--paper">No. 5 — The Portrait</span>
            <div className="ed5-grid-feature" style={{ marginTop: "1.2rem" }}>
              <figure className="ed5-figure" style={{ order: 2 }}>
                <div className="ed5-figure-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/plaino-system/poses/standing-watch.png"
                    alt="Plaino standing watch at the close of the working day."
                    style={{ maxHeight: "360px", objectFit: "contain", margin: "0 auto" }}
                  />
                </div>
                <figcaption
                  className="ed5-caption"
                  style={{ marginTop: "0.7rem", color: "rgba(245,241,232,0.72)" }}
                >
                  <b>Plaino at the close</b> The last watch of the day, before the
                  queue is handed back to a person.
                </figcaption>
              </figure>

              <div style={{ order: 1 }}>
                <h2 className="ed5-hed--story">Plaino, photographed.</h2>
                <p className="ed5-deck" style={{ marginTop: "1.2rem" }}>
                  Plaino is not a mascot glowing in a corner. He is a working dog,
                  documented through this issue like a recurring subject — at the
                  firm, on the route, at the queue.
                </p>
                <p
                  style={{
                    marginTop: "1.2rem",
                    fontSize: "1.05rem",
                    color: "rgba(245,241,232,0.86)",
                  }}
                >
                  The warmth comes from posture, never from a face. He sits when the
                  work is done and waits for the word. It is the whole brand in one
                  gesture: capable, patient, and the thing that stops.
                </p>
                <div style={{ marginTop: "1.8rem" }}>
                  <a href="#story" className="ed5-btn ed5-btn--onforest">
                    Read the field report again →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ FOOTER — colophon ═════════════════════════════════════════════ */}
        <footer className="ed5-section ed5-forest" style={{ paddingTop: "0", borderTop: "1px solid rgba(245,241,232,0.2)" }}>
          <div className="ed5-wide" style={{ paddingTop: "3rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-end",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <h2 className="ed5-nameplate" style={{ fontSize: "clamp(2rem,5vw,3.2rem)" }}>
                agentplain
              </h2>
              <a href="#" className="ed5-btn ed5-btn--onforest">
                Subscribe — begin →
              </a>
            </div>
            <hr
              className="ed5-rule"
              style={{ borderColor: "rgba(245,241,232,0.25)", margin: "1.6rem 0 2.2rem" }}
            />
            <div className="ed5-foot-grid">
              <div>
                <p className="ed5-colophon">
                  <b>Colophon.</b> This edition is a design exploration —
                  Direction 5 of 5, the Editorial Newsroom. Set in Fraunces and
                  Newsreader, with JetBrains Mono for the datelines. Newsprint
                  cream, ink, one editorial red, forest as the brand anchor.
                </p>
              </div>
              <div>
                <p className="ed5-colophon">
                  <b>The Desks.</b><br />
                  Field Report<br />
                  The Profile — Law<br />
                  Rate Card<br />
                  The Morning Ledger
                </p>
              </div>
              <div>
                <p className="ed5-colophon">
                  <b>Standing Matter.</b><br />
                  Intelligence rooted in reality.<br />
                  Nothing leaves without you.<br />
                  The work is the proof.
                </p>
              </div>
            </div>
            <hr
              className="ed5-rule"
              style={{ borderColor: "rgba(245,241,232,0.25)", margin: "2.2rem 0 1.2rem" }}
            />
            <p className="ed5-colophon" style={{ fontSize: "10px" }}>
              © agentplain · Internal style exploration · Not a customer surface ·
              noindex
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
