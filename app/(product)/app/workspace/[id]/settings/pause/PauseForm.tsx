"use client";

/**
 * PauseForm — client-side form for creating a new vacation/PTO pause.
 * Posts to the server action; on success the page revalidates and the
 * row appears in the active-pauses list above the form.
 *
 * Per the wave-5 honesty bar: when no disciplines are checked, the
 * pause applies to ALL disciplines (the common case). When at least
 * one is checked, only those disciplines pause — the rest keep
 * firing.
 */

import { useState } from "react";
import { createWorkspacePause } from "./actions";

const DISCIPLINES = [
  { id: "operations", label: "Operations" },
  { id: "customer-success", label: "Customer success" },
  { id: "sales-enablement", label: "Sales enablement" },
  { id: "marketing", label: "Marketing" },
  { id: "legal", label: "Legal" },
  { id: "finance", label: "Finance" },
  { id: "analytics", label: "Analytics" },
  { id: "research", label: "Research" },
] as const;

interface Props {
  workspaceId: string;
  /** Best-guess "today" + "today+7d" as defaults so the date inputs
   *  open at sensible values. */
  defaultPausedFrom: string;
  defaultPausedUntil: string;
}

export function PauseForm({
  workspaceId,
  defaultPausedFrom,
  defaultPausedUntil,
}: Props): JSX.Element {
  const [pausedFrom, setPausedFrom] = useState(defaultPausedFrom);
  const [pausedUntil, setPausedUntil] = useState(defaultPausedUntil);
  const [disciplines, setDisciplines] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createWorkspacePause({
      workspaceId,
      pausedFrom,
      pausedUntil,
      pausedDisciplineIds: disciplines,
      reason: reason || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Pause failed to save.");
      return;
    }
    setReason("");
    setDisciplines([]);
  };

  return (
    <form className="space-y-4" onSubmit={handle}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-[11px] uppercase text-mute">
            pause from
          </span>
          <input
            type="datetime-local"
            required
            value={pausedFrom}
            onChange={(e) => setPausedFrom(e.target.value)}
            className="mt-1 block w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
          />
        </label>
        <label className="block">
          <span className="font-mono text-[11px] uppercase text-mute">
            pause until
          </span>
          <input
            type="datetime-local"
            required
            value={pausedUntil}
            onChange={(e) => setPausedUntil(e.target.value)}
            className="mt-1 block w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
          />
        </label>
      </div>

      <fieldset>
        <legend className="font-mono text-[11px] uppercase text-mute">
          pause which disciplines?
        </legend>
        <p className="mt-1 text-[12px] leading-relaxed text-mute">
          Leave them all unchecked to pause the entire fleet.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-4">
          {DISCIPLINES.map((d) => {
            const checked = disciplines.includes(d.id);
            return (
              <label key={d.id} className="flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDisciplines([...disciplines, d.id]);
                    } else {
                      setDisciplines(disciplines.filter((x) => x !== d.id));
                    }
                  }}
                />
                {d.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="block">
        <span className="font-mono text-[11px] uppercase text-mute">
          reason (optional)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="e.g. Out of office through next week"
          className="mt-1 block w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-ink/30"
        />
        <span className="mt-1 block text-[11px] text-mute">
          Encrypted at rest. Only the operator sees it in the audit log.
        </span>
      </label>

      {error ? (
        <p className="text-[13px] text-flag" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="border border-ink px-4 py-2 font-mono text-[12px] uppercase text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {submitting ? "saving…" : "schedule pause"}
      </button>
    </form>
  );
}
