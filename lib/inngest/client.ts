import { Inngest } from 'inngest';

// Inngest client. Reads INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY from env in
// production; in local dev mode the SDK auto-detects the dev server and
// skips signing. `id` is the Inngest app ID — must match what's registered
// on the Inngest cloud dashboard.
export const inngest = new Inngest({
  id: 'agentplain-prod',
  // Inngest auto-reads INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY when present;
  // explicit pass keeps the contract obvious.
  eventKey: process.env.INNGEST_EVENT_KEY,
});
