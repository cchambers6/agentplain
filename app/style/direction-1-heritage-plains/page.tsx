import type { Metadata } from "next";
import Link from "next/link";
import "./styles.css";

// ============================================================================
// Direction 1 — Heritage Plains Editorial
// A self-contained, end-to-end demo of one complete visual treatment for
// agentplain. Nothing here imports the live brand tokens or components; the look
// is built entirely from the scoped `.heritage` system in ./styles.css so it
// can sit beside the other four directions without bleeding.
//
// Inspiration: Patagonia / Pendleton / Filson catalogs, Cormac McCarthy book
// design, vintage Sears catalogs, WPA national-park posters. Real American
// heartland — weathered, plainspoken, earned.
// ============================================================================

export const metadata: Metadata = {
  title: "Direction 1 — Heritage Plains Editorial",
  description:
    "A complete visual treatment for agentplain: serif editorial, earth-tone palette, paper grain, plainspoken voice.",
  robots: { index: false, follow: false },
};

// WPA national-park-poster Plaino: a working dog on the porch, watching the
// horizon. Flat geometric shapes, three inks, confident not cute. In production
// this style would be illustrated by a person; this is the direction, drawn to
// scale so the treatment reads honestly.
function PlainoPoster({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 600"
      className={className}
      role="img"
      aria-label="Heritage-poster illustration of Plaino, a working dog, watching the horizon from a porch"
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <rect width="480" height="600" fill="#f5f0e6" />
      {/* sky bands */}
      <rect x="28" y="28" width="424" height="364" fill="#e7dcc4" />
      <rect x="28" y="28" width="424" height="120" fill="#d9c79e" />
      {/* sun */}
      <circle cx="240" cy="150" r="58" fill="#c8a24a" />
      <circle cx="240" cy="150" r="58" fill="none" stroke="#1a1612" strokeWidth="2" opacity="0.25" />
      {/* layered hills */}
      <path d="M28 300 C120 250 200 285 280 268 C350 254 420 286 452 270 L452 392 L28 392 Z" fill="#7a8b6f" />
      <path d="M28 332 C120 300 210 330 300 312 C370 300 430 326 452 318 L452 392 L28 392 Z" fill="#3f5c3f" />
      <path d="M28 360 C140 342 240 366 340 352 C400 344 440 360 452 356 L452 392 L28 392 Z" fill="#1f3d2e" />
      {/* porch floor */}
      <rect x="28" y="392" width="424" height="180" fill="#b88a5a" />
      <rect x="28" y="392" width="424" height="180" fill="url(#planks)" opacity="0.5" />
      <defs>
        <pattern id="planks" width="424" height="30" patternUnits="userSpaceOnUse">
          <rect width="424" height="30" fill="none" />
          <line x1="0" y1="29" x2="424" y2="29" stroke="#8a6440" strokeWidth="2" />
        </pattern>
      </defs>
      {/* porch post */}
      <rect x="60" y="200" width="20" height="192" fill="#8a6440" />
      {/* the dog — seated, in profile, watching out */}
      <g fill="#1a1612">
        {/* tail */}
        <path d="M300 470 C330 466 348 448 344 430 C338 452 320 456 304 458 Z" />
        {/* haunch + body */}
        <path d="M250 470 C246 420 262 392 300 392 C326 392 342 410 342 440 C342 462 332 472 318 474 L260 474 C254 474 250 472 250 470 Z" />
        {/* chest + front leg */}
        <path d="M252 470 L252 408 C252 396 258 388 268 388 C276 388 282 394 282 404 L282 470 Z" />
        <rect x="252" y="462" width="34" height="12" />
        {/* neck + head, alert, ears up, facing the sun */}
        <path d="M260 408 C256 388 250 372 236 360 C246 356 256 358 264 366 C268 356 276 350 286 352 C282 364 280 376 282 392 C280 400 272 406 264 408 Z" />
        {/* ear */}
        <path d="M250 360 L238 338 L258 352 Z" />
        {/* snout */}
        <path d="M236 360 L214 356 L216 366 L236 368 Z" />
      </g>
      {/* eye highlight */}
      <circle cx="246" cy="357" r="2.4" fill="#f5f0e6" />
      {/* frame */}
      <rect x="28" y="28" width="424" height="544" fill="none" stroke="#1a1612" strokeWidth="3" />
      <rect x="20" y="20" width="440" height="560" fill="none" stroke="#1a1612" strokeWidth="1" />
    </svg>
  );
}

