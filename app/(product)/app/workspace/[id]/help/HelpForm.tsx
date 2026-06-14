"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ApHeritageButton, ApHeritageField } from "@/components/ui/ap";
import {
  sendSupportMessageAction,
  type SupportActionResult,
} from "./actions";

const initial: SupportActionResult = { ok: false };

export function HelpForm({
  workspaceId,
  defaultSubject = "",
}: {
  workspaceId: string;
  /** Pre-filled subject from a funnel "I'm stuck" deep link (?subject=). */
  defaultSubject?: string;
}) {
  const [state, formAction] = useFormState<SupportActionResult, FormData>(
    sendSupportMessageAction.bind(null, workspaceId),
    initial,
  );

  if (state.ok && state.notice) {
    return (
      <p className="border border-rule bg-paper-deep p-4 text-[15px] leading-relaxed text-ink">
        {state.notice}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <ApHeritageField
        label="subject"
        name="subject"
        required
        defaultValue={defaultSubject}
        error={state.fieldErrors?.subject}
        helper="A few words on what you need a hand with."
      />
      <ApHeritageField
        multiline
        label="your message"
        name="body"
        rows={6}
        required
        error={state.fieldErrors?.body}
        helper="Share as much as helps. Your service partner reads every word."
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
      {pending ? "sending…" : "send to your service partner"}
    </ApHeritageButton>
  );
}
