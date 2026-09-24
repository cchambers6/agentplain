// Tests for the credential restore path.
//
// The test that matters most is the false-positive one. The first revision of
// verifyCredential returned success whenever it failed to RECOGNISE an error,
// so a run where `npx prisma` did not resolve at all (exit 2, no Prisma output)
// was read as "credential accepted" - and the script then overwrote production
// configuration with a password nothing had ever checked. Absence of a known
// error is not evidence of success. That case is pinned below.

import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveDirectUrl,
  validateUrl,
  makeRedactor,
  verifyCredential,
  readPrismaVersion,
  resolveVercelToken,
  setVercelProductionEnv,
  GITHUB_SECRETS,
} from "./restore-db-credential.mjs";

const POOLED =
  "postgresql://neondb_owner:pw@ep-aged-snow-aq0e4b6k-pooler.c-8.us-east-1.aws.neon.tech:5432/neondb?sslmode=require";

const runnerReturning = (out, status) => () => ({ stdout: out, stderr: "", status });

test("the direct host is the pooled host without -pooler", () => {
  assert.equal(
    new URL(deriveDirectUrl(POOLED)).hostname,
    "ep-aged-snow-aq0e4b6k.c-8.us-east-1.aws.neon.tech",
  );
});

test("deriving preserves credentials, database and query string", () => {
  const u = new URL(deriveDirectUrl(POOLED));
  assert.equal(u.username, "neondb_owner");
  assert.equal(u.password, "pw");
  assert.equal(u.pathname, "/neondb");
  assert.equal(u.searchParams.get("sslmode"), "require");
});

test("a host that is already direct is left unchanged", () => {
  const direct = POOLED.replace("-pooler", "");
  assert.equal(deriveDirectUrl(direct), new URL(direct).toString());
});

test("rejects non-postgres, credential-less and non-neon URLs", () => {
  for (const raw of [
    "https://example.com",
    "postgresql://ep-x.neon.tech/db",
    "postgresql://u:p@example.com/db",
  ]) {
    assert.throws(() => validateUrl(raw, "TEST"));
  }
});

test("accepts a well-formed Neon URL", () => {
  assert.equal(validateUrl(POOLED, "TEST").username, "neondb_owner");
});

test("the redactor removes supplied secrets and any stray connection string", () => {
  const redact = makeRedactor([POOLED, "hunter2hunter2"]);
  assert.ok(!redact("url=" + POOLED).includes("neondb_owner"));
  assert.ok(!redact("token hunter2hunter2 here").includes("hunter2hunter2"));
  assert.ok(!redact("postgresql://someone:else@host/db").includes("else"));
});

test("the redactor ignores short strings so it cannot blank ordinary output", () => {
  assert.equal(makeRedactor(["ok"])("everything is ok"), "everything is ok");
});

test("REGRESSION: an unrecognised failure is UNVERIFIED, never success", () => {
  // Exactly what bit us: npx could not resolve prisma, exit 2, no Prisma output.
  const r = verifyCredential(POOLED, POOLED, {
    runner: runnerReturning('{"kind":"result","envelope":{}}', 2),
    prismaVersion: "6.19.3",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "UNVERIFIED");
});

test("REGRESSION: empty output with exit 0 is still not success", () => {
  const r = verifyCredential(POOLED, POOLED, {
    runner: runnerReturning("", 0),
    prismaVersion: "6.19.3",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "UNVERIFIED");
});

test("a rejected password is reported as P1000", () => {
  const r = verifyCredential(POOLED, POOLED, {
    runner: runnerReturning("Error: P1000: Authentication failed against database server", 1),
    prismaVersion: "6.19.3",
  });
  assert.equal(r.ok, false);
  assert.equal(r.code, "P1000");
});

test("an unreachable database is reported as P1001", () => {
  const r = verifyCredential(POOLED, POOLED, {
    runner: runnerReturning("Error: P1001: Cannot reach database server", 1),
    prismaVersion: "6.19.3",
  });
  assert.equal(r.code, "P1001");
});

test("a clean schema needs BOTH exit 0 and the success line", () => {
  const ok = verifyCredential(POOLED, POOLED, {
    runner: runnerReturning("Database schema is up to date!", 0),
    prismaVersion: "6.19.3",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.code, "CLEAN");

  const notOk = verifyCredential(POOLED, POOLED, {
    runner: runnerReturning("Database schema is up to date!", 1),
    prismaVersion: "6.19.3",
  });
  assert.equal(notOk.ok, false);
});

test("pending migrations verify the credential and are reported as PENDING", () => {
  const r = verifyCredential(POOLED, POOLED, {
    runner: runnerReturning("2 migrations have not yet been applied", 1),
    prismaVersion: "6.19.3",
  });
  assert.equal(r.ok, true);
  assert.equal(r.pending, true);
});

test("the pinned Prisma version comes from package.json", () => {
  assert.equal(
    readPrismaVersion(() => JSON.stringify({ dependencies: { prisma: "^6.19.3" } })),
    "6.19.3",
  );
  assert.equal(
    readPrismaVersion(() => {
      throw new Error("nope");
    }),
    "latest",
  );
});

test("an explicit VERCEL_TOKEN wins over the local CLI session", () => {
  assert.equal(resolveVercelToken({ VERCEL_TOKEN: "explicit" }), "explicit");
});

test("no token anywhere resolves to null rather than throwing", () => {
  const missing = () => {
    throw new Error("missing");
  };
  assert.equal(resolveVercelToken({}, missing), null);
});

test("setting a Production var removes only Production entries, and writes sensitive", async () => {
  const calls = [];
  const api = async (pathname, _token, init = {}) => {
    calls.push({ pathname, method: init.method || "GET", body: init.body });
    if (!init.method) {
      return {
        ok: true,
        body: {
          envs: [
            { id: "prod1", key: "DATABASE_URL", target: ["production"] },
            { id: "prev1", key: "DATABASE_URL", target: ["preview"] },
          ],
        },
      };
    }
    return { ok: true, body: {} };
  };

  await setVercelProductionEnv("DATABASE_URL", "postgresql://x", "tok", () => {}, api);

  const deletes = calls.filter((c) => c.method === "DELETE");
  assert.equal(deletes.length, 1, "only the Production entry is removed");
  assert.ok(deletes[0].pathname.includes("prod1"));
  assert.ok(!deletes.some((d) => d.pathname.includes("prev1")), "preview is never touched");

  const post = calls.find((c) => c.method === "POST");
  const sent = JSON.parse(post.body);
  assert.deepEqual(sent.target, ["production"]);
  assert.equal(sent.type, "sensitive");
});

test("a failed create is raised, not swallowed", async () => {
  const api = async (_p, _t, init = {}) => {
    if (init.method === "POST") return { ok: false, status: 403, body: {} };
    return { ok: true, body: { envs: [] } };
  };
  await assert.rejects(
    () => setVercelProductionEnv("DATABASE_URL", "postgresql://x", "tok", () => {}, api),
    /Could not create DATABASE_URL/,
  );
});

test("the five workflow secrets are the ones production-deploy.yml reads", () => {
  assert.deepEqual(GITHUB_SECRETS, [
    "DATABASE_URL",
    "DATABASE_URL_DIRECT",
    "VERCEL_TOKEN",
    "VERCEL_ORG_ID",
    "VERCEL_PROJECT_ID",
  ]);
});
