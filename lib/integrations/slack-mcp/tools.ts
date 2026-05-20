/**
 * lib/integrations/slack-mcp/tools.ts
 *
 * The Slack tool registry — zod arg schemas + descriptions + wiring to the
 * `SlackMcpServer` interface. Shared by the HTTP route and the smoke test via
 * `lib/integrations/mcp-core/dispatch.ts`.
 *
 * `post_message` and `send_dm` require a non-empty `approvalToken`: posting
 * routes through the approval queue and never auto-fires (see
 * `project_no_outbound_architecture.md`). The read tools (`list_channels`,
 * `read_channel_history`, `search_messages`) carry no such gate.
 */

import { z } from 'zod';
import type { ToolRegistration } from '@/lib/integrations/mcp-core';
import { SLACK_NAMESPACE, type SlackMcpServer } from './types';

const listChannelsSchema = z.object({
  limit: z.number().int().positive().max(1000).optional(),
});

const readHistorySchema = z.object({
  channel: z.string().min(1),
  limit: z.number().int().positive().max(1000).optional(),
});

const searchSchema = z.object({
  query: z.string().min(1),
  count: z.number().int().positive().max(100).optional(),
});

const postMessageSchema = z.object({
  channel: z.string().min(1),
  text: z.string().min(1),
  approvalToken: z.string().optional(),
});

const sendDmSchema = z.object({
  userId: z.string().min(1),
  text: z.string().min(1),
  approvalToken: z.string().optional(),
});

export const SLACK_TOOLS: ReadonlyArray<ToolRegistration<SlackMcpServer>> = [
  {
    name: `${SLACK_NAMESPACE}.list_channels`,
    description: 'List public + private channels the connected user can see (id, name, privacy, membership, topic).',
    schema: listChannelsSchema,
    invoke: (s, a) => s.listChannels(listChannelsSchema.parse(a)),
  },
  {
    name: `${SLACK_NAMESPACE}.read_channel_history`,
    description: 'Read recent messages from a channel by id (most recent first). Read-only.',
    schema: readHistorySchema,
    invoke: (s, a) => s.readChannelHistory(readHistorySchema.parse(a)),
  },
  {
    name: `${SLACK_NAMESPACE}.search_messages`,
    description: 'Search messages across the workspace with a Slack search query (user-token only). Read-only.',
    schema: searchSchema,
    invoke: (s, a) => s.searchMessages(searchSchema.parse(a)),
  },
  {
    name: `${SLACK_NAMESPACE}.post_message`,
    description:
      'Post a message to a channel AS the customer. APPROVAL-GATED: requires a non-empty approvalToken from the approval queue — never auto-fires.',
    schema: postMessageSchema,
    invoke: (s, a) => s.postMessage(postMessageSchema.parse(a)),
  },
  {
    name: `${SLACK_NAMESPACE}.send_dm`,
    description:
      'Open a DM with a user and post a message AS the customer. APPROVAL-GATED: requires a non-empty approvalToken from the approval queue — never auto-fires.',
    schema: sendDmSchema,
    invoke: (s, a) => s.sendDm(sendDmSchema.parse(a)),
  },
];
