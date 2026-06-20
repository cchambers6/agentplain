import type { Metadata } from "next";
import "./styles.css";

// ─────────────────────────────────────────────────────────────────────────────
// Direction 2 — Minimal Engineering
//
// One of five parallel design explorations for the agentplain marketing surface.
// Dark-mode-first, geometric, technical-but-warm — Linear / Stripe / Vercel /
// Notion Calendar / Read.cv lineage. Everything here is SCOPED: styles live in
// ./styles.css under `.d2-root`, the route sits in the chromeless (demos) group,
// and the canonical brand tokens (paper / clay / Fraunces) are untouched.
//
// This is an internal evaluation surface — noindex. CPA is the showcase vertical
// (the engineering-credible audience reads dark dashboards as "serious software").
// No mention of the underlying model vendor on any customer-facing string.
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Direction 2 · Minimal Engineering — design exploration",
  description:
    "Dark-mode-first, geometric, technical-but-warm design exploration for agentplain. Internal reference.",
  robots: { index: false, follow: false },
};

/* ── Geometric icon set (monochrome, stroke-based — never illustrated) ─────── */
const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function ArrowRight() {
  return (
    <svg className="d2-arrow" viewBox="0 0 16 16" width="14" height="14" {...stroke}>
      <path d="M3 8h9" />
      <path d="M8.5 4.5L12 8l-3.5 3.5" />
    </svg>
  );
}
function Check() {
  return (
    <svg viewBox="0 0 16 16" {...stroke} aria-hidden>
      <path d="M3 8.5l3 3 7-7.5" />
    </svg>
  );
}
function MarkGlyph() {
  // The Plaino mark — abstract geometric head: a rounded square enclosing a
  // bracketed "signal" — reads as a build artifact, not a mascot.
  return (
    <svg viewBox="0 0 24 24" {...stroke} aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3.5" />
      <path d="M8 9.5L6 12l2 2.5" />
      <path d="M16 9.5L18 12l-2 2.5" />
      <path d="M10.8 15l2.4-6" />
    </svg>
  );
}

/* how-it-works step glyphs */
function GlyphConnect() {
  return (
    <svg viewBox="0 0 26 26" {...stroke} aria-hidden>
      <circle cx="7" cy="7" r="3" />
      <circle cx="19" cy="19" r="3" />
      <path d="M9 9l8 8" />
      <path d="M19 7h-4a3 3 0 00-3 3v0" />
    </svg>
  );
}
function GlyphReview() {
  return (
    <svg viewBox="0 0 26 26" {...stroke} aria-hidden>
      <rect x="4" y="5" width="18" height="13" rx="2" />
      <path d="M8 10h7M8 13.5h10" />
      <path d="M16.5 20.5l2 2 3.5-3.5" />
    </svg>
  );
}
function GlyphRun() {
  return (
    <svg viewBox="0 0 26 26" {...stroke} aria-hidden>
      <path d="M6 5l9 8-9 8" />
      <path d="M16 21h5" />
    </svg>
  );
}

/* Plaino status states — minimal monochrome */
function StateSit() {
  return (
    <svg viewBox="0 0 36 36" {...stroke} aria-hidden>
      <rect x="9" y="9" width="18" height="14" rx="4" />
      <path d="M13 23v4M23 23v4" />
      <circle cx="14.5" cy="15.5" r="0.4" fill="currentColor" />
      <circle cx="21.5" cy="15.5" r="0.4" fill="currentColor" />
    </svg>
  );
}
function StateFetch() {
  return (
    <svg viewBox="0 0 36 36" {...stroke} aria-hidden>
      <path d="M7 18h13" />
      <path d="M15 12l6 6-6 6" />
      <rect x="24" y="11" width="5" height="14" rx="1.5" />
    </svg>
  );
}
function StateHerd() {
  return (
    <svg viewBox="0 0 36 36" {...stroke} aria-hidden>
      <circle cx="12" cy="14" r="2.4" />
      <circle cx="22" cy="12" r="2.4" />
      <circle cx="24" cy="22" r="2.4" />
      <circle cx="14" cy="23" r="2.4" />
      <path d="M18 9v0" />
      <path d="M12 16.4l1.4 4.6M21.5 14.2L23 19.8" />
    </svg>
  );
}
function StateSleep() {
  return (
    <svg viewBox="0 0 36 36" {...stroke} aria-hidden>
      <rect x="8" y="13" width="20" height="11" rx="5" />
      <path d="M19 9h4l-4 4h4" />
      <path d="M12 18.5h2" />
    </svg>
  );
}

