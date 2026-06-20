import type { Metadata } from "next";
import styles from "./warm.module.css";

// ── Direction 3 — Warm Service Partnership ────────────────────────────────────
// A self-contained design exploration. One of five parallel directions for the
// agentplain marketing surface. Everything is scoped through warm.module.css, so
// none of this touches the ratified brand tokens (lib/brand/tokens.ts) or any
// shipping page — it's a sandbox you can compare side by side with the others.
//
// The bet: the local-business owner who is *nervous* about handing work to AI
// doesn't want a slick dashboard shouting at them. They want the feeling of a
// trusted team that has their back. Warm paper, generous space, a friendly dog,
// and copy that talks like a person. See README.md for the full philosophy.
//
// Routed under (marketing) so it renders in the real app frame; noindex because
// it's an internal design reference, not a customer landing page.

export const metadata: Metadata = {
  title: "Direction 3 — Warm Service Partnership",
  description:
    "A warm, human-staffed design exploration for agentplain: soft paper, generous space, a friendly Plaino, and copy that feels like a team that has your back.",
  robots: { index: false, follow: false },
};

/* ── Plaino — friendly illustrated robot dog (one-color, currentColor) ─────────
   Warm and a little playful in the early-Mailchimp-Freddie spirit, but credible:
   a real little machine with posture and intent, never a googly-eyed cartoon. */
type Pose = "watch" | "fetch" | "herd" | "sleep" | "sit";

