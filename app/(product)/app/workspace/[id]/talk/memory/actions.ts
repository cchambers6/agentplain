"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspaceMember } from "@/lib/auth/server";
import { PrismaMemoryStore } from "@/lib/plaino";
import {
  memoryDeleteInputSchema,
  memoryEditInputSchema,
  memoryPinInputSchema,
} from "@/lib/plaino/memory";

function memoryStoreFor(args: {
  workspaceId: string;
  userId: string;
  isOperator: boolean;
}): PrismaMemoryStore {
  return new PrismaMemoryStore(args.workspaceId, {
    ctx: {
      userId: args.userId,
      workspaceId: args.workspaceId,
      isOperator: args.isOperator,
    },
  });
}

function bump(workspaceId: string): void {
  revalidatePath(`/app/workspace/${workspaceId}/talk/memory`);
  revalidatePath(`/app/workspace/${workspaceId}/talk`);
}

export async function pinAction(
  workspaceId: string,
  form: FormData,
): Promise<void> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const parsed = memoryPinInputSchema.safeParse({
    id: form.get("id"),
    pinned: form.get("pinned") === "true",
  });
  if (!parsed.success) {
    bump(workspaceId);
    return;
  }
  const store = memoryStoreFor({
    workspaceId,
    userId: member.userId,
    isOperator: member.isOperator,
  });
  try {
    await store.setPinned({
      workspaceId,
      id: parsed.data.id,
      pinned: parsed.data.pinned,
    });
  } catch {
    // Surface nothing here — the page re-renders and the row stays
    // in its previous state.
  }
  bump(workspaceId);
}

export async function editAction(
  workspaceId: string,
  form: FormData,
): Promise<void> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const parsed = memoryEditInputSchema.safeParse({
    id: form.get("id"),
    title: typeof form.get("title") === "string" ? form.get("title") : "",
    body: typeof form.get("body") === "string" ? form.get("body") : "",
  });
  if (!parsed.success) {
    bump(workspaceId);
    return;
  }
  const store = memoryStoreFor({
    workspaceId,
    userId: member.userId,
    isOperator: member.isOperator,
  });
  try {
    await store.edit({
      workspaceId,
      id: parsed.data.id,
      title: parsed.data.title,
      body: parsed.data.body,
    });
  } catch {
    // ignored — page re-renders with previous state
  }
  bump(workspaceId);
}

export async function deleteAction(
  workspaceId: string,
  form: FormData,
): Promise<void> {
  const member = await requireWorkspaceMember(workspaceId, ["BROKER_OWNER"]);
  const parsed = memoryDeleteInputSchema.safeParse({ id: form.get("id") });
  if (!parsed.success) {
    bump(workspaceId);
    return;
  }
  const store = memoryStoreFor({
    workspaceId,
    userId: member.userId,
    isOperator: member.isOperator,
  });
  try {
    await store.delete({ workspaceId, id: parsed.data.id });
  } catch {
    // ignored — page re-renders with previous state
  }
  bump(workspaceId);
}
