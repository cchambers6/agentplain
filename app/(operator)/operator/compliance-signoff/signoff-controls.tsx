"use client";

// pfd-5 — client controls for the counsel sign-off console.
//
// SignoffForm: record (or re-record) a sign-off. Takes the signed artifact
//   URL/ref + an optional note. Uses useFormState so server-side validation
//   errors (bad ref, unknown vertical) surface inline.
// RevokeButton: revoke an existing sign-off (with a confirm), immediately
//   re-gating the vertical.

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";

type ActionResult = { ok: boolean; error?: string };

const initial: ActionResult = { ok: false };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-ink bg-paper-deep px-4 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-ink hover:bg-ink hover:text-paper disabled:opacity-50"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function SignoffForm({
  verticalSlug,
  action,
}: {
  verticalSlug: string;
  action: (
    _prev: ActionResult | undefined,
    form: FormData,
  ) => Promise<ActionResult>;
}) {
  const [state, formAction] = useFormState<ActionResult, FormData>(
    action,
    initial,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="verticalSlug" value={verticalSlug} />
      <div>
        <label
          htmlFor={`artifactRef-${verticalSlug}`}
          className="font-mono text-[10px] uppercase tracking-eyebrow text-mute"
        >
          Signed counsel artifact (URL / blob ref)
        </label>
        <input
          id={`artifactRef-${verticalSlug}`}
          name="artifactRef"
          type="text"
          required
          placeholder="https://… or blob://…"
          className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
        />
      </div>
      <div>
        <label
          htmlFor={`note-${verticalSlug}`}
          className="font-mono text-[10px] uppercase tracking-eyebrow text-mute"
        >
          Note (optional)
        </label>
        <input
          id={`note-${verticalSlug}`}
          name="note"
          type="text"
          placeholder="Counsel firm, packet version…"
          className="mt-1 w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
        />
      </div>
      {state.error ? (
        <p className="border border-clay bg-paper px-3 py-2 text-[13px] text-clay">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="border border-rule bg-paper-deep px-3 py-2 text-[13px] text-ink-soft">
          Sign-off recorded.
        </p>
      ) : null}
      <SubmitButton label="Record sign-off" />
    </form>
  );
}

export function RevokeButton({
  verticalSlug,
  action,
}: {
  verticalSlug: string;
  action: (verticalSlug: string) => Promise<ActionResult>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (
            !window.confirm(
              `Revoke counsel sign-off for "${verticalSlug}"? Rewrite-and-stage ` +
                `will immediately stop drafting replacement legal text for this ` +
                `industry until re-signed.`,
            )
          ) {
            return;
          }
          setPending(true);
          setError(null);
          const result = await action(verticalSlug);
          setPending(false);
          if (!result.ok) setError(result.error ?? "Revoke failed.");
        }}
        className="border border-clay bg-paper px-4 py-2 font-mono text-[11px] uppercase tracking-eyebrow text-clay hover:bg-clay hover:text-paper disabled:opacity-50"
      >
        {pending ? "Revoking…" : "Revoke sign-off"}
      </button>
      {error ? (
        <p className="mt-2 text-[13px] text-clay">{error}</p>
      ) : null}
    </div>
  );
}
