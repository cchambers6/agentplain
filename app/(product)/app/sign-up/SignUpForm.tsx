"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signUpAction, type ActionResult } from "../actions";

const initial: ActionResult = { ok: false };

export interface VerticalOption {
  slug: string;
  name: string;
}

export function SignUpForm({
  verticals,
  defaultVerticalSlug,
}: {
  /** Server-rendered to avoid pulling the marketing content bundle into the client. */
  verticals: VerticalOption[];
  /** Pre-selected vertical slug from /(marketing)/[vertical] → /app/sign-up?vertical=… */
  defaultVerticalSlug?: string;
}) {
  const [state, formAction] = useFormState<ActionResult, FormData>(
    signUpAction,
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
      <VerticalField
        verticals={verticals}
        defaultValue={defaultVerticalSlug ?? "real-estate"}
      />
      <Field
        label="Brokerage / firm name"
        name="brokerageName"
        required
        placeholder="Acme Realty"
        autoComplete="organization"
      />
      <Field
        label="Your email"
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        label="Your name (optional)"
        name="ownerName"
        autoComplete="name"
      />
      {state.error ? (
        <p className="text-sm text-amber" role="alert">
          {state.error}
        </p>
      ) : null}
      <Submit />
    </form>
  );
}

function VerticalField({
  verticals,
  defaultValue,
}: {
  verticals: VerticalOption[];
  defaultValue: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-mono text-[11px] tracking-eyebrow uppercase text-slate">
        Vertical
      </span>
      <select
        name="vertical"
        required
        defaultValue={defaultValue}
        className="mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-ink"
      >
        {verticals.map((v) => (
          <option key={v.slug} value={v.slug}>
            {v.name}
            {v.slug === "real-estate" ? "" : " — early access"}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-mono text-[11px] tracking-eyebrow uppercase text-slate">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[15px] text-ink outline-none focus:border-ink"
      />
    </label>
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
      {pending ? "Creating workspace…" : "Create workspace"}
    </button>
  );
}
