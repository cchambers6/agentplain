import { ApRootedLoader } from "@/components/ui/ap";

// Memory-page loading fallback. We pull the workspace's durable memory
// shelf (decrypted per row) before render. Contextual copy per design
// language §3.6 — what's happening, not a generic spinner.

export default function MemoryLoading() {
  return (
    <div className="mx-auto max-w-3xl py-2">
      <ApRootedLoader kind="first-load" label="Opening what Plaino remembers…" />
    </div>
  );
}
