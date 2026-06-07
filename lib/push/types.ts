// Push-notification boundary types.
//
// The push fan-out is the ONE outbound-to-device surface agentplain owns.
// It is NOT agent outbound (project_no_outbound_architecture forbids the
// agent surface from sending mail/SMS) — a push is the notification system
// telling the OWNER their own work queue moved. The trigger is server-side
// (lib/push/notify), never an agent.
//
// Vendor coupling (Expo) stays behind this interface per
// feedback_no_silent_vendor_lock + feedback_runner_portability: a push
// message is described in our own terms (to/title/body/data), and the Expo
// REST shape lives only inside the adapter. Swapping to APNs/FCM directly,
// or to a different relay, is a one-file change.

export interface PushMessage {
  /** Destination device token (provider-opaque routing handle). */
  to: string;
  title: string;
  body: string;
  /** Arbitrary JSON the app reads on tap (e.g. a deep-link target). */
  data?: Record<string, unknown>;
}

export interface PushTicket {
  /** The token this ticket is for — lets the caller reconcile failures. */
  token: string;
  ok: boolean;
  /**
   * Provider error code when ok=false. The one we act on is
   * "DeviceNotRegistered" — the device uninstalled or revoked, so we disable
   * the row rather than keep fanning out to it.
   */
  error?: string;
}

export interface PushProvider {
  /** Adapter name for logs/tests ("expo" | "noop" | "test"). */
  readonly name: string;
  /**
   * Deliver a batch of messages. Never throws — transport failures resolve
   * to per-token tickets with ok=false so a notification problem can never
   * break the work it was announcing.
   */
  send(messages: PushMessage[]): Promise<PushTicket[]>;
}
