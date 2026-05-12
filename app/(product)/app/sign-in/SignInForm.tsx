"use client";

import { useFormState, useFormStatus } from "react-dom";
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
    <form action={formAction} className="space-y-4">
      <label className="block text-sm">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-ink"
        />
      </label>
      {state.error ? (
        <p className="text-sm text-flag" role="alert">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send sign-in link"}
    </button>
  );
}
