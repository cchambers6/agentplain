"use client";

// Full-page in-app support chat at /app/workspace/[id]/support. The signed-in
// customer asks "how do I" / "why did" / "where is" questions; Plaino answers
// grounded in the knowledge substrate + workspace context (via /api/chat
// mode=support).
//
// When Plaino can't resolve it — the customer wants a human, or it needs an
// account-specific change — the "send this to the team" panel drafts a
// SupportRequest into the operator review queue (/api/support/draft). Nothing
// is sent to the customer from here; a person reviews the draft and replies
// (project_no_outbound_architecture).

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plaino } from "@/components/ui/ap/Plaino";

interface ChatTurn {
  role: "user" | "plaino";
  body: string;
}

function greeting(workspaceName: string): ChatTurn {
  return {
    role: "plaino",
    body:
      `i'm Plaino — your service partner for ${workspaceName}. ask me how ` +
      "something works, why you're seeing it, or where to find it. if it " +
      "needs a person, i'll get it to the team for review.",
  };
}

interface Props {
  workspaceId: string;
  workspaceName: string;
}

export default function PlainoSupportChat({ workspaceId, workspaceName }: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([greeting(workspaceName)]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (body.length === 0 || sending) return;
    const next = [...messages, { role: "user" as const, body }];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "support",
          workspaceId,
          messages: next,
          conversationId,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        reply?: string;
        conversationId?: string | null;
      };
      if (json.ok && json.reply) {
        setMessages((m) => [...m, { role: "plaino", body: json.reply as string }]);
        if (json.conversationId) setConversationId(json.conversationId);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "plaino",
            body:
              "i couldn't reach the line just now. try again, or send it to " +
              "the team below and a person will follow up.",
          },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "plaino", body: "i couldn't reach the line. try again shortly." },
      ]);
    } finally {
      setSending(false);
    }
  }, [draft, sending, messages, workspaceId, conversationId]);

  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === "user")?.body ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <Plaino state="head-icon" size={48} alt="Plaino" />
        <div>
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            support
          </p>
          <h1 className="font-display text-3xl leading-tight text-ink">
            What can Plaino help you with?
          </h1>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="mb-4 max-h-[55vh] space-y-6 overflow-y-auto border-l border-rule pl-6"
        aria-live="polite"
        aria-label="support conversation with Plaino"
      >
        {messages.map((m, i) => (
          <Bubble key={i} turn={m} />
        ))}
        {sending ? (
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            Plaino is fetching that…
          </p>
        ) : null}
      </div>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="plaino-support-input" className="sr-only">
          your question for Plaino
        </label>
        <textarea
          id="plaino-support-input"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="ask how something works, or what you're seeing…"
          className="w-full resize-none border border-rule bg-paper px-4 py-3 text-[15px] leading-relaxed text-ink focus:border-ink focus:outline-none"
        />
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            Plaino answers from your workspace + the knowledge base
          </span>
          <button
            type="submit"
            disabled={sending || draft.trim().length === 0}
            className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            ask Plaino
          </button>
        </div>
      </form>

      <SendToTeamPanel
        workspaceId={workspaceId}
        conversationId={conversationId}
        seedBody={lastUserMessage}
      />
    </div>
  );
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const isPlaino = turn.role === "plaino";
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-eyebrow text-mute">
        {isPlaino ? <Plaino state="head-icon" size={16} /> : null}
        <span>{isPlaino ? "Plaino" : "You"}</span>
      </div>
      <div
        className={
          isPlaino
            ? "whitespace-pre-wrap border border-rule bg-paper-deep p-4 text-[15px] leading-relaxed text-ink"
            : "whitespace-pre-wrap border border-rule bg-paper p-4 text-[15px] leading-relaxed text-ink"
        }
      >
        {turn.body}
      </div>
    </div>
  );
}

// Draft-into-review hand-off. Drafts a SupportRequest that lands in the
// operator review queue (kind SUPPORT_HANDLER_REPLY_DRAFT). No auto-send.
function SendToTeamPanel({
  workspaceId,
  conversationId,
  seedBody,
}: {
  workspaceId: string;
  conversationId: string | null;
  seedBody: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  // Prefill from the last thing the customer asked, once, when opening.
  function open() {
    if (!expanded) {
      if (body.length === 0 && seedBody.length > 0) setBody(seedBody);
      if (subject.length === 0 && seedBody.length > 0) {
        setSubject(seedBody.slice(0, 80));
      }
    }
    setExpanded(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/support/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          subject: subject.trim(),
          body: body.trim(),
          conversationId: conversationId ?? undefined,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        formError?: string;
        fieldErrors?: Record<string, string>;
      };
      if (json.ok) {
        setStatus("sent");
        return;
      }
      setStatus("error");
      setError(
        json.fieldErrors?.subject ??
          json.fieldErrors?.body ??
          json.formError ??
          "couldn't send that to the team — try again.",
      );
    } catch {
      setStatus("error");
      setError("couldn't send that to the team — try again shortly.");
    }
  }

  if (status === "sent") {
    return (
      <div className="mt-6 border border-moss/40 bg-paper-deep p-4 text-[15px] leading-relaxed text-ink">
        <p className="mb-1 font-mono text-[11px] uppercase tracking-eyebrow text-moss">
          sent to the team
        </p>
        your team is drafting a reply for review. track it under{" "}
        <Link
          href={`/app/workspace/${workspaceId}/approvals`}
          className="text-ink underline-offset-4 hover:underline"
        >
          approvals →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-rule pt-4">
      {!expanded ? (
        <button
          type="button"
          onClick={open}
          className="font-mono text-[11px] uppercase tracking-eyebrow text-clay underline-offset-4 hover:underline"
        >
          need a person? send this to the team →
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
            send to the team — a person reviews + replies
          </p>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="short subject"
            className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none"
          />
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="what you need help with"
            className="w-full resize-none border border-rule bg-paper px-3 py-2 text-[14px] leading-relaxed text-ink focus:border-ink focus:outline-none"
          />
          {error ? (
            <p className="font-mono text-[11px] text-flag">{error}</p>
          ) : null}
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === "sending"}
              className="btn-primary px-4 py-2 text-[13px] disabled:opacity-50"
            >
              {status === "sending" ? "sending…" : "send to the team"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="font-mono text-[11px] uppercase tracking-eyebrow text-mute underline-offset-4 hover:underline"
            >
              cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
