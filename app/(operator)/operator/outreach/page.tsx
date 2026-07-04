// /operator/outreach — CRM-lite of record for the design-partner motion.
//
// One board: every prospect, grouped by the doc-06 stage ladder, with the
// stuck rule made visible (a non-terminal row without a next-action date is
// stuck by definition). Deliberately Airtable-sized — the weekly pipeline
// review (docs/sales/deep-dive-2026-07-02/06) is the operating cadence, this
// page is just its system of record. Nothing here sends; every touch is
// logged after the founder sends it from his own inbox.

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  STAGES,
  STAGE_ORDER,
  isStuck,
} from "@/lib/outreach/stages";
import { createProspectAction } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OperatorOutreachPage() {
  const session = await requireUser();
  if (!session.isOperator) redirect("/app");

  const prospects = await withSystemContext((tx) =>
    tx.outreachProspect.findMany({
      orderBy: [{ nextActionDate: "asc" }, { createdAt: "desc" }],
      include: {
        touches: {
          orderBy: { occurredAt: "desc" },
          take: 1,
          select: { kind: true, occurredAt: true },
        },
      },
    }),
  );

  const byStage = new Map(
    STAGE_ORDER.map((s) => [s, prospects.filter((p) => p.stage === s)] as const),
  );
  const stuckCount = prospects.filter(isStuck).length;
  const weighted = prospects.reduce(
    (sum, p) => sum + STAGES[p.stage].weight,
    0,
  );

  return (
    <div className="container-wide py-8">
      <p className="eyebrow mb-2 text-clay">operator · outreach</p>
      <h1 className="font-display text-4xl leading-tight text-ink">
        Design-partner pipeline
      </h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        The system of record for the founder-led outreach motion. Log every
        touch after you send it from your own inbox; keep a next action on
        every open row. Stage ladder + weights per the sales deep-dive
        (doc 06).
      </p>

      <div className="mt-6 flex flex-wrap gap-4 font-mono text-[12px] text-mute">
        <span className="border border-rule bg-paper px-3 py-1.5">
          {prospects.length} prospect{prospects.length === 1 ? "" : "s"}
        </span>
        <span className="border border-rule bg-paper px-3 py-1.5">
          weighted pipeline ≈ {weighted.toFixed(1)} partner
          {weighted === 1 ? "" : "s"}
        </span>
        <span
          className={`border px-3 py-1.5 ${stuckCount > 0 ? "border-flag text-flag" : "border-rule"}`}
        >
          {stuckCount} stuck (no next action)
        </span>
      </div>

      {/* Create form — the Airtable row, not a wizard. */}
      <details className="mt-8 border border-rule bg-paper-deep">
        <summary className="cursor-pointer px-5 py-3 font-mono text-[11px] uppercase tracking-eyebrow text-ink">
          + add prospect
        </summary>
        <form action={createProspectAction} className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Name (required)" name="name" required placeholder="Jane Broker" />
          <Field label="Business" name="business" placeholder="Peachtree Realty Group" />
          <Field label="Email" name="email" type="email" placeholder="jane@…" />
          <Field label="Vertical" name="vertical" placeholder="real-estate" />
          <Field label="Source" name="source" placeholder="warm / cold / referral — via whom" />
          <Field label="Next action" name="nextAction" placeholder="send touch 1 (cold email A)" />
          <Field label="Next action date" name="nextActionDate" type="date" />
          <label className="sm:col-span-2 block">
            <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
              Notes
            </span>
            <textarea
              name="notes"
              rows={2}
              className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="border border-clay bg-clay px-4 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-paper transition hover:bg-clay-deep"
            >
              Add prospect
            </button>
          </div>
        </form>
      </details>

      {prospects.length === 0 ? (
        <p className="mt-10 border border-rule bg-paper-deep p-6 text-[15px] text-ink-soft">
          No prospects yet. Add the first five from the design-partner list
          spec (docs/sales/deep-dive-2026-07-02/01) before the first send.
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {STAGE_ORDER.map((stage) => {
            const rows = byStage.get(stage) ?? [];
            if (rows.length === 0) return null;
            return (
              <section key={stage}>
                <h2 className="flex items-baseline gap-3 border-b border-rule pb-2">
                  <span className="font-display text-xl text-ink">
                    {STAGES[stage].label}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                    {rows.length} · weight {Math.round(STAGES[stage].weight * 100)}% ·{" "}
                    {STAGES[stage].entry}
                  </span>
                </h2>
                <ul className="mt-3 space-y-2">
                  {rows.map((p) => {
                    const stuck = isStuck(p);
                    const last = p.touches[0];
                    return (
                      <li
                        key={p.id}
                        className={`border bg-paper p-4 ${stuck ? "border-flag" : "border-rule"}`}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <Link
                            href={`/operator/outreach/${p.id}`}
                            className="font-display text-lg text-ink underline-offset-4 hover:underline"
                          >
                            {p.name}
                            {p.business ? (
                              <span className="text-ink-soft"> · {p.business}</span>
                            ) : null}
                          </Link>
                          <span className="font-mono text-[11px] text-mute">
                            {p.vertical ?? "—"} · {p.source ?? "—"}
                            {last
                              ? ` · last: ${last.kind.toLowerCase().replace("_", " ")} ${last.occurredAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                              : " · no touches yet"}
                          </span>
                        </div>
                        <p
                          className={`mt-2 text-[13px] ${stuck ? "text-flag" : "text-ink-soft"}`}
                        >
                          {stuck
                            ? "Stuck — no next action. Set one or move the row."
                            : p.nextAction
                              ? `Next: ${p.nextAction}${p.nextActionDate ? ` by ${p.nextActionDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`
                              : p.stage === "NOT_YET" && p.revisitDate
                                ? `Revisit ${p.revisitDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}${p.reason ? ` — ${p.reason}` : ""}`
                                : (p.reason ?? "Closed.")}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {label}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-mute"
      />
    </label>
  );
}
