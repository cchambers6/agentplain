"use client";

/**
 * GeneratePlaybookButton — generates the new-hire onboarding playbook on
 * the server and downloads it as markdown. Optional preset picker targets
 * the playbook to a specific seat (e.g. "Bookkeeper").
 */

import { useState } from "react";
import { generateTeamPlaybook } from "./actions";

interface PresetChoice {
  key: string;
  title: string;
}

interface Props {
  workspaceId: string;
  presetChoices: PresetChoice[];
}

export function GeneratePlaybookButton({
  workspaceId,
  presetChoices,
}: Props): JSX.Element {
  const [presetKey, setPresetKey] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const generate = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    const result = await generateTeamPlaybook({
      workspaceId,
      newHirePresetKey: presetKey || undefined,
    });
    setBusy(false);
    if (!result.ok || !result.markdown) {
      setError(result.error ?? "Could not generate the playbook.");
      return;
    }
    setPreview(result.markdown);
    // Trigger a download of the markdown.
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename ?? "onboarding-playbook.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="font-mono text-[11px] tracking-eyebrow uppercase text-mute">
          for the role of (optional)
        </span>
        <select
          value={presetKey}
          onChange={(e) => setPresetKey(e.target.value)}
          disabled={busy}
          className="mt-1 w-full rounded-none border border-rule bg-paper px-3 py-2 text-[14px] text-ink"
        >
          <option value="">General — whole team</option>
          {presetChoices.map((p) => (
            <option key={p.key} value={p.key}>
              {p.title}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="rounded-none bg-ink px-4 py-2 text-[13px] text-paper disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate & download"}
      </button>
      {error ? (
        <p className="text-[12px] text-flag" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] text-ink-soft">
            Preview
          </summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap border border-rule bg-paper p-3 text-[12px] text-ink">
            {preview}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