function Plaino({
  pose = "watch",
  size = 72,
  className,
}: {
  pose?: Pose;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Plaino, ${pose}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* ground line */}
      <line x1="20" y1="104" x2="100" y2="104" opacity={0.35} strokeWidth={2.4} />

      {pose === "sleep" ? (
        <>
          {/* lying down, content */}
          <path d="M28 96 q0 -18 22 -18 h24 q22 0 22 18 z" fill="currentColor" opacity={0.08} />
          <path d="M28 96 q0 -18 22 -18 h24 q22 0 22 18" />
          {/* head resting */}
          <rect x="18" y="80" width="26" height="20" rx="7" fill="currentColor" opacity={0.08} />
          <rect x="18" y="80" width="26" height="20" rx="7" />
          {/* closed eye */}
          <path d="M25 90 q4 3 8 0" strokeWidth={2.6} />
          {/* ear */}
          <path d="M40 80 l5 -8" />
          {/* zzz */}
          <path d="M74 58 h10 l-10 10 h10" strokeWidth={2.4} opacity={0.7} />
          <path d="M88 44 h7 l-7 7 h7" strokeWidth={2.2} opacity={0.5} />
        </>
      ) : pose === "fetch" ? (
        <>
          {/* leaning forward, tail up, carrying a little report */}
          <path d="M40 96 q-2 -26 18 -28 q22 -2 24 14 q1 12 -8 14 z" fill="currentColor" opacity={0.08} />
          <path d="M40 96 q-2 -26 18 -28 q22 -2 24 14 q1 12 -8 14" />
          {/* legs */}
          <line x1="48" y1="92" x2="48" y2="104" />
          <line x1="74" y1="92" x2="74" y2="104" />
          {/* tail up, wagging */}
          <path d="M82 84 q14 -6 14 -20" />
          {/* head reaching down */}
          <rect x="30" y="74" width="24" height="20" rx="7" fill="currentColor" opacity={0.08} />
          <rect x="30" y="74" width="24" height="20" rx="7" />
          {/* antenna ear */}
          <path d="M44 74 l3 -9" />
          <circle cx="47" cy="63" r="2.4" fill="currentColor" stroke="none" />
          {/* eye */}
          <circle cx="40" cy="83" r="2.6" fill="currentColor" stroke="none" />
          {/* carried "report" */}
          <rect x="22" y="90" width="14" height="10" rx="2" />
        </>
      ) : pose === "herd" ? (
        <>
          {/* low alert crouch */}
          <path d="M36 98 q-4 -22 16 -24 h18 q20 0 20 18 q0 6 -6 6 z" fill="currentColor" opacity={0.08} />
          <path d="M36 98 q-4 -22 16 -24 h18 q20 0 20 18 q0 6 -6 6" />
          {/* legs spread, ready */}
          <line x1="44" y1="92" x2="40" y2="104" />
          <line x1="80" y1="92" x2="84" y2="104" />
          {/* low tail */}
          <path d="M84 88 q10 2 12 12" />
          {/* head low, scanning */}
          <rect x="28" y="76" width="26" height="20" rx="7" fill="currentColor" opacity={0.08} />
          <rect x="28" y="76" width="26" height="20" rx="7" />
          <path d="M42 76 l2 -9" />
          <circle cx="44" cy="65" r="2.4" fill="currentColor" stroke="none" />
          <circle cx="37" cy="85" r="2.6" fill="currentColor" stroke="none" />
        </>
      ) : pose === "sit" ? (
        <>
          {/* sitting upright, calm */}
          <path d="M44 102 q-6 -34 16 -36 q22 -2 22 18 q0 18 -10 18 z" fill="currentColor" opacity={0.08} />
          <path d="M44 102 q-6 -34 16 -36 q22 -2 22 18 q0 18 -10 18" />
          {/* front legs */}
          <line x1="54" y1="86" x2="54" y2="104" />
          <line x1="66" y1="86" x2="66" y2="104" />
          {/* tail curled */}
          <path d="M80 96 q12 0 12 -10" />
          {/* head */}
          <rect x="42" y="52" width="30" height="24" rx="8" fill="currentColor" opacity={0.08} />
          <rect x="42" y="52" width="30" height="24" rx="8" />
          {/* ears */}
          <path d="M50 52 l-2 -10" />
          <path d="M64 52 l2 -10" />
          <circle cx="48" cy="40" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="66" cy="40" r="2.6" fill="currentColor" stroke="none" />
          {/* eyes + content mouth */}
          <circle cx="52" cy="63" r="2.8" fill="currentColor" stroke="none" />
          <circle cx="62" cy="63" r="2.8" fill="currentColor" stroke="none" />
          <path d="M54 70 q3 2.5 6 0" strokeWidth={2.6} />
        </>
      ) : (
        <>
          {/* watch — standing, alert, friendly (default) */}
          <path d="M40 98 q-4 -26 18 -28 h16 q20 0 20 18 q0 10 -10 10 z" fill="currentColor" opacity={0.08} />
          <path d="M40 98 q-4 -26 18 -28 h16 q20 0 20 18 q0 10 -10 10" />
          {/* four legs */}
          <line x1="48" y1="92" x2="48" y2="104" />
          <line x1="60" y1="93" x2="60" y2="104" />
          <line x1="80" y1="92" x2="80" y2="104" />
          {/* tail up, friendly */}
          <path d="M84 84 q12 -2 13 -14" />
          {/* head, ears up */}
          <rect x="30" y="58" width="28" height="22" rx="8" fill="currentColor" opacity={0.08} />
          <rect x="30" y="58" width="28" height="22" rx="8" />
          <path d="M38 58 l-2 -10" />
          <path d="M50 58 l2 -10" />
          <circle cx="36" cy="46" r="2.6" fill="currentColor" stroke="none" />
          <circle cx="52" cy="46" r="2.6" fill="currentColor" stroke="none" />
          {/* eyes + smile */}
          <circle cx="40" cy="68" r="2.8" fill="currentColor" stroke="none" />
          <circle cx="50" cy="68" r="2.8" fill="currentColor" stroke="none" />
          <path d="M42 74 q3 2.5 6 0" strokeWidth={2.6} />
        </>
      )}
    </svg>
  );
}

