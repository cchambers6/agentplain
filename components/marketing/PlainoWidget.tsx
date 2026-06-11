"use client";

// Floating "chat with Plaino" widget for the public marketing site. Mounted
// once in app/(marketing)/layout.tsx so it rides every marketing route.
//
// Anonymous: no auth, no workspace. Talks to /api/chat with mode=marketing.
// When the prospect shows real intent, the lead-capture panel collects an
// email + light context and posts to /api/leads/capture — a real human
// follows up (project_no_outbound_architecture; no drip).
//
// Editorial design language (lib/brand/tokens): paper/ink/clay, hairline
// rules, mono eyebrows, Plaino's calm heritage voice. No exclamation points,
// no emoji — the copy mirrors the voice the model speaks in.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PlainoMark } from "@/components/ui/ap";
import {
  PLAINO_NETWORK_REPLY,
  PLAINO_TRANSIENT_REPLY,
} from "@/lib/plaino/degraded-copy";

interface ChatTurn {
  role: "user" | "plaino";
  body: string;
}

const GREETING: ChatTurn = {
  role: "plaino",
  body:
    "i'm Plaino, the service partner for agentplain. ask me what we do, what " +
    "it costs, or whether we'd fit your business — i'll keep it plain.",
};

export default function PlainoWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // Set true when a turn degrades (paused or transient): we auto-expand the
  // email hand-off so the customer doesn't have to find it. Treat every bot
  // failure as a lead-capture opportunity, not an apology.
  const [leadExpanded, setLeadExpanded] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Stable per-browser-session id so the conversation log can group turns
  // without a cookie. Generated lazily on first open.
  if (sessionIdRef.current === null && typeof crypto !== "undefined") {
    sessionIdRef.current = crypto.randomUUID();
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
          mode: "marketing",
          messages: next,
          conversationId,
          sessionId: sessionIdRef.current ?? undefined,
          sourcePage: pathname,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        reply?: string;
        conversationId?: string | null;
        degraded?: boolean;
        expandLeadCapture?: boolean;
      };
      if (json.ok && json.reply) {
        setMessages((m) => [...m, { role: "plaino", body: json.reply as string }]);
        if (json.conversationId) setConversationId(json.conversationId);
        // Paused/transient turns still come back ok:true with the in-voice
        // notice as the reply; the flag tells us to surface the hand-off.
        if (json.expandLeadCapture || json.degraded) setLeadExpanded(true);
      } else {
        setMessages((m) => [
          ...m,
          { role: "plaino", body: PLAINO_TRANSIENT_REPLY },
        ]);
        setLeadExpanded(true);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "plaino", body: PLAINO_NETWORK_REPLY },
      ]);
      setLeadExpanded(true);
    } finally {
      setSending(false);
    }
  }, [draft, sending, messages, conversationId, pathname]);

  // The lead hand-off becomes available once a real exchange has happened
  // (the prospect asked something and Plaino answered).
  const conversationStarted = messages.length > 1;

  return (
    <>
      {/* Launcher. Below sm it's a compact icon-only clay circle tucked in the
          corner so it doesn't sit on top of body copy the way the full chip
          did on narrow phones; from sm up it's the editorial chip with its
          mono label. */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? "Close chat with Plaino" : "Chat with Plaino"}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center border border-clay bg-clay text-paper transition hover:bg-clay-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-paper sm:bottom-6 sm:right-6 sm:h-auto sm:w-auto sm:gap-2 sm:px-4 sm:py-3 sm:font-mono sm:text-[12px] sm:uppercase sm:tracking-eyebrow"
      >
        <PlainoMark size={20} />
        <span className="hidden sm:inline">
          {open ? "close" : "chat with Plaino"}
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Chat with Plaino"
          className="fixed bottom-24 right-6 z-50 flex max-h-[70vh] w-[min(380px,calc(100vw-3rem))] flex-col border border-rule bg-paper"
        >
          <div className="flex items-center gap-3 border-b border-rule bg-paper-deep px-4 py-3">
            <PlainoMark size={28} />
            <div className="flex-1">
              <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                service partner
              </p>
              <p className="font-display text-lg leading-none text-ink">Plaino</p>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {messages.map((m, i) => (
              <Bubble key={i} turn={m} />
            ))}
            {sending ? (
              <p className="font-mono text-[11px] uppercase tracking-eyebrow text-mute">
                Plaino is fetching that…
              </p>
            ) : null}
            {conversationStarted ? (
              <LeadCapturePanel
                conversationId={conversationId}
                sourcePage={pathname}
                forceExpand={leadExpanded}
              />
            ) : null}
          </div>

          <form
            className="border-t border-rule p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="plaino-widget-input" className="sr-only">
              your message to Plaino
            </label>
            <textarea
              id="plaino-widget-input"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="ask about what we do, pricing, or fit…"
              className="w-full resize-none border border-rule bg-paper px-3 py-2 text-[14px] leading-relaxed text-ink focus:border-ink focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
                a person follows up — no spam
              </span>
              <button
                type="submit"
                disabled={sending || draft.trim().length === 0}
                className="btn-primary px-4 py-2 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                send
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const isPlaino = turn.role === "plaino";
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] uppercase tracking-eyebrow text-mute">
        {isPlaino ? "Plaino" : "you"}
      </p>
      <div
        className={
          isPlaino
            ? "whitespace-pre-wrap border border-rule bg-paper-deep p-3 text-[14px] leading-relaxed text-ink"
            : "whitespace-pre-wrap border border-rule bg-paper p-3 text-[14px] leading-relaxed text-ink"
        }
      >
        {turn.body}
      </div>
    </div>
  );
}

