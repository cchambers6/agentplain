/**
 * lib/plaino/recording-instruction-queue-store.ts
 *
 * In-memory `IInstructionQueueStore` for tests. Records every call so
 * the integration test can assert on the full chain: dispatcher creates
 * a queue item → Inngest handler reads it → handler drafts → handler
 * writes the draft back → operator queue surfaces the draft.
 *
 * The two-implementation rule for ports: production = PrismaInstructionQueueStore,
 * tests = this. Skills + the Inngest handler never see Prisma directly.
 */

import type {
  IInstructionQueueStore,
  InstructionDraft,
  InstructionQueueItem,
} from './instruction-handler';

export class RecordingInstructionQueueStore implements IInstructionQueueStore {
  readonly name = 'recording' as const;

  private readonly items = new Map<string, InstructionQueueItem>();
  private readonly drafted = new Map<string, boolean>();
  readonly attachedDrafts: Array<{
    approvalQueueItemId: string;
    workspaceId: string;
    draft: InstructionDraft;
    at: Date;
  }> = [];

  /** Seed an instruction the dispatcher would have queued. */
  seed(item: InstructionQueueItem): void {
    this.items.set(item.approvalQueueItemId, item);
  }

  async readForDrafting(args: {
    approvalQueueItemId: string;
  }): Promise<InstructionQueueItem | null> {
    if (this.drafted.get(args.approvalQueueItemId)) return null;
    return this.items.get(args.approvalQueueItemId) ?? null;
  }

  async attachDraft(args: {
    approvalQueueItemId: string;
    workspaceId: string;
    draft: InstructionDraft;
    now?: Date;
  }): Promise<void> {
    this.attachedDrafts.push({
      approvalQueueItemId: args.approvalQueueItemId,
      workspaceId: args.workspaceId,
      draft: args.draft,
      at: args.now ?? new Date(),
    });
    this.drafted.set(args.approvalQueueItemId, true);
  }
}
