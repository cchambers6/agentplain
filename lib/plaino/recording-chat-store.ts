/**
 * lib/plaino/recording-chat-store.ts
 *
 * In-memory IChatStore for tests. Records every call so assertions can
 * pin write order + payload shape. NOT a production path — workspace
 * isolation is enforced by an explicit per-store workspaceId; the
 * production posture is RLS.
 *
 * Also implements `createSupportRequest` so the REGISTER path's
 * hand-off can be observed at the call site.
 */

import { randomUUID } from 'node:crypto';
import type { IChatStore, PersistedChatMessage } from './types';

export interface RecordingChatStoreOptions {
  /** Pre-seed an existing thread id so tests can pin it. */
  threadId?: string;
}

export class RecordingChatStore implements IChatStore {
  readonly name = 'recording' as const;

  private threadId: string | null = null;
  readonly messages: PersistedChatMessage[] = [];
  readonly createdSupportRequests: Array<{
    id: string;
    workspaceId: string;
    fromUserId: string;
    subject: string;
    body: string;
  }> = [];

  constructor(
    private readonly workspaceId: string,
    private readonly options: RecordingChatStoreOptions = {},
  ) {
    if (options.threadId) this.threadId = options.threadId;
  }

  async ensureWorkspaceThread(args: {
    workspaceId: string;
    now?: Date;
  }): Promise<{ id: string; title: string }> {
    this.assertWorkspace(args.workspaceId);
    if (this.threadId === null) {
      this.threadId = randomUUID();
    }
    return { id: this.threadId, title: 'talk with Plaino' };
  }

  async appendMessage(args: {
    threadId: string;
    workspaceId: string;
    role: 'customer' | 'plaino';
    body: string;
    metadata?: Record<string, unknown> | null;
    now?: Date;
  }): Promise<PersistedChatMessage> {
    this.assertWorkspace(args.workspaceId);
    const persisted: PersistedChatMessage = {
      id: randomUUID(),
      threadId: args.threadId,
      workspaceId: args.workspaceId,
      role: args.role,
      body: args.body,
      metadata: args.metadata ?? null,
      createdAt: args.now ?? new Date(),
    };
    this.messages.push(persisted);
    return persisted;
  }

  async listMessages(args: {
    threadId: string;
    workspaceId: string;
    limit?: number;
  }): Promise<PersistedChatMessage[]> {
    this.assertWorkspace(args.workspaceId);
    return this.messages.filter((m) => m.threadId === args.threadId);
  }

  async createSupportRequest(args: {
    workspaceId: string;
    fromUserId: string;
    subject: string;
    body: string;
  }): Promise<string> {
    this.assertWorkspace(args.workspaceId);
    const id = randomUUID();
    this.createdSupportRequests.push({ id, ...args });
    return id;
  }

  private assertWorkspace(workspaceId: string): void {
    if (workspaceId !== this.workspaceId) {
      throw new Error(
        `RecordingChatStore: workspaceId mismatch (store=${this.workspaceId}, arg=${workspaceId})`,
      );
    }
  }
}