// Inline lead hand-off. Appears once a conversation is underway; the prospect
// can leave an email so a human follows up. Posts to /api/leads/capture.
//
// `forceExpand` is driven by the parent when a turn degrades (paused or
// transient): the panel opens itself so the customer doesn't have to hunt
// for the hand-off after Plaino couldn't answer. Exported so the render
// test can pin the expanded shape without simulating a fetch.
export function LeadCapturePanel({
  conversationId,
  sourcePage,
  forceExpand = false,
}: {
  conversationId: string | null;
  sourcePage: string;
  forceExpand?: boolean;
}) {
  const [expanded, setExpanded] = useState(forceExpand);
  // When the parent flips forceExpand on (a turn just degraded), open the
  // panel. We never auto-collapse — the customer stays in control once open.
  useEffect(() => {
    if (forceExpand) setExpanded(true);
  }, [forceExpand]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [intent, setIntent] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  if (status === "sent") {
    return (
      <div className="border border-moss/40 bg-paper-deep p-3 text-[13px] leading-relaxed text-ink">
        <p className="mb-1 font-mono text-[10px] uppercase tracking-eyebrow text-moss">
          got it
        </p>
        a real person will reach out. no drip, no spam.
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="font-mono text-[11px] uppercase tracking-eyebrow text-clay underline-offset-4 hover:underline"
      >
        want a person to follow up? leave your email →
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim() || undefined,
          intent: intent.trim() || "Asked Plaino on the site; wants a follow-up.",
          sourcePage,
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
        json.fieldErrors?.email ??
          json.formError ??
          "couldn't save that — check the email and try again.",
      );
    } catch {
      setStatus("error");
      setError("couldn't save that — try again shortly.");
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-2 border border-rule bg-paper-deep p-3"
    >
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-mute">
        leave your email — a person follows up
      </p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@business.com"
        autoComplete="email"
        className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="your name (optional)"
        autoComplete="name"
        className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none"
      />
      <input
        type="text"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        placeholder="what you're after (demo, trial, a question…)"
        className="w-full border border-rule bg-paper px-3 py-2 text-[14px] text-ink focus:border-ink focus:outline-none"
      />
      {error ? (
        <p className="font-mono text-[11px] text-flag">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="btn-primary px-4 py-2 text-[12px] disabled:opacity-50"
      >
        {status === "sending" ? "sending…" : "send"}
      </button>
    </form>
  );
}
