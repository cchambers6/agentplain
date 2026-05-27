"use client";

import { useActionState, useState } from "react";
import { ApHeritageButton, ApHeritageField } from "@/components/ui/ap";
import {
  initiateClosureAction,
  type InitiateClosureActionState,
} from "./actions";

// Typed-confirmation form for workspace closure. The customer must type
// the workspace name EXACTLY (case-sensitive after trim) before the
// "close workspace" button enables. Server-side `initiateWorkspaceClosure`
// re-checks the match inside its transaction — the client-side enable
// guard is UX, the server check is the gate.

interface Props {
  workspaceId: string;
  workspaceName: string;
}

const INITIAL: InitiateClosureActionState = { ok: true };

export function ClosureConfirmForm({ workspaceId, workspaceName }: Props) {
  const [state, formAction] = useActionState<InitiateClosureActionState, FormData>(
    initiateClosureAction,
    INITIAL,
  );
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const matches = typed.trim() === workspaceName.trim();

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="workspaceId" value={workspaceId} />

      <ApHeritageField
        label={`type "${workspaceName}" to confirm`}
        name="typedConfirmation"
        type="text"
        autoComplete="off"
        required
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        helper="The name has to match exactly — case-sensitive."
      />

      <ApHeritageField
        multiline
        label="why are you closing? (optional)"
        name="reason"
        rows={3}
        maxLength={1000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        helper="Helps your service partner improve. Not shared with anyone outside agentplain."
      />

      {state.error ? (
        <p
          role="alert"
          className="border border-flag bg-flag/5 px-3 py-2 text-[13px] leading-relaxed text-flag"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-5">
        <p className="text-[12px] leading-relaxed text-mute">
          You can cancel any time before the grace window ends.
        </p>
        <ApHeritageButton type="submit" variant="primary" disabled={!matches}>
          close this workspace
        </ApHeritageButton>
      </div>
    </form>
  );
}
