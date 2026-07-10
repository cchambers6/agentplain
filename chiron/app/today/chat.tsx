"use client";

import { useRef, useState } from "react";

interface Turn {
  role: "parent" | "chiron";
  text: string;
}

// Minimal SSE chat surface for the daily loop. No third-party chat SDK —
// plain fetch + ReadableStream over the /api/chat SSE endpoint.
export default function TodayChat({ childName }: { childName: string }) {
  const [turns, setTurns] = useState<Turn[]>([
    {
      role: "chiron",
      text: `Good morning. When today's lessons with ${childName} are done, tell me how it went — a sentence or two is plenty. (The full daily loop arrives in the next milestone; this conversation is already being saved.)`,
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setTurns((t) => [...t, { role: "parent", text }, { role: "chiron", text: "" }]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok || !res.body) throw new Error(`chat failed (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          const dataLine = evt
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice(6));
          if (payload.delta) {
            setTurns((t) => {
              const copy = [...t];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = {
                ...last,
                text: last.text + payload.delta,
              };
              return copy;
            });
          }
        }
        scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
      }
    } catch {
      setTurns((t) => {
        const copy = [...t];
        copy[copy.length - 1] = {
          role: "chiron",
          text: "I couldn't respond just now — your note is saved, and I'll pick it up next time.",
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto py-6">
        {turns.map((t, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-4 py-3 leading-relaxed ${
              t.role === "parent"
                ? "ml-auto bg-walnut text-parchment"
                : "bg-white"
            }`}
          >
            {t.text || "…"}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2 border-t border-walnut/20 pt-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="How did today go?"
          className="flex-1 rounded-md border border-walnut/40 bg-white px-4 py-3"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-walnut px-6 font-serif text-parchment disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </>
  );
}
