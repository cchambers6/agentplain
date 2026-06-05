import { ApRootedLoader } from "@/components/ui/ap";

// Talk loading fallback. Sits inside the workspace strip while we pull
// the persisted thread and Plaino's drafting state. Contextual copy per
// design language §3.6 — what's happening, not a generic spinner.

export default function TalkLoading() {
  return (
    <div className="mx-auto max-w-3xl py-2">
      <ApRootedLoader kind="first-load" label="Opening your thread with Plaino…" />
    </div>
  );
}
