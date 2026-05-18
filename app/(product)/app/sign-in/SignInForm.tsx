"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ApHeritageButton, ApHeritageField } from "@/components/ui/ap";
import { requestSignInAction, type ActionResult } from "../actions";

const initial: ActionResult = { ok: false };

export function SignInForm() {
  const [state, formAction] = useFormState<ActionResult, FormData>(
    requestSignInAction,
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
        label="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        error={state.error ?? undefined}
        helper="We email you a sign-in link. Good for 15 minutes."
      />
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <ApHeritageButton variant="primary" type="submit" disabled={pending}>
      {pending ? "sending link…" : "send sign-in link"}
    </ApHeritageButton>
  );
}
