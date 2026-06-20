import Link from "next/link";
import {
  PlainoSit,
  PlainoFetch,
  PlainoHerd,
  PlainoSleep,
  PlainoMark,
} from "./plaino-pictograms";

/* =====================================================================
   DIRECTION 4 — BOLD WORKING-CLASS  ·  full single-page showcase
   Hero → How it works → Property Management → Pricing → Dashboard widget
   → Plaino moment → Footer. All copy is bold but professional — confident,
   never bro. Buttons say what they do. Done. Next.
   ===================================================================== */

export default function Direction4Page() {
  return (
    <div className="d4-shell">
      {/* ---------- top spec bar ---------- */}
      <div className="d4-topbar">
        <div className="d4-wrap">
          <span>★ BUILT FOR LOCAL BUSINESSES</span>
          <span>NOTHING LEAVES WITHOUT YOUR SIGN-OFF</span>
          <span>EST. ON THE GROUND</span>
        </div>
      </div>

      {/* ================================================= HERO ======== */}
      <header className="d4-hero">
        <div className="d4-wrap">
          <div className="d4-hero__grid">
            <div>
              <span className="d4-kicker d4-orange">FILE NO. 04 — BOLD WORKING-CLASS</span>
              <h1 style={{ marginTop: 18 }}>
                <span className="d4-line">IT DRAFTS.</span>
                <span className="d4-line d4-orange">YOU SIGN.</span>
                <span className="d4-line">WORK GETS DONE.</span>
              </h1>
              <p className="d4-hero__sub">
                A fleet of AI workers that does the busywork eating your week —
                rent chase, maintenance triage, owner reports, follow-ups. You
                stay the boss. We do the grunt work.
              </p>
              <div className="d4-hero__cta">
                <Link href="#pricing" className="d4-btn d4-btn--lg">
                  PUT IT TO WORK <span className="d4-arrow">→</span>
                </Link>
                <Link href="#how" className="d4-btn d4-btn--lg d4-btn--ghost d4-btn--on-dark">
                  SEE THE WORK
                </Link>
              </div>
            </div>

            <aside className="d4-hero__aside">
              <span className="d4-stamp d4-stamp--orange">
                <small>NO FLUFF</small>
                <b>DONE.</b>
                <small>NEXT.</small>
              </span>
              <span className="d4-tag" style={{ color: "#FFFFFF" }}>
                ◆ 10 VERTICALS · ONE FLAT PRICE
              </span>
            </aside>
          </div>

          <div className="d4-hero__proofbar">
            <div>
              <b>$500</b>
              <span>FLAT, PER MONTH</span>
            </div>
            <div>
              <b>0</b>
              <span>SENT WITHOUT YOU</span>
            </div>
            <div>
              <b>24/7</b>
              <span>ON THE CLOCK</span>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================= HOW IT WORKS ===== */}
      <section id="how" className="d4-section">
        <div className="d4-wrap">
          <span className="d4-eyebrow d4-kicker">HOW IT RUNS</span>
          <h2 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>
            THREE STEPS. NO MANUAL REQUIRED.
          </h2>
          <div className="d4-steps">
            <div className="d4-step">
              <div className="d4-step__num">01</div>
              <h3>HOOK IT UP</h3>
              <p>
                Connect your tools — email, calendar, your property software.
                Takes minutes. We read what we need, when we need it. Nothing
                gets hauled off and stored.
              </p>
            </div>
            <div className="d4-step">
              <div className="d4-step__num">02</div>
              <h3>PLAINO WORKS</h3>
              <p>
                Your AI worker picks up the busywork and drafts the next move —
                the chase email, the maintenance ticket, the owner report. Ready
                for your eyes.
              </p>
            </div>
            <div className="d4-step">
              <div className="d4-step__num">03</div>
              <h3>YOU SIGN OFF</h3>
              <p>
                You review the queue and hit go. Nothing leaves the building
                without your sign-off. Approve once, or set the jobs you trust to
                run on their own.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================== VERTICAL: PM ======= */}
      <section className="d4-section d4-section--concrete d4-vert">
        <div className="d4-wrap">
          <div className="d4-vert__head">
            <div>
              <span className="d4-eyebrow d4-kicker">VERTICAL · PROPERTY MANAGEMENT</span>
              <h2>FOR THE CREW THAT&apos;D RATHER BE ON-SITE THAN IN THE INBOX.</h2>
            </div>
            <p style={{ fontSize: "1.05rem" }}>
              You manage doors, not a desk. Plaino takes the paperwork, the
              chasing, and the reporting off your plate so your day goes back to
              the property.
            </p>
          </div>

          <div className="d4-jobs">
            <div className="d4-job">
              <div className="d4-job__top">
                <h4>Rent Chase</h4>
                <span className="d4-job__no">JOB 01</span>
              </div>
              <p>
                Drafts the reminder before rent&apos;s late and the firm follow-up
                after. Tracks who paid, who didn&apos;t, who needs a call.
              </p>
            </div>
            <div className="d4-job">
              <div className="d4-job__top">
                <h4>Maintenance Triage</h4>
                <span className="d4-job__no">JOB 02</span>
              </div>
              <p>
                Turns a tenant&apos;s &ldquo;the AC&apos;s out&rdquo; into a
                ticket, ranks the urgency, and lines up the right vendor — draft
                ready to send.
              </p>
            </div>
            <div className="d4-job">
              <div className="d4-job__top">
                <h4>Owner Reports</h4>
                <span className="d4-job__no">JOB 03</span>
              </div>
              <p>
                Builds the monthly owner report from your numbers — occupancy,
                collections, open work orders — in your format, on time.
              </p>
            </div>
            <div className="d4-job">
              <div className="d4-job__top">
                <h4>Renewals &amp; Notices</h4>
                <span className="d4-job__no">JOB 04</span>
              </div>
              <p>
                Flags leases coming due, drafts the renewal or the notice, and
                keeps the dates straight so nothing slips past the deadline.
              </p>
            </div>
          </div>

          <div className="d4-factclaim">
            <div className="d4-fc d4-fc--fact">
              <span className="d4-tag d4-tag--fact">FACT</span>
              <h5>EVERY DRAFT WAITS FOR YOU.</h5>
              <p>
                Plaino does the work and stops at the line. The approval queue is
                the gate — nothing goes out the door until you say so.
              </p>
            </div>
            <div className="d4-fc d4-fc--claim">
              <span className="d4-tag d4-tag--claim">CLAIM</span>
              <h5>YOU GET YOUR WEEK BACK.</h5>
              <p>
                The hours you sink into chasing and typing become hours back on
                the property. That&apos;s the whole point.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================ PRICING ====== */}
      <section id="pricing" className="d4-section">
        <div className="d4-wrap">
          <span className="d4-eyebrow d4-kicker">THE PRICE TAG</span>
          <h2 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>
            ONE FLAT PRICE. NO METER RUNNING.
          </h2>
          <p style={{ marginTop: 16, fontSize: "1.05rem" }}>
            You shouldn&apos;t need a calculator to know your bill. Pick a tier,
            put the fleet to work, cancel any time.
          </p>

          <div className="d4-pricing">
            <div className="d4-tier">
              <div className="d4-tier__name">STARTER</div>
              <div className="d4-tier__price">$249</div>
              <div className="d4-tier__per">FLAT / MONTH</div>
              <ul className="d4-tier__list">
                <li>One vertical, one workspace</li>
                <li>Core drafting + approval queue</li>
                <li>Email &amp; calendar connected</li>
                <li>Cancel any time</li>
              </ul>
              <Link href="#" className="d4-btn d4-btn--ghost">RUN IT</Link>
            </div>

            <div className="d4-tier d4-tier--feature">
              <div className="d4-tier__flag">WORKHORSE</div>
              <div className="d4-tier__name">PRO</div>
              <div className="d4-tier__price">$500</div>
              <div className="d4-tier__per">FLAT / MONTH</div>
              <ul className="d4-tier__list">
                <li>Full fleet across your vertical</li>
                <li>Maintenance triage + owner reports</li>
                <li>Property software connected</li>
                <li>Set-it-loose autonomy on trusted jobs</li>
                <li>Priority support, human-staffed</li>
              </ul>
              <Link href="#" className="d4-btn">RUN IT <span className="d4-arrow">→</span></Link>
            </div>

            <div className="d4-tier">
              <div className="d4-tier__name">CUSTOM</div>
              <div className="d4-tier__price">LET&apos;S TALK</div>
              <div className="d4-tier__per">MULTI-SITE / MULTI-VERTICAL</div>
              <ul className="d4-tier__list">
                <li>Multiple offices or verticals</li>
                <li>Custom integrations</li>
                <li>Dedicated onboarding</li>
                <li>Quarterly business review</li>
              </ul>
              <Link href="#" className="d4-btn d4-btn--ghost">BOOK A CALL</Link>
            </div>
          </div>
          <p style={{ marginTop: 22, fontFamily: "var(--font-stamp)", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--d4-steel)" }}>
            * Sample tiers for this design exploration — not a live price sheet.
          </p>
        </div>
      </section>

      {/* =============================================== DASHBOARD ===== */}
      <section className="d4-section d4-section--concrete">
        <div className="d4-wrap">
          <span className="d4-eyebrow d4-kicker">ON THE FLOOR</span>
          <h2 style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)" }}>
            TODAY&apos;S WORK, AT A GLANCE.
          </h2>

          <div className="d4-dash">
            <div className="d4-dash__bar">
              <span className="d4-dash__live"><span className="d4-dash__dot" />PLAINO · WORKING</span>
              <span>TUE · 8:42 AM</span>
            </div>

            <div className="d4-dash__metric">
              <div>
                <b className="d4-orange">6.4 hrs</b>
                <span>SAVED THIS WEEK</span>
              </div>
              <div>
                <b>12</b>
                <span>DRAFTS WAITING ON YOU</span>
              </div>
            </div>

            <div className="d4-row">
              <span className="d4-pill d4-pill--work">DRAFTED</span>
              <div className="d4-row__title">
                Late-rent follow-up — Unit 4B
                <small>Ready to send · waiting for your sign-off</small>
              </div>
            </div>
            <div className="d4-row">
              <span className="d4-pill d4-pill--work">DRAFTED</span>
              <div className="d4-row__title">
                Maintenance ticket — AC out, 218 Oak
                <small>Vendor matched · draft to tenant ready</small>
              </div>
            </div>
            <div className="d4-row">
              <span className="d4-pill d4-pill--done">DONE</span>
              <div className="d4-row__title">
                Owner report — Maple Group, May
                <small>Sent 7:30 AM after your approval</small>
              </div>
            </div>
            <div className="d4-row">
              <span className="d4-pill d4-pill--wait">QUEUED</span>
              <div className="d4-row__title">
                Lease renewal — Unit 11, due in 30 days
                <small>Drafting renewal notice</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================ PLAINO MOMENT ===== */}
      <section className="d4-section d4-section--dark">
        <div className="d4-wrap">
          <div className="d4-plaino">
            <div>
              <span className="d4-eyebrow d4-kicker d4-orange">MEET PLAINO</span>
              <h2>
                YOUR WORKER<br />ON THE JOB.
              </h2>
              <p style={{ color: "#CFCFCF", marginTop: 22, fontSize: "1.08rem" }}>
                Plaino is the face of the fleet — a working dog, not a chatbot.
                It sits ready, fetches what you ask, herds the busywork into
                order, and clocks out when the work&apos;s done.
              </p>
              <div style={{ marginTop: 30 }}>
                <span className="d4-stamp d4-stamp--orange">
                  <small>ALWAYS</small>
                  <b>READY</b>
                  <small>TO WORK</small>
                </span>
              </div>
            </div>

            <div className="d4-poses">
              <div className="d4-pose">
                <PlainoSit />
                <span className="d4-pose__label d4-orange">SIT</span>
                <span className="d4-pose__sub">Ready for the next job</span>
              </div>
              <div className="d4-pose">
                <PlainoFetch />
                <span className="d4-pose__label d4-orange">FETCH</span>
                <span className="d4-pose__sub">Brings back what you ask for</span>
              </div>
              <div className="d4-pose">
                <PlainoHerd />
                <span className="d4-pose__label d4-orange">HERD</span>
                <span className="d4-pose__sub">Drives the busywork into order</span>
              </div>
              <div className="d4-pose">
                <PlainoSleep />
                <span className="d4-pose__label d4-orange">SLEEP</span>
                <span className="d4-pose__sub">Off the clock, work&apos;s done</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =============================================== CTA STRIP ===== */}
      <section className="d4-section d4-section--orange" style={{ textAlign: "center" }}>
        <div className="d4-wrap">
          <h2 style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)" }}>
            STOP TYPING. START SIGNING.
          </h2>
          <p style={{ margin: "20px auto 0", fontSize: "1.15rem", fontWeight: 600 }}>
            Put the fleet to work this week. You stay in charge of every send.
          </p>
          <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            <Link href="#pricing" className="d4-btn d4-btn--lg d4-btn--ghost">
              PUT IT TO WORK <span className="d4-arrow">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================= FOOTER ====== */}
      <footer className="d4-footer">
        <div className="d4-wrap">
          <div className="d4-footer__top">
            <div className="d4-footer__brand">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <PlainoMark className="d4-orange" />
                <h3>agentplain</h3>
              </div>
              <p>
                We lift up local businesses by doing the work that takes their
                time and money away from the people they serve. Intelligence
                rooted in reality.
              </p>
            </div>
            <div className="d4-footer__col">
              <h6>Product</h6>
              <a href="#how">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#">Verticals</a>
              <a href="#">Security</a>
            </div>
            <div className="d4-footer__col">
              <h6>Verticals</h6>
              <a href="#">Property Management</a>
              <a href="#">Real Estate</a>
              <a href="#">Insurance</a>
              <a href="#">Home Services</a>
            </div>
            <div className="d4-footer__col">
              <h6>Company</h6>
              <a href="#">About</a>
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
              <a href="#">Contact</a>
            </div>
          </div>
          <div className="d4-footer__base">
            <span>© 2026 AGENTPLAIN · INTELLIGENCE ROOTED IN REALITY</span>
            <span>DESIGN DIRECTION 4 / 5 — BOLD WORKING-CLASS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
