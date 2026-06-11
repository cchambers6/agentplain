"use client";

/**
 * DisciplineHeadForm — owner-only assigner for one discipline.
 *
 * Renders a small select + Save button per discipline row. Picking
 * "(default — any qualified member)" unassigns the head; picking a
 * member assigns or reassigns. The page revalidates on success so the
 * row updates without a manual refresh.
 */

import { useState } from "react";
import { assignDisciplineHead, unassignDisciplineHead } from "./actions";

interface MemberChoice {
  id: string;
  label: string;
  role: string;
}

interface Props {
  workspaceId: string;
  discipline: string;
  currentUserId: string | null;
  memberChoices: MemberChoice[];
}

const DEFAULT_VALUE = "__default__";

export function DisciplineHeadForm({
  workspaceId,
  discipline,
  currentUserId,
  memberChoices,
}: Props): JSX.Element {
  const [value, setValue] = useState<string>(currentUserId ?? DEFAULT_VALUE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = value !== (currentUserId ?? DEFAULT_VALUE);

  const handleSave = async (): Promise<void> => {
    setSubmitting(true);
    setError(null);
    const result =
      value === DEFAULT_VALUE
        ? await unassignDisciplineHead({ workspaceId, discipline })
        : await assignDisciplineHead({
            workspaceId,
            discipline,
            userId: value,
          });
    setSubmitting(false);
    if (!result.ok) setError(result.error ?? "Could not save.");
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <label className="flex items-center gap-2">
        <span className="sr-only">Head for {discipline}</span>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={submitting}
          className="rounded-none border border-rule bg-paper px-2 py-1 text-[13px] text-ink"
        >
          <option value={DEFAULT_VALUE}>(default — any member)</option>
          {memberChoices.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} · {m.role}
            </option>
          ))}
        </select>
      </label>
      {dirty ? (
        <button
          type="button"
          onClick={handleSave}
          disabled={submitting}
          className="rounded-none bg-ink px-3 py-1 text-[12px] text-paper disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
      ) : null}
      {error ? (
        <p className="text-[12px] text-flag" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
