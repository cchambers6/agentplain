/**
 * lib/plaino/event-emitter.ts
 *
 * Two IEventEmitter impls — the Inngest-backed production emitter and
 * a recording emitter for tests. Per project_no_outbound_architecture:
 * "outbound" here means an INTERNAL Inngest event the support-handler
 * skill listens for. No external surface is touched by the emit.
 */

import { inngest } from '../inngest/client';
import type { IEventEmitter } from './types';

export class InngestEventEmitter implements IEventEmitter {
  readonly name = 'inngest' as const;

  async emit(args: {
    name: string;
    data: Record<string, unknown>;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      await inngest.send({ name: args.name, data: args.data });
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

export class RecordingEventEmitter implements IEventEmitter {
  readonly name = 'recording' as const;
  readonly events: Array<{ name: string; data: Record<string, unknown> }> = [];
  private failNext = false;

  failNextEmit(): void {
    this.failNext = true;
  }

  async emit(args: {
    name: string;
    data: Record<string, unknown>;
  }): Promise<{ ok: true } | { ok: false; error: string }> {
    if (this.failNext) {
      this.failNext = false;
      return { ok: false, error: 'recording emitter forced failure' };
    }
    this.events.push({ name: args.name, data: { ...args.data } });
    return { ok: true };
  }
}
