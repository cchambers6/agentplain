// Inngest serve route. Registers every cron / event-driven function with
// Inngest Cloud at the GET handshake, and delivers per-function invocations
// at POST.
//
// Per PROJECT_STATE PR-B notes: this slim route is the seam future
// functions (Gmail webhook fanout, briefing schedulers, etc.) wire into.
// Adding a function = importing it and appending to the `functions` array.
//
// Per feedback_no_silent_vendor_lock: Inngest itself is the live fleet
// runner per `reference_inngest_is_the_live_fleet`. The disable-flag
// pattern (lib/inngest/disable-flag.ts) is the in-house portability
// surface above Inngest — pausing a function flips its env var rather
// than relying on Inngest Cloud's UI.

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { trialExpirationWarningsFn } from "@/lib/inngest/functions/trial-expiration-warnings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [trialExpirationWarningsFn],
});