// Small inline icons (stroked, currentColor) — kept tiny + warm.
function Check() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 6.5" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg className={styles.btnArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function Direction3WarmService() {
  return (
    <div className={styles.page}>
      {/* Orientation banner */}
      <div className={styles.banner}>
        <span><span className={styles.bannerDot} /> Design exploration</span>
        <span>Direction 3 / 5 — Warm Service Partnership</span>
        <span>scoped · noindex · brand tokens untouched</span>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <header className={styles.hero}>
        <div className={`${styles.shell} ${styles.heroInner}`}>
          <div>
            <p className={styles.heroKicker}>For the local business that does it all</p>
            <h1 className={styles.heroTitle}>
              Help that feels like{" "}
              <span className={styles.scribble}>
                a teammate
                <svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
                  <path d="M3 8 C 40 3, 80 11, 120 5 S 180 4, 197 7" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </span>
              , not a tool.
            </h1>
            <p className={styles.heroLede}>
              Plaino quietly handles the busywork that pulls you away from your
              customers — the follow-ups, the chasing, the tidying up. You stay in
              charge. Nothing goes out the door until you say so.
            </p>
            <div className={styles.heroActions}>
              <a href="#pricing" className={`${styles.btn} ${styles.btnPrimary}`}>
                Let&apos;s go <Arrow />
              </a>
              <a href="#how" className={`${styles.btn} ${styles.btnGhost}`}>
                Show me how it works
              </a>
            </div>
            <p className={styles.heroReassure}>
              <span style={{ color: "var(--forest)" }}><Check /></span>
              7-day free trial · a real person helps you set up · cancel anytime
            </p>
          </div>

          <div className={styles.heroArt}>
            <div className={styles.heroCardStack} style={{ color: "var(--forest)" }}>
              {/* a warm "first hello" card with Plaino */}
              <div
                style={{
                  background: "var(--cream-card)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-lg)",
                  boxShadow: "var(--elev-lg)",
                  padding: "26px 24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <Plaino pose="watch" size={64} />
                  <div>
                    <p style={{ margin: 0, fontFamily: "var(--font-display), serif", fontSize: "1.2rem", color: "var(--ink)" }}>
                      Morning, Dana 👋
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 13.5, color: "var(--ink-mute)" }}>
                      I tidied a few things overnight.
                    </p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    ["3 replies drafted", "ready for your eyes"],
                    ["2 invoices chased", "gently, like you'd want"],
                    ["1 review answered", "waiting for your ok"],
                  ].map(([t, s]) => (
                    <div
                      key={t}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        padding: "10px 13px",
                        background: "var(--cream)",
                        border: "1px solid var(--line-soft)",
                        borderRadius: "var(--r-md)",
                        fontSize: 14,
                      }}
                    >
                      <span style={{ color: "var(--ink)", fontWeight: 540 }}>{t}</span>
                      <span style={{ color: "var(--ink-mute)" }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how" className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 className={styles.sectionTitle}>Three easy steps. We&apos;ll be right there with you.</h2>
            <p className={styles.sectionIntro}>
              No long setup, no manual to read. Connect what you already use, tell
              Plaino what matters, and review the work before anything happens.
            </p>
          </div>

          <div className={styles.steps}>
            {[
              {
                n: "1",
                t: "Connect your tools",
                b: "Your inbox, calendar, and the apps you already pay for. It takes a few clicks, and we'll hop on a call if you'd like a hand.",
              },
              {
                n: "2",
                t: "Plaino learns your way",
                b: "It reads how you already work and picks up your tone, your priorities, and the little things you'd never want to drop.",
              },
              {
                n: "3",
                t: "You approve, it acts",
                b: "Everything lands in your queue as a ready-to-go draft. One tap to send, one tap to tweak. You're always the last word.",
              },
            ].map((s, i) => (
              <div key={s.n} className={styles.step}>
                <div className={styles.stepNum}>{s.n}</div>
                <h3 className={styles.stepTitle}>{s.t}</h3>
                <p className={styles.stepBody}>{s.b}</p>
                {i < 2 && (
                  <svg className={styles.stepArrow} viewBox="0 0 60 30" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M4 15 C 22 6, 38 24, 54 15" />
                    <path d="M47 9 l8 6 -8 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── VERTICAL BLOCK — General SMB ──────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionDeep}`}>
        <div className={styles.shell}>
          <div className={styles.vertical}>
            <div>
              <p className={styles.eyebrow}>For every kind of small business</p>
              <h2 className={styles.sectionTitle}>
                You started this to do the thing you love — not to drown in admin.
              </h2>
              <p className={styles.sectionIntro}>
                Whether you run a shop, a studio, a practice, or a one-person
                operation, the same little tasks eat your evenings. Plaino picks
                them up so your time goes back to the people you serve.
              </p>
              <ul className={styles.vList}>
                {[
                  "Answer the routine emails before they pile up",
                  "Chase unpaid invoices, kindly and on time",
                  "Keep your customer list clean and current",
                  "Draft the post, the reply, the follow-up — in your voice",
                ].map((v) => (
                  <li key={v} className={styles.vItem}>
                    <span className={styles.vCheck}><Check /></span>
                    {v}
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.vCard}>
              <div className={styles.vCardHead}>
                <span className={styles.vAvatar} style={{ color: "var(--forest)" }}>
                  <Plaino pose="sit" size={40} />
                </span>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "var(--ink)" }}>Marisol R.</p>
                  <p style={{ margin: "1px 0 0", fontSize: 13.5, color: "var(--ink-mute)" }}>Bakery owner · 2 locations</p>
                </div>
              </div>
              <p className={styles.vQuote}>
                &ldquo;It feels like I hired someone who actually gets how I talk to
                my customers. I read everything before it goes — but I almost never
                have to change a word.&rdquo;
              </p>
              <p className={styles.vAttr}>Saving about 6 hours a week since March.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING TIER ──────────────────────────────────────────────────── */}
      <section id="pricing" className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead} style={{ marginInline: "auto", textAlign: "center" }}>
            <p className={styles.eyebrow} style={{ justifyContent: "center" }}>Simple pricing</p>
            <h2 className={styles.sectionTitle}>One fair price. No surprises.</h2>
            <p className={styles.sectionIntro}>
              Everything you need to get your evenings back. Try it free for a
              week — a real person will help you get going.
            </p>
          </div>

          <div className={styles.priceWrap}>
            <div className={styles.priceCard}>
              <span className={styles.priceTag}>Most popular</span>
              <h3 className={styles.priceName}>The Essentials</h3>
              <p className={styles.priceBlurb}>For the owner who wears every hat.</p>
              <div className={styles.priceAmt}>
                <span className={styles.priceNumber}>$149</span>
                <span className={styles.pricePer}>/ month</span>
              </div>
              <p className={styles.priceTrial}>Free for 7 days · cancel anytime</p>
              <ul className={styles.priceList}>
                {[
                  "Your whole back-office toolkit, ready to go",
                  "Plaino works in your voice, you approve every send",
                  "Connect the apps you already use",
                  "A real person helps you set up",
                  "Friendly support whenever you need it",
                ].map((f) => (
                  <li key={f}>
                    <span className={styles.priceTick}><Check /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#" className={`${styles.btn} ${styles.btnPrimary}`} style={{ width: "100%", justifyContent: "center" }}>
                Start my free week <Arrow />
              </a>
              <p className={styles.priceFoot}>No card tricks. Cancel in two clicks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DASHBOARD WIDGET ──────────────────────────────────────────────── */}
      <section className={`${styles.section} ${styles.sectionDeep}`}>
        <div className={styles.shell}>
          <div className={styles.sectionHead} style={{ marginInline: "auto", textAlign: "center" }}>
            <p className={styles.eyebrow} style={{ justifyContent: "center" }}>Your morning, at a glance</p>
            <h2 className={styles.sectionTitle}>Calm, not crowded.</h2>
            <p className={styles.sectionIntro}>
              No wall of charts. Just what got done, what&apos;s waiting on you, and
              what Plaino is working on right now.
            </p>
          </div>

          <div className={styles.dash}>
            <div className={styles.dashBar}>
              <span className={styles.dashDots}><span /><span /><span /></span>
              <span className={styles.dashTitle}>Today</span>
            </div>
            <div className={styles.dashBody}>
              <div className={styles.dashGreeting}>
                <span style={{ color: "var(--forest)" }}><Plaino pose="watch" size={52} /></span>
                <div>
                  <p className={styles.dashHi}>Good morning, Dana.</p>
                  <p className={styles.dashHiSub}>You&apos;ve got 3 things to look over — about 4 minutes.</p>
                </div>
              </div>

              <div className={styles.dashRow}>
                <span className={`${styles.dashIcon} ${styles.dashIconRose}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></svg>
                </span>
                <div className={styles.dashRowMain}>
                  <p className={styles.dashRowTitle}>Reply to Sarah about Tuesday</p>
                  <p className={styles.dashRowMeta}>Drafted in your voice · 12 min ago</p>
                </div>
                <span className={`${styles.dashPill} ${styles.pillReady}`}>Ready</span>
              </div>

              <div className={styles.dashRow}>
                <span className={`${styles.dashIcon} ${styles.dashIconForest}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                </span>
                <div className={styles.dashRowMain}>
                  <p className={styles.dashRowTitle}>Invoice #1043 — gentle nudge</p>
                  <p className={styles.dashRowMeta}>10 days overdue · friendly tone</p>
                </div>
                <span className={`${styles.dashPill} ${styles.pillReady}`}>Ready</span>
              </div>

              <div className={styles.dashRow}>
                <span className={`${styles.dashIcon} ${styles.dashIconSky}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.6 6.6L22 9l-5 4.6L18.5 21 12 17l-6.5 4L7 13.6 2 9l7.4-.4z" /></svg>
                </span>
                <div className={styles.dashRowMain}>
                  <p className={styles.dashRowTitle}>New 5-star review — thank-you drafted</p>
                  <p className={styles.dashRowMeta}>From Google · posted this morning</p>
                </div>
                <span className={`${styles.dashPill} ${styles.pillWaiting}`}>Your ok</span>
              </div>

              <div className={styles.dashStatus}>
                <span style={{ color: "var(--forest)" }}><Plaino pose="herd" size={34} /></span>
                <span>Plaino&apos;s setting up your weekly summary</span>
                <span className={styles.dashStatusDots}><i /><i /><i /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLAINO MOMENT ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.shell}>
          <div className={styles.sectionHead} style={{ marginInline: "auto", textAlign: "center" }}>
            <p className={styles.eyebrow} style={{ justifyContent: "center" }}>The one on your team</p>
            <h2 className={styles.sectionTitle}>A good working dog for your business.</h2>
            <p className={styles.sectionIntro}>
              Plaino isn&apos;t a chatbot in a corner. It&apos;s the dependable one
              on the team — it watches, it fetches, it keeps things in order, and it
              knows when the day is done.
            </p>
          </div>

          <div className={styles.plainoMoment} style={{ color: "var(--forest)" }}>
            {[
              { pose: "watch" as Pose, label: "Watches", cap: "Keeps an eye on your inbox and queue so nothing slips." },
              { pose: "fetch" as Pose, label: "Fetches", cap: "Brings back the draft, the report, the answer — ready for you." },
              { pose: "herd" as Pose, label: "Herds", cap: "Rounds up the loose ends: follow-ups, nudges, tidy-ups." },
              { pose: "sleep" as Pose, label: "Rests", cap: "When the work's done, it rests. No noise for noise's sake." },
            ].map((p) => (
              <div key={p.label} className={styles.poseCard}>
                <div className={styles.poseArt}>
                  <Plaino pose={p.pose} size={88} />
                </div>
                <p className={styles.poseLabel}>{p.label}</p>
                <p className={styles.poseCaption}>{p.cap}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div
          className={styles.cornerPlaino}
          style={{ right: 32, top: -16, color: "var(--rose)" }}
          aria-hidden
        >
          <Plaino pose="sit" size={96} />
        </div>
        <div className={styles.shell}>
          <div className={styles.footerInner}>
            <div>
              <h3 className={styles.footerTitle}>Let&apos;s take a few things off your plate.</h3>
              <p className={styles.footerBlurb}>
                We&apos;re a small team that builds the help we&apos;d want for our
                own businesses — and a real person is always a message away.
              </p>
              <a href="#pricing" className={`${styles.btn} ${styles.btnSecondary}`}>
                Start free <Arrow />
              </a>
            </div>

            <div className={styles.footerCol}>
              <h4>Product</h4>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#">What Plaino does</a></li>
                <li><a href="#">For your trade</a></li>
              </ul>
            </div>

            <div className={styles.footerCol}>
              <h4>We&apos;re here</h4>
              <ul>
                <li><a href="#">Talk to a human</a></li>
                <li><a href="#">Help center</a></li>
                <li><a href="#">Our story</a></li>
                <li><a href="#">Privacy &amp; trust</a></li>
              </ul>
            </div>
          </div>

          <div className={styles.footerBase}>
            <span className={styles.footerSign}>
              <span style={{ color: "var(--rose)" }}><Plaino pose="sit" size={26} /></span>
              Intelligence rooted in reality.
            </span>
            <span>Direction 3 · Warm Service Partnership · design exploration</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
