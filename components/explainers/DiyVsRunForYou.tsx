/**
 * V02 — Build-it-yourself vs run-for-you · CODE-SVG · P0
 *
 * Spec: docs/explainer-visual-system-2026-06-07.md §3 V02.
 * Question answered: "How is this different from doing it myself with an AI
 * tool I could buy?" (Q4).
 *
 * Two-column comparison, hairline divider. LEFT = "A free AI chatbot
 * (do it yourself)", RIGHT = "agentplain (run for you)". Five rows pulled
 * VERBATIM from lib/marketing/home-content.ts → chatbotContrast (single source
 * of truth — never re-type the rows). The RIGHT cells carry a single moss check
 * (verified-good signal ONLY — never decorative).
 *
 * Guardrail: vendor-generic per the 2026-06-11 customer-surface rule — the
 * underlying AI model is never named on a customer surface. The contrast is
 * do-it-yourself vs. have-it-run-for-you, never positioned against one tool.
 *
 * Rendered as semantic HTML (a table-like grid) rather than inline SVG so the
 * verbatim copy stays selectable, localizable, and screen-reader complete.
 * Brand palette only; hairline rules, square corners, flat fills.
 */
// `import React` required: tsconfig uses jsx: preserve (classic runtime).
import React from "react";
import { chatbotContrast } from "@/lib/marketing/home-content";

const MOSS = "#3F5C3F";

export function DiyVsRunForYou() {
  return (
    <div className="border border-rule bg-paper">
      {/* Header note — clay, vendor-generic framing. */}
      <div className="border-b border-rule px-6 py-3 md:px-8">
        <p className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
          a powerful tool, run for you.
        </p>
      </div>

      {/* Column heads. */}
      <div className="grid grid-cols-2 gap-px bg-rule">
        <div className="bg-paper px-6 py-4 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            A free AI chatbot
          </p>
          <p className="mt-1 font-display text-base leading-snug text-ink-soft">
            do it yourself
          </p>
        </div>
        <div className="bg-paper px-6 py-4 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
            agentplain
          </p>
          <p className="mt-1 font-display text-base leading-snug text-ink">
            run for you
          </p>
        </div>
      </div>

      {/* Rows — verbatim from chatbotContrast. */}
      <dl className="grid grid-cols-2 gap-px bg-rule">
        {chatbotContrast.map((row) => (
          // Each row renders LEFT (dt) then RIGHT (dd) so the hairline grid
          // keeps the two columns aligned across breakpoints.
          <div key={row.us} className="contents">
            <dt className="bg-paper px-6 py-5 text-[15px] leading-relaxed text-ink-soft md:px-8">
              {row.free}
            </dt>
            <dd className="flex items-start gap-3 bg-paper px-6 py-5 text-[15px] leading-relaxed text-ink md:px-8">
              {/* moss check — verified-good signal only. aria-hidden: the
                  semantic dt/dd pairing already conveys "this side wins". */}
              <svg
                aria-hidden
                width="16"
                height="16"
                viewBox="0 0 16 16"
                className="mt-1 shrink-0"
              >
                <path
                  d="M3 8.5 L6.5 12 L13 4"
                  fill="none"
                  stroke={MOSS}
                  strokeWidth="2"
                />
              </svg>
              <span>{row.us}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default DiyVsRunForYou;
