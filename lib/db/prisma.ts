// Prisma client singleton. RLS-aware helpers live in ./rls.ts.
//
// Keep this file vendor-thin. Domain logic does NOT import @prisma/client
// directly — it imports `prisma` from here. This is the seam for swapping
// the ORM later if needed (per project_living_portable_architecture).

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __agentplainPrisma: PrismaClient | undefined;
}

const buildClient = () =>
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

export const prisma: PrismaClient =
  global.__agentplainPrisma ??
  (global.__agentplainPrisma = buildClient());