// Tabular sparkline — pure SVG, deterministic points.
function Sparkline() {
  const pts = [42, 38, 46, 40, 52, 49, 61, 58, 70, 66, 78, 88];
  const w = 100;
  const h = 64;
  const max = 100;
  const step = w / (pts.length - 1);
  const path = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(h - (p / max) * (h - 8) - 4).toFixed(1)}`)
    .join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg className="d2-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="d2sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(52,209,126,0.28)" />
          <stop offset="100%" stopColor="rgba(52,209,126,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#d2sparkfill)" stroke="none" />
      <path d={path} fill="none" stroke="#34d17e" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function DirectionTwoMinimalEngineering() {
  return (
    <div className="d2-root">
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header className="d2-hero">
        <div className="d2-shell d2-hero-inner">
          <nav className="d2-eyebrow-row" style={{ marginBottom: 56 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="d2-mark">
                <MarkGlyph />
              </span>
              <span style={{ fontWeight: 600, letterSpacing: "-0.03em", fontSize: 17 }}>
                agentplain
              </span>
              <span className="d2-jump">/ direction-2 · minimal-engineering</span>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <a className="d2-btn d2-btn--ghost" href="#pricing">
                Pricing
              </a>
              <a className="d2-btn" href="#start">
                Sign in <span className="d2-kbd">⌘K</span>
              </a>
            </div>
          </nav>

          <span className="d2-statusline">
            <span className="d2-dot" />
            8 workflows live · last run 40s ago · 0 needing review
          </span>

          <h1 className="d2-h1">
            The back office that runs itself.{" "}
            <em>You approve. It executes.</em>
          </h1>
          <p className="d2-hero-sub">
            agentplain wires your tools into a set of reliable, auditable workflows —
            month-end close, reconciliation, follow-ups — then runs them on a schedule.
            Every action is logged. Nothing leaves without your sign-off.
          </p>

          <div className="d2-hero-cta">
            <a className="d2-btn d2-btn--primary" href="#start">
              Continue <ArrowRight />
            </a>
            <a className="d2-btn d2-btn--ghost" href="#how">
              Read the docs
            </a>
          </div>

          <div className="d2-hero-meta">
            <span>
              <b>14-day</b> trial
            </span>
            <span>
              <b>SOC 2</b>-aligned controls
            </span>
            <span>
              <b>Read-through</b> data — nothing copied to train
            </span>
          </div>
        </div>
      </header>

      <main className="d2-shell">
        {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
        <section className="d2-section" id="how">
          <div className="d2-eyebrow-row">
            <div>
              <span className="d2-kicker">How it works</span>
              <h2 className="d2-h2">Three primitives. No black box.</h2>
            </div>
            <p className="d2-lede">
              Built like infrastructure: connect a source, define what good looks like,
              let it run. You stay in the loop on anything that touches the outside world.
            </p>
          </div>

          <div className="d2-steps">
            <div className="d2-step">
              <span className="d2-step-glyph">
                <GlyphConnect />
              </span>
              <span className="d2-step-n">01 — connect</span>
              <h3>Plug in your stack</h3>
              <p>
                OAuth into your ledger, inbox, and CRM. Tokens are encrypted at rest;
                data is read in-flight, never copied into a training set.
              </p>
            </div>
            <div className="d2-step">
              <span className="d2-step-glyph">
                <GlyphReview />
              </span>
              <span className="d2-step-n">02 — define</span>
              <h3>Set the guardrails</h3>
              <p>
                Pick the workflows and the approval threshold. Below the line it acts;
                above it, it drafts and waits for you. One toggle per workflow.
              </p>
            </div>
            <div className="d2-step">
              <span className="d2-step-glyph">
                <GlyphRun />
              </span>
              <span className="d2-step-n">03 — run</span>
              <h3>Watch it work</h3>
              <p>
                Every run writes an immutable log line: input, action, result. Replay
                it, audit it, or hand it to your accountant unchanged.
              </p>
            </div>
          </div>
        </section>

        {/* ── VERTICAL BLOCK — CPA ───────────────────────────────────────── */}
        <section className="d2-section" id="cpa">
          <div className="d2-split">
            <div>
              <span className="d2-kicker">For accounting firms</span>
              <h2 className="d2-h2">Close the month while you sleep.</h2>
              <p className="d2-lede" style={{ marginTop: 16 }}>
                Reconciliation, accruals, and the chase for missing receipts — the
                repetitive 60% of close, handled and itemized for your review by 9am.
              </p>
              <ul className="d2-feature-list">
                <li>
                  <span className="d2-check">
                    <Check />
                  </span>
                  <span>
                    <b>Bank &amp; ledger reconciliation</b> — matches transactions, flags the
                    exceptions, never the matches.
                  </span>
                </li>
                <li>
                  <span className="d2-check">
                    <Check />
                  </span>
                  <span>
                    <b>Receipt &amp; document chase</b> — emails the client, files what comes
                    back, follows up on what doesn&apos;t.
                  </span>
                </li>
                <li>
                  <span className="d2-check">
                    <Check />
                  </span>
                  <span>
                    <b>Working-paper trail</b> — every entry carries a citation back to the
                    source, ready for review or audit.
                  </span>
                </li>
              </ul>
            </div>

            {/* run log — looks like real machine output */}
            <div className="d2-runlog">
              <div className="d2-runlog-bar">
                <span className="d2-traffic">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="d2-tld">close · march · run #114</span>
              </div>
              <div className="d2-runlog-body">
                <div className="d2-logrow">
                  <span className="d2-ts">08:00:02</span>
                  <span className="d2-msg">
                    <b>reconcile</b> operating · 412 txns
                  </span>
                  <span className="d2-tag d2-tag--ok">matched 408</span>
                </div>
                <div className="d2-logrow">
                  <span className="d2-ts">08:00:09</span>
                  <span className="d2-msg">4 exceptions queued for review</span>
                  <span className="d2-tag d2-tag--hold">hold</span>
                </div>
                <div className="d2-logrow">
                  <span className="d2-ts">08:01:24</span>
                  <span className="d2-msg">
                    <b>accruals</b> posted · payroll, rent, SaaS
                  </span>
                  <span className="d2-tag d2-tag--ok">ok</span>
                </div>
                <div className="d2-logrow">
                  <span className="d2-ts">08:01:51</span>
                  <span className="d2-msg">3 receipts missing · client emailed</span>
                  <span className="d2-tag d2-tag--ok">sent</span>
                </div>
                <div className="d2-logrow">
                  <span className="d2-ts">08:02:03</span>
                  <span className="d2-msg">
                    working papers compiled · <b>PDF</b>
                  </span>
                  <span className="d2-tag d2-tag--ok">ready</span>
                </div>
                <div className="d2-logrow">
                  <span className="d2-ts">08:02:03</span>
                  <span className="d2-msg" style={{ color: "var(--d2-text-mute)" }}>
                    run complete · 2m 01s · awaiting your review
                  </span>
                  <span className="d2-tag">idle</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── DASHBOARD WIDGET ───────────────────────────────────────────── */}
        <section className="d2-section" id="dashboard">
          <span className="d2-kicker">The console</span>
          <h2 className="d2-h2">Information-dense, never noisy.</h2>
          <p className="d2-lede" style={{ marginTop: 14 }}>
            Tabular numbers, hairline rules, one accent for signal. Switch views —
            it&apos;s instant, and it&apos;s all keyboard-reachable.
          </p>

          {/* CSS-only tabs: radios are siblings of .d2-dash, no JS needed */}
          <input type="radio" name="d2-dashtab" id="d2-tab-ledger" defaultChecked />
          <input type="radio" name="d2-dashtab" id="d2-tab-cash" />
          <input type="radio" name="d2-dashtab" id="d2-tab-tasks" />

          <div className="d2-dash">
            <div className="d2-dash-head">
              <div className="d2-dash-title">
                <span className="d2-mark" style={{ width: 26, height: 26 }}>
                  <MarkGlyph />
                </span>
                <div>
                  <h3>Firm overview</h3>
                  <span className="d2-sub">workspace · brightline-cpa</span>
                </div>
              </div>
              <div className="d2-tabs" role="tablist">
                <label htmlFor="d2-tab-ledger">Ledger</label>
                <label htmlFor="d2-tab-cash">Cash</label>
                <label htmlFor="d2-tab-tasks">Tasks</label>
              </div>
            </div>

            <div className="d2-dash-grid">
              <div className="d2-metric">
                <div className="d2-label">Hours saved · MTD</div>
                <div className="d2-val">126.5</div>
                <span className="d2-delta d2-delta--up">▲ 18% vs feb</span>
              </div>
              <div className="d2-metric">
                <div className="d2-label">Auto-reconciled</div>
                <div className="d2-val">98.4%</div>
                <span className="d2-delta d2-delta--up">▲ 1.2 pts</span>
              </div>
              <div className="d2-metric">
                <div className="d2-label">Needs review</div>
                <div className="d2-val">7</div>
                <span className="d2-delta d2-delta--down">▼ 4 since 8am</span>
              </div>
            </div>

            {/* LEDGER panel */}
            <div className="d2-tabpanel" data-panel="ledger">
              <table className="d2-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th className="d2-hide-sm">Workflow</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Exceptions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="d2-acct">Northgate Dental</td>
                    <td className="d2-hide-sm">Month-end close</td>
                    <td>
                      <span className="d2-pill d2-pill--ok">posted</span>
                    </td>
                    <td className="d2-num">0</td>
                  </tr>
                  <tr>
                    <td className="d2-acct">Harlow &amp; Co</td>
                    <td className="d2-hide-sm">Reconciliation</td>
                    <td>
                      <span className="d2-pill d2-pill--review">review</span>
                    </td>
                    <td className="d2-num">4</td>
                  </tr>
                  <tr>
                    <td className="d2-acct">Verde Logistics</td>
                    <td className="d2-hide-sm">Receipt chase</td>
                    <td>
                      <span className="d2-pill d2-pill--wait">waiting</span>
                    </td>
                    <td className="d2-num">3</td>
                  </tr>
                  <tr>
                    <td className="d2-acct">Pine St Realty</td>
                    <td className="d2-hide-sm">Month-end close</td>
                    <td>
                      <span className="d2-pill d2-pill--ok">posted</span>
                    </td>
                    <td className="d2-num">0</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* CASH panel */}
            <div className="d2-tabpanel" data-panel="cash">
              <div style={{ padding: "20px 20px 8px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--d2-mono)",
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--d2-text-mute)",
                    }}
                  >
                    Cash on hand · trailing 12 weeks
                  </span>
                  <span
                    style={{
                      fontVariantNumeric: "tabular-nums",
                      fontWeight: 580,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    $284,910
                  </span>
                </div>
                <Sparkline />
              </div>
              <table className="d2-table">
                <tbody>
                  <tr>
                    <td className="d2-acct">Receivables · 30d</td>
                    <td className="d2-hide-sm" style={{ color: "var(--d2-text-mute)" }}>
                      12 invoices
                    </td>
                    <td className="d2-num">$61,400</td>
                  </tr>
                  <tr>
                    <td className="d2-acct">Payables · due 7d</td>
                    <td className="d2-hide-sm" style={{ color: "var(--d2-text-mute)" }}>
                      5 bills
                    </td>
                    <td className="d2-num">$22,180</td>
                  </tr>
                  <tr>
                    <td className="d2-acct">Runway</td>
                    <td className="d2-hide-sm" style={{ color: "var(--d2-text-mute)" }}>
                      at current burn
                    </td>
                    <td className="d2-num">14.2 mo</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* TASKS panel */}
            <div className="d2-tabpanel" data-panel="tasks">
              <table className="d2-table">
                <thead>
                  <tr>
                    <th>Awaiting you</th>
                    <th className="d2-hide-sm">Raised</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="d2-acct">Approve 4 reclassified entries · Harlow</td>
                    <td className="d2-hide-sm" style={{ color: "var(--d2-text-mute)" }}>
                      08:00
                    </td>
                    <td className="d2-num">
                      <span className="d2-pill d2-pill--review">review</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="d2-acct">Confirm vendor W-9 · new payee</td>
                    <td className="d2-hide-sm" style={{ color: "var(--d2-text-mute)" }}>
                      08:14
                    </td>
                    <td className="d2-num">
                      <span className="d2-pill d2-pill--review">review</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="d2-acct">Send March close packet · Northgate</td>
                    <td className="d2-hide-sm" style={{ color: "var(--d2-text-mute)" }}>
                      08:02
                    </td>
                    <td className="d2-num">
                      <span className="d2-pill d2-pill--ok">ready</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── PRICING ────────────────────────────────────────────────────── */}
        <section className="d2-section" id="pricing">
          <div className="d2-eyebrow-row">
            <div>
              <span className="d2-kicker">Pricing</span>
              <h2 className="d2-h2">One flat fee. Done-for-you.</h2>
            </div>
            <p className="d2-lede">
              No seats, no metered tokens, no surprise overage. The model runs on our
              keys — your bill doesn&apos;t move when the work does.
            </p>
          </div>

          <div className="d2-price-wrap">
            <div className="d2-price">
              <span className="d2-price-name">Starter</span>
              <div className="d2-price-amt">
                $199<span>/mo</span>
              </div>
              <p className="d2-price-desc">
                One vertical workflow, set up for you. For the solo operator getting
                hours back.
              </p>
              <ul>
                <li>
                  <Check /> 1 active workflow
                </li>
                <li>
                  <Check /> Daily scheduled runs
                </li>
                <li>
                  <Check /> Full audit log
                </li>
                <li>
                  <Check /> Email support
                </li>
              </ul>
              <a className="d2-btn d2-btn--ghost" href="#start">
                Continue
              </a>
            </div>

            <div className="d2-price d2-price--feat">
              <span className="d2-price-badge">Most firms pick this</span>
              <span className="d2-price-name">Operator</span>
              <div className="d2-price-amt">
                $499<span>/mo</span>
              </div>
              <p className="d2-price-desc">
                The full back office — multiple workflows, your guardrails, our team
                keeping it tuned.
              </p>
              <ul>
                <li>
                  <Check /> Up to 6 workflows
                </li>
                <li>
                  <Check /> Approval thresholds per workflow
                </li>
                <li>
                  <Check /> Connected ledger, inbox &amp; CRM
                </li>
                <li>
                  <Check /> Working-paper exports
                </li>
                <li>
                  <Check /> Priority support · quarterly check-in
                </li>
              </ul>
              <a className="d2-btn d2-btn--primary" href="#start">
                Continue <ArrowRight />
              </a>
            </div>

            <div className="d2-price">
              <span className="d2-price-name">Custom</span>
              <div className="d2-price-amt">Let&apos;s talk</div>
              <p className="d2-price-desc">
                Multi-entity firms and bespoke workflows. Scoped with a human, priced
                flat.
              </p>
              <ul>
                <li>
                  <Check /> Unlimited workflows
                </li>
                <li>
                  <Check /> Dedicated build &amp; review
                </li>
                <li>
                  <Check /> SSO &amp; data-residency options
                </li>
                <li>
                  <Check /> Named operator
                </li>
              </ul>
              <a className="d2-btn d2-btn--ghost" href="#start">
                Book a call
              </a>
            </div>
          </div>
        </section>

        {/* ── PLAINO MOMENT ──────────────────────────────────────────────── */}
        <section className="d2-section" id="plaino">
          <div className="d2-plaino">
            <div>
              <span className="d2-kicker">Meet Plaino</span>
              <p className="d2-editorial">
                Plaino isn&apos;t a chatbot. It&apos;s the operator that{" "}
                <em>watches the work</em> — and only ever asks when it should.
              </p>
              <div className="d2-plaino-states">
                <div className="d2-state">
                  <StateSit />
                  <div className="d2-state-name">sit</div>
                </div>
                <div className="d2-state">
                  <StateFetch />
                  <div className="d2-state-name">fetch</div>
                </div>
                <div className="d2-state">
                  <StateHerd />
                  <div className="d2-state-name">herd</div>
                </div>
                <div className="d2-state">
                  <StateSleep />
                  <div className="d2-state-name">sleep</div>
                </div>
              </div>
            </div>

            <div className="d2-console">
              <div className="d2-runlog-bar">
                <span className="d2-mark" style={{ width: 22, height: 22, borderRadius: 6 }}>
                  <MarkGlyph />
                </span>
                <span className="d2-tld">plaino · live</span>
              </div>
              <div className="d2-console-body">
                <div className="d2-msg-row">
                  <span className="d2-avatar">You</span>
                  <span className="d2-bubble">
                    Anything on Harlow before I send the close?
                  </span>
                </div>
                <div className="d2-msg-row">
                  <span className="d2-avatar d2-avatar--ai">
                    <MarkGlyph />
                  </span>
                  <span className="d2-bubble">
                    Four entries reclassified — all under your{" "}
                    <span className="d2-mono">$2k</span> threshold, so I&apos;ve drafted
                    them, not posted. <b>Two need a glance:</b> a duplicate vendor and a
                    prepaid that spans the quarter. Want them side-by-side?
                  </span>
                </div>
              </div>
              <div className="d2-console-input">
                <span className="d2-prompt">›</span>
                <span className="d2-placeholder">Show me the two</span>
                <span className="d2-caret" />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="d2-footer" id="start">
        <div className="d2-shell">
          <div className="d2-footer-grid">
            <div className="d2-footer-brand">
              <span className="d2-wordmark">agentplain</span>
              <p>
                Intelligence rooted in reality. The done-for-you back office for local
                businesses — set up by people, run on a schedule, audited by default.
              </p>
            </div>
            <div className="d2-footer-col">
              <h4>Product</h4>
              <a href="#how">How it works</a>
              <a href="#dashboard">The console</a>
              <a href="#pricing">Pricing</a>
              <a href="#cpa">For accountants</a>
            </div>
            <div className="d2-footer-col">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Security</a>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
            <div className="d2-footer-col">
              <h4>Get started</h4>
              <a href="#start">Start a trial</a>
              <a href="#start">Book a call</a>
              <a href="#start">Sign in</a>
            </div>
          </div>
          <div className="d2-footer-bottom">
            <span>© 2026 agentplain · built in Georgia</span>
            <span className="d2-footer-status">
              <span className="d2-dot" /> all systems operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
