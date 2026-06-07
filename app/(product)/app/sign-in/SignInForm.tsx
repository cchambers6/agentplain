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
        // "webauthn" token lets iOS Safari / Chrome surface a saved passkey in
        // this field's autofill — the conditional-UI ceremony started by
        // PasskeySignInButton hooks into it, so the user can sign in with a
        // passkey straight from the email field, no button, no email typed.
        autoComplete="email webauthn"
        error={state.error ?? undefined}
        helper="We email you a sign-in link. Good for 15 minutes."
      />
      <label className="flex items-start gap-3 border border-rule bg-paper-deep p-3 text-[14px] leading-relaxed text-ink">
        <input
          type="checkbox"
          name="remember"
          value="1"
          defaultChecked
          className="mt-[3px] h-4 w-4 accent-ink"
        />
        <span>
          <span className="font-medium">Stay signed in on this device.</span>{" "}
          <span className="text-ink-soft">
            We&rsquo;ll keep you signed in for 30 days so you skip the email
            link next time.
          </span>
        </span>
      </label>
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
