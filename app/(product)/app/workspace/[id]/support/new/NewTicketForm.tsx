"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { ApHeritageButton, ApHeritageField } from "@/components/ui/ap";
import { createTicketAction, type NewTicketActionResult } from "./actions";

const initial: NewTicketActionResult = { ok: false };

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "BILLING", label: "Billing" },
  { value: "WORKFLOW", label: "Workflow" },
  { value: "INTEGRATION", label: "Integration" },
  { value: "BUG", label: "Bug" },
  { value: "OTHER", label: "Other" },
];

const SELECT_BASE =
  "mt-1 block w-full border border-rule bg-paper px-3 py-2 text-[15px] text-ink outline-none transition focus:border-ink focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export function NewTicketForm({
  workspaceId,
  basePath,
}: {
  workspaceId: string;
  basePath: string;
}) {
  const [state, formAction] = useFormState<NewTicketActionResult, FormData>(
    createTicketAction.bind(null, workspaceId),
    initial,
  );

  if (state.ok && state.ticketId) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border border-moss/40 bg-moss/10 p-5 text-[15px] leading-relaxed text-ink"
      >
        <p className="font-medium">
          Got it. Expected first response: {state.slaWindowLabel}.
        </p>
        <p className="mt-2 text-ink-soft">
          We&rsquo;ve opened ticket #{state.number} and emailed you a copy.
          You&rsquo;ll get an email the moment a human replies — or follow the
          thread here any time.
        </p>
        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            href={`${basePath}/support/tickets/${state.ticketId}`}
            className="font-mono text-[12px] uppercase tracking-eyebrow text-ink underline underline-offset-4 hover:text-clay"
          >
            view ticket #{state.number} →
          </Link>
          <Link
            href={`${basePath}/support/tickets`}
            className="font-mono text-[12px] uppercase tracking-eyebrow text-mute underline underline-offset-4 hover:text-ink"
          >
            all my tickets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <ApHeritageField
        label="subject"
        name="subject"
        required
        error={state.fieldErrors?.subject}
        helper="A few words on what you need a hand with."
      />

      <div>
        <label htmlFor="category" className="block">
          <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
            category
          </span>
          <select
            id="category"
            name="category"
            defaultValue="WORKFLOW"
            className={SELECT_BASE}
            aria-invalid={state.fieldErrors?.category ? true : undefined}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {state.fieldErrors?.category ? (
          <p role="alert" className="mt-2 text-[13px] text-flag">
            {state.fieldErrors.category}
          </p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-mute">
            Helps us route your ticket to the right person faster.
          </p>
        )}
      </div>

      <ApHeritageField
        multiline
        label="what's going on"
        name="description"
        rows={7}
        required
        error={state.fieldErrors?.description}
        helper="Share as much as helps — what you expected, what happened, any error you saw. Markdown is fine."
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
      {pending ? "opening your ticket…" : "open a ticket"}
    </ApHeritageButton>
  );
}
