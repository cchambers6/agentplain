"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { ApHeritageButton, ApHeritageField } from "@/components/ui/ap";
import {
  sendPlainoMessageAction,
  type TalkActionResult,
} from "./actions";

const initial: TalkActionResult = { ok: false };

export function TalkComposer({
  workspaceId,
  degraded = false,
}: {
  workspaceId: string;
  degraded?: boolean;
}) {
  const [state, formAction] = useFormState<TalkActionResult, FormData>(
    sendPlainoMessageAction.bind(null, workspaceId),
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the composer once the action returns OK. The page rerenders
  // with the new turn via revalidatePath inside the action.
  useEffect(() => {
    if (state.ok && formRef.current) {
      formRef.current.reset();
    }
  }, [state.ok]);

  if (degraded) {
    return (
      <div className="space-y-4">
        <ApHeritageField
          multiline
          label="your message to Plaino"
          name="body"
          rows={4}
          disabled
          placeholder="Plaino is offline for the moment."
          helper="Plaino will be back online shortly — no action needed from you."
        />
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <ApHeritageField
        multiline
        label="your message to Plaino"
        name="body"
        rows={4}
        required
        error={state.fieldErrors?.body}
        helper="A few sentences. Plaino fetches from your workspace context, herds work through the team, or says honestly what's not yet wired."
      />
      {state.formError ? (
        <p className="text-[13px] leading-relaxed text-flag" role="alert">
          {state.formError}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <ApHeritageButton variant="primary" type="submit" disabled={pending}>
      {pending ? "Plaino is fetching that…" : "send to Plaino"}
    </ApHeritageButton>
  );
}
