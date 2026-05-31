"use client";

import { useState } from "react";
import { deleteWorkspacePause } from "./actions";

interface Props {
  workspaceId: string;
  pauseId: string;
}

export function DeletePauseButton({ workspaceId, pauseId }: Props): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const handle = async (): Promise<void> => {
    if (!confirm("End this pause now? The fleet will resume on the next fire.")) {
      return;
    }
    setSubmitting(true);
    await deleteWorkspacePause({ workspaceId, pauseId });
    setSubmitting(false);
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={submitting}
      className="font-mono text-[11px] uppercase text-mute hover:text-ink disabled:opacity-50"
    >
      {submitting ? "ending…" : "end now"}
    </button>
  );
}
