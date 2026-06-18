"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  sendPortalMessageAction,
  type PortalChatActionResult,
} from "@/app/portal/[customerSlug]/chat/actions";

const initial: PortalChatActionResult = { ok: false };

/**
 * Client composer for the end-client ↔ Plaino chat. Posts to the portal chat
 * server action. On success the page revalidates and the new message appears;
 * the notice tells the client their reply is on the way (pending owner review)
 * without exposing the gating machinery.
 */
export function PortalChatComposer({ slug }: { slug: string }) {
  const [state, formAction] = useFormState<PortalChatActionResult, FormData>(
    sendPortalMessageAction.bind(null, slug),
    initial,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && formRef.current) formRef.current.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <label htmlFor="portal-chat-body" className="block text-sm font-medium">
        Send a message
      </label>
      <textarea
        id="portal-chat-body"
        name="body"
        rows={3}
        required
        className="w-full border border-rule bg-white p-3 text-sm text-ink focus:outline-none focus:ring-2"
        style={{ ["--tw-ring-color" as string]: "var(--portal-accent, #B65D3A)" }}
        placeholder="Type your question or update…"
      />
      {state.notice ? (
        <p className="text-[13px] text-moss" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.error ? (
        <p className="text-[13px] text-flag" role="alert">
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
      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      style={{ backgroundColor: "var(--portal-accent, #B65D3A)" }}
    >
      {pending ? "Sending…" : "Send"}
    </button>
  );
}