// Small Plaino bust mark for chat / dashboard headers (same poster language,
// cropped to the head).
function PlainoBust({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      role="img"
      aria-label="Plaino"
      style={{ display: "block", flex: "none" }}
    >
      <rect width="80" height="80" fill="#1f3d2e" />
      <g fill="#f5f0e6">
        <path d="M40 64 C30 64 24 52 24 40 C24 28 30 20 40 20 C50 20 56 28 56 40 C56 52 50 64 40 64 Z" />
      </g>
      <g fill="#1f3d2e">
        <path d="M30 28 L24 16 L36 24 Z" />
        <path d="M50 28 L56 16 L44 24 Z" />
        <circle cx="34" cy="40" r="2.4" />
        <circle cx="46" cy="40" r="2.4" />
        <path d="M40 48 L36 53 L44 53 Z" />
      </g>
    </svg>
  );
}

export default function HeritagePlainsDirection() {
  return (
    <div className="heritage">
      {/* ===== spec strip ===== */}
      <div className="h-spec">
        <div className="h-wrap" style={{ paddingBlock: "1.1rem" }}>
          <div className="h-flex" style={{ justifyContent: "space-between" }}>
            <span className="h-eyebrow" style={{ color: "#c8a24a" }}>
              Direction 1 / 5 — Heritage Plains Editorial
            </span>
            <Link href="/style/directions" className="h-caption" style={{ color: "#cdd8cb" }}>
              ← all directions
            </Link>
          </div>
          <div className="h-swatch-row h-mt-3">
            {[
              ["Forest", "#1f3d2e", "#f5f0e6"],
              ["Clay", "#b85540", "#f5f0e6"],
              ["Cream", "#f5f0e6", "#1a1612"],
              ["Ink", "#1a1612", "#f5f0e6"],
              ["Dust", "#9c8b73", "#1a1612"],
              ["Sage", "#7a8b6f", "#1a1612"],
              ["Wheat", "#c8a24a", "#1a1612"],
            ].map(([name, bg, fg]) => (
              <div key={name} className="h-swatch" style={{ background: bg, color: fg }}>
                <span>{name}</span>
                <span style={{ opacity: 0.7 }}>{bg}</span>
              </div>
            ))}
          </div>
          <p className="h-caption h-mt-2" style={{ color: "#9c8b73" }}>
            Fraunces (display) · Inter (body) · JetBrains Mono (small print) ·
            square corners · paper grain · letterpress headings
          </p>
        </div>
      </div>

      {/* ===== hero ===== */}
      <header className="h-section h-section--flush">
        <div className="h-wrap">
          <div className="h-grid h-hero-grid">
            <div>
              <span className="h-eyebrow">Built on real work · Ten trades</span>
              <h1 className="h-display h-display--xl h-mt-3">
                The work that
                <br />
                eats your day,
                <br />
                <span className="h-forest-text">done by morning.</span>
              </h1>
              <p className="h-lede h-mt-4">
                agentplain runs a small crew of trained assistants inside your
                business — drafting, chasing, filing, scheduling. You read the
                work and sign off. Nothing leaves without you.
              </p>
              <div className="h-flex h-mt-4">
                <a className="h-btn h-btn--primary" href="#pricing">
                  Get started
                </a>
                <a className="h-btn h-btn--ghost" href="#how">
                  See how it works
                </a>
              </div>
              <p className="h-caption h-mt-4">
                $499 to set up · billed only when the work ships · Georgia &amp;
                the Southeast first
              </p>
            </div>

            <figure style={{ margin: 0 }}>
              <div style={{ border: "1px solid var(--h-line-strong)", background: "var(--h-paper-bright)", padding: "0.6rem" }}>
                <PlainoPoster />
              </div>
              <figcaption className="h-caption h-mt-2">
                Fig. 1 — Plaino, your working dog. Watches the horizon, earns its
                keep. (Illustration direction: WPA-poster, commissioned per asset.)
              </figcaption>
            </figure>
          </div>
        </div>
      </header>

      {/* ===== how it works ===== */}
      <section className="h-section" id="how">
        <div className="h-wrap">
          <div className="h-grid h-split-7-5">
            <div>
              <span className="h-eyebrow h-eyebrow--mute">How it works</span>
              <h2 className="h-display h-display--md h-mt-2">
                You hire the crew once. It shows up every day.
              </h2>
              <p className="h-prose h-mt-3">
                No dashboards to learn, no prompts to write. We set the crew up
                around how your business already runs, then it works in the
                background and brings you the finished thing to approve.
              </p>
            </div>
            <div>
              {[
                ["01", "We set it up", "Tell us your trade and connect your tools. We configure the crew around your real workflow — no blank canvas."],
                ["02", "It does the work", "Drafts go out, invoices get chased, the calendar fills. Each task is done end-to-end, not half-finished."],
                ["03", "You sign off", "Everything waits for your yes. Read it, edit a line, approve. Then it ships under your name."],
                ["04", "It remembers", "Every correction sticks. The crew learns your voice and your rules, so next week needs fewer edits."],
              ].map(([num, head, body]) => (
                <div className="h-step" key={num}>
                  <span className="h-step-num">{num}</span>
                  <div>
                    <h3 className="h-headline">{head}</h3>
                    <p className="h-prose h-mt-1" style={{ fontSize: "0.95rem" }}>
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== vertical landing block — Real Estate ===== */}
      <section className="h-section h-panel-forest">
        <div className="h-wrap">
          <span className="h-eyebrow" style={{ color: "#c8a24a" }}>
            For real estate
          </span>
          <div className="h-grid h-cols-2 h-mt-3" style={{ alignItems: "start" }}>
            <div>
              <h2 className="h-display h-display--lg">
                Your listings get the
                <br />
                <span className="h-foil">white-glove</span> treatment.
              </h2>
              <p className="h-lede h-mt-4" style={{ color: "#dfe6dc", maxWidth: "38ch" }}>
                Every lead answered in minutes. Every showing booked. Every
                disclosure where it belongs — long before closing day.
              </p>
              <a className="h-btn h-btn--onforest h-mt-4" href="#pricing">
                Set up your office
              </a>
            </div>
            <div className="h-grid" style={{ gap: "0" }}>
              {[
                ["Lead, answered in 4 min", "A buyer asks about 214 Magnolia at 9:48pm. Plaino replies with the price, the lot, and three showing windows — then drops it in your CRM."],
                ["Showings, on the books", "Back-and-forth handled. The slot lands on your calendar and theirs, with a reminder the morning of."],
                ["Disclosures, accounted for", "The file is built as the deal moves, not scrambled the night before. You see what's missing while there's still time to fix it."],
              ].map(([head, body], i) => (
                <div
                  key={head}
                  style={{
                    borderTop: i === 0 ? "1px solid rgba(245,240,230,0.22)" : "1px solid rgba(245,240,230,0.16)",
                    borderBottom: i === 2 ? "1px solid rgba(245,240,230,0.22)" : "0",
                    padding: "1.1rem 0",
                  }}
                >
                  <h3 className="h-headline" style={{ color: "#f5f0e6" }}>
                    <span className="h-tick" style={{ color: "#c8a24a" }}>✦ </span>
                    {head}
                  </h3>
                  <p className="h-mt-1" style={{ color: "#cdd8cb", fontSize: "0.94rem", maxWidth: "46ch" }}>
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== pricing + dashboard ===== */}
      <section className="h-section" id="pricing">
        <div className="h-wrap">
          <span className="h-eyebrow h-eyebrow--mute">Plain pricing</span>
          <h2 className="h-display h-display--md h-mt-2">
            One crew. One number. No surprises.
          </h2>

          <div className="h-grid h-cols-2 h-mt-6" style={{ alignItems: "start" }}>
            {/* pricing card */}
            <div className="h-price-card">
              <span className="h-price-tag">Most offices pick this</span>
              <span className="h-eyebrow h-eyebrow--mute">The Working Crew</span>
              <div className="h-flex h-mt-2" style={{ alignItems: "baseline", gap: "0.5rem" }}>
                <span className="h-price-amt">$499</span>
                <span className="h-muted" style={{ fontSize: "0.9rem" }}>/ mo · setup billed at close</span>
              </div>
              <p className="h-prose h-mt-2" style={{ fontSize: "0.95rem" }}>
                The full crew, trained for your trade. Everything below is in the
                box — no per-seat math, no add-on menu.
              </p>
              <div className="h-mt-3">
                {[
                  "Lead reply, draft-and-approve",
                  "Invoice + payment chasing",
                  "Scheduling across your calendars",
                  "Document filing & disclosure tracking",
                  "Weekly plain-language report",
                  "A real person on setup and support",
                ].map((f) => (
                  <div className="h-feature" key={f}>
                    <span className="h-tick">✦</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <a className="h-btn h-btn--primary h-mt-4" href="#" style={{ width: "100%", justifyContent: "center" }}>
                Get started
              </a>
              <p className="h-caption h-mt-2" style={{ textAlign: "center" }}>
                7-day trial · cancel anytime · 14-day money-back
              </p>
            </div>

            {/* dashboard widget mockup */}
            <div>
              <span className="h-eyebrow h-eyebrow--mute">What you'd see</span>
              <div className="h-dash h-mt-2">
                <div className="h-dash-head">
                  <div className="h-flex" style={{ gap: "0.6rem" }}>
                    <PlainoBust size={34} />
                    <div>
                      <p style={{ fontWeight: 600, lineHeight: 1.1 }}>Today's crew</p>
                      <p className="h-caption" style={{ marginTop: "2px" }}>Tue · 14 done · 3 waiting on you</p>
                    </div>
                  </div>
                  <span className="h-pill h-pill--done">On track</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--h-line)" }}>
                  <div className="h-stat" style={{ padding: "1.1rem 1.3rem", borderRight: "1px solid var(--h-line)" }}>
                    <span className="h-stat-num">6.5 hrs</span>
                    <span className="h-caption">saved this week</span>
                  </div>
                  <div className="h-stat" style={{ padding: "1.1rem 1.3rem" }}>
                    <span className="h-stat-num">$1,240</span>
                    <span className="h-caption">invoices recovered</span>
                  </div>
                </div>

                {[
                  ["Reply to 3 new buyer leads", "Drafted", "wait"],
                  ["Chase 2 overdue invoices", "Sent", "done"],
                  ["Confirm Thu showings (×4)", "Booked", "done"],
                  ["Pull HOA docs for 214 Magnolia", "Watching", "watch"],
                ].map(([task, state, kind]) => (
                  <div className="h-dash-row" key={task as string}>
                    <span>{task}</span>
                    <span className="h-caption" style={{ color: "var(--h-ink)" }}>{state}</span>
                    <span className={`h-pill h-pill--${kind}`}>
                      {kind === "wait" ? "Needs you" : kind === "done" ? "Done" : "Watching"}
                    </span>
                  </div>
                ))}
                <div style={{ padding: "0.9rem 1.3rem", borderTop: "1px solid var(--h-line)" }}>
                  <a className="h-caption" href="#" style={{ color: "var(--h-clay)" }}>
                    Review 3 drafts waiting →
                  </a>
                </div>
              </div>
              <p className="h-caption h-mt-2">
                Fig. 2 — Dashboard widget. Numbers first, status in plain words,
                the one thing that needs you set apart.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Plaino chat moment ===== */}
      <section className="h-section" style={{ background: "var(--h-cream)" }}>
        <div className="h-wrap">
          <div className="h-grid h-cols-2" style={{ alignItems: "center" }}>
            <div>
              <span className="h-eyebrow h-eyebrow--mute">A moment with Plaino</span>
              <h2 className="h-display h-display--md h-mt-2">
                It asks before it acts.
              </h2>
              <p className="h-prose h-mt-3">
                Plaino talks like a good office manager: short, specific, no
                hedging. When something's ready, it shows you the work and waits
                for your call. The voice stays the same whether it's good news or
                a problem.
              </p>
              <p className="h-caption h-mt-4">
                Tone rules: plainspoken, no exclamation marks, no "Great
                question!", no hype. Owner-to-owner.
              </p>
            </div>

            <div className="h-chat">
              <div className="h-chat-head">
                <PlainoBust size={36} />
                <div>
                  <p style={{ fontWeight: 600, lineHeight: 1.1 }}>Plaino</p>
                  <p className="h-caption" style={{ marginTop: "2px" }}>Working · last action 2 min ago</p>
                </div>
              </div>
              <div className="h-chat-body">
                <div className="h-bubble h-bubble--them">
                  Two invoices are 30 days past due — Carter ($640) and Ruiz
                  ($600). I drafted a firm-but-friendly nudge for each.
                </div>
                <div className="h-chat-card">
                  <div style={{ padding: "0.75rem 0.9rem", borderBottom: "1px solid var(--h-line)" }}>
                    <span className="h-caption">Draft · to Carter Builds LLC</span>
                  </div>
                  <p style={{ padding: "0.75rem 0.9rem", fontSize: "0.9rem", lineHeight: 1.5 }}>
                    Hi Dana — invoice #1184 ($640) was due May 30. Want me to
                    send a card link, or set up a two-payment plan? Either works.
                  </p>
                  <div className="h-flex" style={{ padding: "0.7rem 0.9rem", borderTop: "1px solid var(--h-line)", gap: "0.6rem" }}>
                    <button className="h-btn h-btn--primary" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                      Send both
                    </button>
                    <button className="h-btn h-btn--ghost" style={{ padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
                      Edit
                    </button>
                  </div>
                </div>
                <div className="h-bubble h-bubble--me">Send both. Good wording.</div>
                <div className="h-bubble h-bubble--them">
                  Done — both out. I'll check back Friday and flag anything still
                  open.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== footer ===== */}
      <footer className="h-footer">
        <div className="h-wrap" style={{ paddingBlock: "3.5rem" }}>
          <div className="h-grid h-cols-3" style={{ gap: "2rem" }}>
            <div>
              <p className="h-display h-display--md" style={{ color: "#f5f0e6" }}>
                agentplain
              </p>
              <p className="h-mt-2" style={{ color: "#9eb09c", maxWidth: "30ch" }}>
                We lift up local businesses by doing the work that takes their
                time away from the people they serve.
              </p>
              <p className="h-caption h-mt-4" style={{ color: "#7e9079" }}>
                Intelligence rooted in reality.
              </p>
            </div>
            <div>
              <p className="h-caption" style={{ color: "#7e9079" }}>Product</p>
              <ul className="h-mt-2" style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
                <li><a href="#how">How it works</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#">Real estate</a></li>
                <li><a href="#">All ten trades</a></li>
              </ul>
            </div>
            <div>
              <p className="h-caption" style={{ color: "#7e9079" }}>Company</p>
              <ul className="h-mt-2" style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.5rem" }}>
                <li><a href="#">About</a></li>
                <li><a href="#">Security</a></li>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Talk to a person</a></li>
              </ul>
            </div>
          </div>
          <hr className="h-rule h-mt-6" style={{ background: "rgba(245,240,230,0.16)" }} />
          <p className="h-caption h-mt-3" style={{ color: "#7e9079" }}>
            © agentplain · Georgia &amp; the Southeast · This page is a design
            study (Direction 1 of 5), not a live surface.
          </p>
        </div>
      </footer>
    </div>
  );
}
