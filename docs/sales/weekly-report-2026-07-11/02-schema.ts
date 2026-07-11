/**
 * docs/sales/weekly-report-2026-07-11/02-schema.ts
 *
 * Zod contract for the weekly design-partner report NARRATIVE — the
 * structured object the narrative writer (01-prompt.ts) must produce
 * before anything renders. This file is a typechecked reference
 * implementation living under docs/ on purpose: nothing imports it yet
 * (wiring gate in 00-README.md), but `tsc` compiles it against the real
 * repo, so the contract can move to lib/reports/ verbatim when the
 * writer is wired.
 *
 * Truth Wave enforcement lives IN the schema, not just in the prompt:
 *   - every quantified metric must carry a `source_row_id` (a saved-time
 *     ledger row id or a named instrumentation query key) — a number the
 *     model can't source fails validation, which fails the generation;
 *   - vendor/model names are rejected on every string field (the
 *     customer-surface invisibility rule,
 *     feedback_model_vendor_invisible_on_customer_surfaces);
 *   - the worst LLM-tell phrases (voice-gate family A/C, the ones that
 *     survive temperature) are rejected at the schema layer too, so a
 *     drifting generation is caught before a human reads it.
 */

import { z } from 'zod';

// ── Banned-content scans (subset enforced at the schema layer) ─────────────

/** Vendor invisibility: no provider or model name may appear anywhere in a
 *  partner-facing report. The full rule and its sole exception (/privacy +
 *  /security subprocessor lists) live in
 *  feedback_model_vendor_invisible_on_customer_surfaces. */
const VENDOR_NAME_PATTERN =
  /\b(claude|anthropic|opus|sonnet|haiku|openai|gpt|gemini|llama)\b/i;

/** The highest-signal LLM tells from the voice-gate catalog (families A and
 *  C, docs/brand/voice-guidelines-2026-06-19.md §3). Not the whole catalog —
 *  tools/brand/voice-gate.mjs owns that; this is the schema's cheap tripwire
 *  for the phrases that most reliably survive a drifting generation. */
const LLM_TELL_PATTERN = new RegExp(
  [
    'delve',
    'tapestry',
    'a testament to',
    'treasure trove',
    'game-changer',
    'seamless',
    'in today’s fast-paced',
    "in today's fast-paced",
    'great news',
    'exciting news',
    "we're thrilled",
    'rest assured',
    'it goes without saying',
    'harness the power',
  ].join('|'),
  'i',
);

function cleanLine(label: string) {
  return z
    .string()
    .min(1)
    .refine((s) => !VENDOR_NAME_PATTERN.test(s), {
      message: `${label}: vendor/model names never appear on a partner-facing report`,
    })
    .refine((s) => !LLM_TELL_PATTERN.test(s), {
      message: `${label}: contains a banned voice-gate phrase — rewrite plainly`,
    });
}

// ── The report contract ────────────────────────────────────────────────────

/** One quantified line. `value` is a string on purpose ("47 minutes",
 *  "9 of 11 approved") — the writer copies figures verbatim from the data
 *  block; it never computes. `source_row_id` is the audit trail: a
 *  TimeSavingsEntry id, a WorkApprovalQueueItem id, or a named
 *  instrumentation query key from the input (e.g. "weekly-report-data:
 *  approvalsApproved"). A metric without a source doesn't validate, so it
 *  doesn't ship. */
export const QuantifiedMetricSchema = z.object({
  metric: cleanLine('quantified.metric'),
  value: cleanLine('quantified.value'),
  source_row_id: z.string().min(1),
});

export const WeeklyReportSchema = z.object({
  /** The partner's name as they'd say it ("Sarah"), never a slug. */
  partner_name: cleanLine('partner_name'),

  /** Human week label for the REPORTED window, e.g. "Jul 13 – Jul 19".
   *  Must match the window the data block declares — the writer copies it,
   *  never derives it. */
  week_of: cleanLine('week_of'),

  /** 3–5 narrative beats, each one concrete moment from the week's data
   *  (a named lead caught at a named time, an edit that taught us
   *  something, a connection that stayed green). No adjectives doing the
   *  work a fact should do. */
  highlights: z.array(cleanLine('highlights[]')).min(3).max(5),

  /** Every number in the report, each with its row behind it. */
  quantified: z.array(QuantifiedMetricSchema).min(1).max(6),

  /** 1–3 honest watch items: what was rough, what we're keeping an eye
   *  on, what needs the partner. A week with zero watches is suspicious,
   *  not impressive — the writer is instructed to find the true one. */
  watches: z.array(cleanLine('watches[]')).min(1).max(3),

  /** One sentence: the single concrete thing that changes or continues
   *  next week. Singular on purpose (runbook doc 03: one visible change
   *  per week, delivered, beats three promised). */
  next_week_focus: cleanLine('next_week_focus'),

  /** Plaino's one-line sign-off for this week — first person, specific to
   *  something that actually happened, never a slogan. Renders under the
   *  report as the closing line.
   *
   *  NOTE: the commissioning brief named this field `chiron_voice_signature`;
   *  Chiron is a different product (the homeschool line). On agentplain
   *  surfaces the named service partner is Plaino
   *  (project_plaino_named_agent), so the field is `plaino_voice_signature`
   *  here. Deviation recorded in 00-README.md. */
  plaino_voice_signature: cleanLine('plaino_voice_signature'),
});

export type WeeklyReport = z.infer<typeof WeeklyReportSchema>;
export type QuantifiedMetric = z.infer<typeof QuantifiedMetricSchema>;

/** Parse helper the generation loop (01-prompt.ts) uses: returns the typed
 *  report or a flat list of human-readable issues for the corrective
 *  retry prompt. */
export function parseWeeklyReport(
  raw: unknown,
): { ok: true; report: WeeklyReport } | { ok: false; issues: string[] } {
  const res = WeeklyReportSchema.safeParse(raw);
  if (res.success) return { ok: true, report: res.data };
  return {
    ok: false,
    issues: res.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    ),
  };
}
