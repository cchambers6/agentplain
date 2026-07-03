// /operator/outreach/[prospectId] — the prospect record.
//
// Everything the weekly pipeline review needs on one page: the row's
// fields, the stage control (with reason capture for Not-yet/Lost), the
// next-action plan, notes, and the append-only touch log that doubles as
// the stage-movement audit trail.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { withSystemContext } from "@/lib/db/rls";
import {
  STAGES,
  STAGE_ORDER,
  TOUCH_KINDS,
  isStuck,
} from "@/lib/outreach/stages";
import {
  logTouchAction,
  setStageAction,
  updateNotesAction,
  updatePlanAction,
} from "../actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ prospectId: string }>;
}

export default async function OutreachProspectPage({ params }: PageProps) {
  const session = await requireUser();
  if (!session.isOperator) redirect("/app");
  const { prospectId } = await params;

  const prospect = await withSystemContext((tx) =>
    tx.outreachProspect.findUnique({
      where: { id: prospectId },
      include: { touches: { orderBy: { occurredAt: "desc" } } },
    }),
  );
  if (!prospect) notFound();

  const stuck = isStuck(prospect);

  return (
    <div className="container-wide py-8">
      <p className="mb-3 font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        <Link
          href="/operator/outreach"
          className="underline-offset-4 hover:underline"
        >
          ← back to pipeline
        </Link>
      </p>

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-3xl leading-tight text-ink">
          {prospect.name}
          {prospect.business ? (
            <span className="text-ink-soft"> · {prospect.business}</span>
          ) : null}
        </h1>
        <span className="border border-ink bg-paper-deep px-3 py-1 font-mono text-[11px] uppercase tracking-eyebrow text-ink">
          {STAGES[prospect.stage].label}
        </span>
      </div>

      <dl className="mt-4 grid gap-px overflow-hidden border border-rule bg-rule sm:grid-cols-4">
        <Cell label="email" value={prospect.email ?? "—"} />
        <Cell label="vertical" value={prospect.vertical ?? "—"} />
        <Cell label="source" value={prospect.source ?? "—"} />
        <Cell
          label="added"
          value={prospect.createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        />
      </dl>

      {stuck && (
        <p className="mt-4 border border-flag bg-paper px-4 py-3 text-[14px] text-flag">
          Stuck — this row has no next action. Doc 06&apos;s rule: every open
          row carries one.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Stage control */}
        <section className="border border-rule bg-paper p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
            move stage
          </h2>
          <form action={setStageAction.bind(null, prospect.id)} className="mt-3 space-y-3">
            <select
              name="stage"
              defaultValue={prospect.stage}
              className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
            >
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STAGES[s].label} — {STAGES[s].entry}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="reason"
              placeholder="Reason (required in spirit for Not yet / Lost — verbatim)"
              className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-mute"
            />
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                Revisit date (Not yet only)
              </span>
              <input
                type="date"
                name="revisitDate"
                className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
              />
            </label>
            <button
              type="submit"
              className="border border-clay bg-clay px-4 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-paper transition hover:bg-clay-deep"
            >
              Move
            </button>
          </form>
        </section>

        {/* Log a touch */}
        <section className="border border-rule bg-paper p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
            log a touch
          </h2>
          <form action={logTouchAction.bind(null, prospect.id)} className="mt-3 space-y-3">
            <select
              name="kind"
              className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
            >
              {Object.entries(TOUCH_KINDS)
                .filter(([k]) => k !== "STAGE_CHANGE")
                .map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
            </select>
            <textarea
              name="note"
              rows={3}
              placeholder="What happened — subject line sent, what they said on the call…"
              className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-mute"
            />
            <label className="block">
              <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                When (defaults to now)
              </span>
              <input
                type="date"
                name="occurredAt"
                className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
              />
            </label>
            <button
              type="submit"
              className="border border-ink bg-ink px-4 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-paper transition hover:bg-ink/90"
            >
              Log touch
            </button>
          </form>
        </section>

        {/* Next-action plan */}
        <section className="border border-rule bg-paper p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
            next action
          </h2>
          <form action={updatePlanAction.bind(null, prospect.id)} className="mt-3 space-y-3">
            <input
              type="text"
              name="nextAction"
              defaultValue={prospect.nextAction ?? ""}
              placeholder="send touch 2 / prep discovery brief / …"
              className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink placeholder:text-mute"
            />
            <input
              type="date"
              name="nextActionDate"
              defaultValue={
                prospect.nextActionDate
                  ? prospect.nextActionDate.toISOString().slice(0, 10)
                  : ""
              }
              className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
            />
            <button
              type="submit"
              className="border border-ink bg-paper px-4 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-ink transition hover:bg-paper-deep"
            >
              Save plan
            </button>
          </form>
        </section>

        {/* Notes */}
        <section className="border border-rule bg-paper p-5">
          <h2 className="font-mono text-[11px] uppercase tracking-eyebrow text-clay">
            notes
          </h2>
          <form action={updateNotesAction.bind(null, prospect.id)} className="mt-3 space-y-3">
            <textarea
              name="notes"
              rows={5}
              defaultValue={prospect.notes ?? ""}
              className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
            />
            <button
              type="submit"
              className="border border-ink bg-paper px-4 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-ink transition hover:bg-paper-deep"
            >
              Save notes
            </button>
          </form>
        </section>
      </div>

      {/* Touch log */}
      <section className="mt-8">
        <h2 className="border-b border-rule pb-2 font-display text-xl text-ink">
          Touch log
        </h2>
        {prospect.touches.length === 0 ? (
          <p className="mt-3 text-[14px] text-mute">
            Nothing logged yet. The first row should be touch 1, logged right
            after you send it.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {prospect.touches.map((t) => (
              <li key={t.id} className="border border-rule bg-paper p-4">
                <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                  {TOUCH_KINDS[t.kind]} ·{" "}
                  {t.occurredAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
                {t.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
                    {t.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-4">
      <p className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
        {label}
      </p>
      <p className="mt-1 break-words text-[14px] text-ink">{value}</p>
    </div>
  );
}
