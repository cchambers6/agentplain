// Inngest serve route. Registers every cron / event-driven function with
// Inngest Cloud at the GET handshake, and delivers per-function invocations
// at POST.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ DO NOT add a function array here. Functions are auto-derived from         │
// │ ./functions by lib/inngest/registry.ts at build time.                     │
// │                                                                           │
// │ To add a new Inngest function: create a file in lib/inngest/functions/    │
// │ that exports your `inngest.createFunction(...)` — that's it. The registry │
// │ discovers it automatically. Do NOT modify this file.                      │
// │                                                                           │
// │ This is deliberate: the old manual `functions: [...]` array was the       │
// │ single line every Inngest PR edited, which made it a chronic stacked-PR   │
// │ merge-conflict hotspot (and once shipped a duplicate function id that     │
// │ broke the production build). See lib/inngest/registry.ts for the full     │
// │ rationale and the duplicate-id build guard.                               │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Per feedback_no_silent_vendor_lock: Inngest itself is the live fleet
// runner per `reference_inngest_is_the_live_fleet`. The disable-flag
// pattern (lib/inngest/disable-flag.ts) is the in-house portability
// surface above Inngest — pausing a function flips its env var rather
// than relying on Inngest Cloud's UI.

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { allInngestFunctions } from "@/lib/inngest/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allInngestFunctions,
});
