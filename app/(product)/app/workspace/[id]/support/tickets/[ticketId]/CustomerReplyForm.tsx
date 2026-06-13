"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ApHeritageButton, ApHeritageField } from "@/components/ui/ap";
import { customerReplyAction, type CustomerReplyResult } from "./actions";

const initial: CustomerReplyResult = { ok: false };

export function CustomerReplyForm({
  workspaceId,
  ticketId,
}: {
  workspaceId: string;
  ticketId: string;
}) {
  const [state, formAction] = useFormState<CustomerReplyResult, FormData>(
    customerReplyAction.bind(null, workspaceId, ticketId),
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      <ApHeritageField
        multiline
        label="reply"
        name="body"
        rows={4}
        required
        error={state.ok ? undefined : state.error}
        helper="We'll email you when the team responds."
        key={state.ok ? "sent" : "draft"}
      />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <ApHeritageButton variant="primary" type="submit" disabled={pending}>
      {pending ? "sending…" : "send reply"}
    </ApHeritageButton>
  );
}
