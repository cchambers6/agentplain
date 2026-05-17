"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface TestConnectionButtonProps {
  workspaceId: string;
  integrationId: string;
}

type TestState = "idle" | "ok" | "fail";

export function TestConnectionButton({
  workspaceId,
  integrationId,
}: TestConnectionButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<TestState>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              const res = await fetch(
                `/api/integrations/${integrationId}/health?workspaceId=${encodeURIComponent(workspaceId)}`,
                { method: "POST" },
              );
              if (res.ok) {
                setState("ok");
                setDetail(null);
              } else {
                const body = (await res.json().catch(() => ({}))) as {
                  error?: string;
                  detail?: string;
                };
                setState("fail");
                setDetail(body.error ?? `HTTP ${res.status}`);
              }
              router.refresh();
            } catch (err) {
              setState("fail");
              setDetail(err instanceof Error ? err.message : "Network error");
            }
          });
        }}
        className="inline-flex items-center gap-2 border border-ink/30 bg-paper px-4 py-2 font-sans text-[13px] text-ink transition hover:border-ink hover:bg-paper-deep disabled:opacity-60"
      >
        {pending ? "Checking…" : "Test connection"}
      </button>
      {state === "ok" && (
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-moss">
          Healthy
        </span>
      )}
      {state === "fail" && (
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-flag">
          Failed — {detail}
        </span>
      )}
    </div>
  );
}
