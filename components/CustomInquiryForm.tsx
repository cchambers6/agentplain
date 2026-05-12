"use client";

import { useState } from "react";
import {
  CUSTOM_INQUIRY_VERTICAL_OPTIONS,
  type CustomInquiryInput,
  type CustomInquirySubmitResponse,
} from "@/lib/custom-inquiry/types";

// Contact form for /custom. Per `project_no_outbound_architecture.md` the
// form posts to /api/custom-inquiry, which emails Conner's inbox and renders
// an ack. No drip sequences, no auto-replies beyond the synchronous "got
// it" state below.
//
// Per `feedback_everything_tells_a_story.md` the form answers the visitor's
// final question on the page ("how do I start a conversation?"). Required
// fields stay short — name / business / vertical / seats / needs / email —
// because anything longer reads as a barrier and the visitor already gave
// up two minutes reading the page above it.

const FIELD_LABEL: Record<keyof CustomInquiryInput, string> = {
  name: "Your name",
  business: "Business name",
  vertical: "Vertical",
  seats: "Seats (estimate)",
  needs: "What you need",
  email: "Email",
};

const INITIAL_STATE: CustomInquiryInput = {
  name: "",
  business: "",
  vertical: "other",
  seats: "",
  needs: "",
  email: "",
};

// Human-readable label for each vertical option in the select. We re-derive
// the label from the slug to avoid drift if a slug gets renamed.
function verticalLabel(slug: string): string {
  if (slug === "other") return "Other / not sure yet";
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CustomInquiryForm() {
  const [state, setState] = useState<CustomInquiryInput>(INITIAL_STATE);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof CustomInquiryInput, string>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);

  function update<K extends keyof CustomInquiryInput>(
    key: K,
    value: CustomInquiryInput[K],
  ) {
    setState((s) => ({ ...s, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((errs) => {
        const next = { ...errs };
        delete next[key];
        return next;
      });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setFormError(null);
    setFieldErrors({});

    try {
      const res = await fetch("/api/custom-inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const json = (await res.json()) as CustomInquirySubmitResponse;
      if (json.ok) {
        setStatus("sent");
        return;
      }
      setStatus("error");
      if (json.fieldErrors) setFieldErrors(json.fieldErrors);
      if (json.formError) setFormError(json.formError);
    } catch (err) {
      setStatus("error");
      setFormError(
        err instanceof Error
          ? err.message
          : "Something went wrong sending your inquiry. Email hello@agentplain.com directly.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="border border-rule bg-paper p-8 md:p-10">
        <p className="eyebrow mb-3 text-clay">Inquiry sent</p>
        <h3 className="font-display text-3xl leading-tight text-ink md:text-4xl">
          Got it. We&apos;ll come back with a written spec.
        </h3>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          Expect a reply within two business days from a real human, not a
          drip sequence. We&apos;ll come back with a scoping call invite plus
          a written spec covering what we&apos;d build, how long it&apos;d
          take, and what it&apos;d cost. No surprise charges.
        </p>
        <p className="mt-6 font-mono text-[12px] leading-relaxed text-mute">
          If two days pass and you haven&apos;t heard from us, email{" "}
          <a href="mailto:hello@agentplain.com" className="underline">
            hello@agentplain.com
          </a>{" "}
          — the inquiry probably hit a spam filter.
        </p>
      </div>
    );
  }

  return (
    <form
      id="custom-contact"
      onSubmit={onSubmit}
      className="border border-rule bg-paper p-6 md:p-10"
      noValidate
    >
      <p className="eyebrow mb-6">Tell us what you need</p>

      <div className="grid gap-6 md:grid-cols-2">
        <TextField
          id="cu-name"
          label={FIELD_LABEL.name}
          value={state.name}
          onChange={(v) => update("name", v)}
          error={fieldErrors.name}
          autoComplete="name"
        />
        <TextField
          id="cu-business"
          label={FIELD_LABEL.business}
          value={state.business}
          onChange={(v) => update("business", v)}
          error={fieldErrors.business}
          autoComplete="organization"
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <SelectField
          id="cu-vertical"
          label={FIELD_LABEL.vertical}
          value={state.vertical}
          onChange={(v) =>
            update("vertical", v as CustomInquiryInput["vertical"])
          }
          error={fieldErrors.vertical}
          options={CUSTOM_INQUIRY_VERTICAL_OPTIONS.map((slug) => ({
            value: slug,
            label: verticalLabel(slug),
          }))}
        />
        <TextField
          id="cu-seats"
          label={FIELD_LABEL.seats}
          value={state.seats}
          onChange={(v) => update("seats", v)}
          error={fieldErrors.seats}
          placeholder="e.g. 25 producers + 5 staff"
        />
      </div>

      <div className="mt-6">
        <label
          htmlFor="cu-needs"
          className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
        >
          {FIELD_LABEL.needs}
        </label>
        <textarea
          id="cu-needs"
          rows={6}
          value={state.needs}
          onChange={(e) => update("needs", e.target.value)}
          placeholder="What the standard fleet doesn't do for you yet. Bespoke integration, compliance corpus, white-label, 100+ seats — anything."
          className={`mt-2 w-full border bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink focus:outline-none ${
            fieldErrors.needs
              ? "border-flag focus:border-flag"
              : "border-rule focus:border-ink"
          }`}
        />
        {fieldErrors.needs ? (
          <p className="mt-1 font-mono text-[11px] text-flag">
            {fieldErrors.needs}
          </p>
        ) : null}
      </div>

      <div className="mt-6 max-w-md">
        <TextField
          id="cu-email"
          label={FIELD_LABEL.email}
          value={state.email}
          onChange={(v) => update("email", v)}
          error={fieldErrors.email}
          autoComplete="email"
          type="email"
        />
      </div>

      {formError ? (
        <p className="mt-6 border-l-2 border-flag bg-paper-deep p-3 font-mono text-[12px] text-flag">
          {formError}
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "sending"}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "sending" ? "Sending…" : "Send inquiry"}
          <span aria-hidden>→</span>
        </button>
        <p className="font-mono text-[11px] leading-relaxed text-mute">
          We email one human; no drip sequence, no auto-reply.
        </p>
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`mt-2 w-full border bg-paper px-4 py-3 text-[15px] text-ink focus:outline-none ${
          error
            ? "border-flag focus:border-flag"
            : "border-rule focus:border-ink"
        }`}
      />
      {error ? (
        <p className="mt-1 font-mono text-[11px] text-flag">{error}</p>
      ) : null}
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  error,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[11px] tracking-eyebrow uppercase text-mute"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border bg-paper px-4 py-3 text-[15px] text-ink focus:outline-none ${
          error
            ? "border-flag focus:border-flag"
            : "border-rule focus:border-ink"
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 font-mono text-[11px] text-flag">{error}</p>
      ) : null}
    </div>
  );
}
