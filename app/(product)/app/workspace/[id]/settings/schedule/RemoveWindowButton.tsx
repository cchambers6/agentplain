"use client";

import { useState } from "react";
import { removeSkillScheduleWindow } from "./actions";

interface Props {
  workspaceId: string;
  skillSlug: string;
}

export function RemoveWindowButton({ workspaceId, skillSlug }: Props): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const handle = async (): Promise<void> => {
    if (!confirm("Remove this window? The skill goes back to firing anytime.")) {
      return;
    }
    setSubmitting(true);
    await removeSkillScheduleWindow({ workspaceId, skillSlug });
    setSubmitting(false);
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={submitting}
      className="font-mono text-[11px] uppercase text-mute hover:text-ink disabled:opacity-50"
    >
      {submitting ? "removing…" : "remove"}
    </button>
  );
}
