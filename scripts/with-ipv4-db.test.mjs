// Tests for the build-time IPv4 database rewrite.
//
// The defect these guard against cost 96 days of production and 140 failed
// deploys: Vercel builders have no IPv6 route, Neon publishes AAAA records, and
// Prisma took the AAAA path and reported P1001 — "can't reach database server" —
// for a database that was answering on IPv4 in 4ms the whole time.
//
// Two properties matter and are tested directly:
//   1. A rewritten URL keeps every part that carries meaning (credentials,
//      database, sslmode) and gains the endpoint option Neon needs when there
//      is no SNI to route on.
//   2. When the rewrite should not happen, it does not — and it never throws.
//      A network helper must not be able to block shipping; that coupling is
//      the original bug.

import test from "node:test";
import assert from "node:assert/strict";

import { rewriteUrl, buildEnv, endpointIdFromHost, DB_VARS } from "./with-ipv4-db.mjs";

const quiet = { log() {}, warn() {} };
const HOST = "ep-aged-snow-aq0e4b6k.c-8.us-east-1.aws.neon.tech";
const URL_OK = `postgresql://someuser:somepass@${HOST}:5432/neondb?sslmode=require`;
const resolver = { async resolve4() { return ["203.0.113.10", "203.0.113.11"]; } };

test("endpoint id is the first label, with any -pooler suffix removed", () => {
  assert.equal(endpointIdFromHost(HOST), "ep-aged-snow-aq0e4b6k");
  assert.equal(endpointIdFromHost("ep-abc-pooler.c-8.us-east-1.aws.neon.tech"), "ep-abc");
});

test("rewrite swaps the host for an A record and carries the endpoint id", async () => {
  const { url, changed } = await rewriteUrl(URL_OK, { resolver, log: quiet });
  const u = new URL(url);
  assert.equal(changed, true);
  assert.equal(u.hostname, "203.0.113.10");
  assert.equal(u.searchParams.get("options"), "endpoint=ep-aged-snow-aq0e4b6k");
});

test("rewrite preserves credentials, database and sslmode", async () => {
  const { url } = await rewriteUrl(URL_OK, { resolver, log: quiet });
  const u = new URL(url);
  assert.equal(u.username, "someuser");
  assert.equal(u.password, "somepass");
  assert.equal(u.pathname, "/neondb");
  assert.equal(u.port, "5432");
  assert.equal(u.searchParams.get("sslmode"), "require");
});

test("an existing options value is kept, not clobbered", async () => {
  const withOpts = `postgresql://u:p@${HOST}:5432/neondb?options=-c%20statement_timeout%3D5000`;
  const { url } = await rewriteUrl(withOpts, { resolver, log: quiet });
  const opts = new URL(url).searchParams.get("options");
  assert.match(opts, /statement_timeout/);
  assert.match(opts, /endpoint=ep-aged-snow-aq0e4b6k/);
});

test("strict TLS is never silently downgraded", async () => {
  for (const mode of ["verify-full", "verify-ca"]) {
    const strict = `postgresql://u:p@${HOST}:5432/neondb?sslmode=${mode}`;
    const r = await rewriteUrl(strict, { resolver, log: quiet });
    assert.equal(r.changed, false, `${mode} must not be rewritten`);
    assert.equal(r.url, strict);
  }
});

test("a host that is already an IP is left alone", async () => {
  const ip = "postgresql://u:p@203.0.113.9:5432/neondb";
  const r = await rewriteUrl(ip, { resolver, log: quiet });
  assert.equal(r.changed, false);
  assert.equal(r.reason, "already-ip");
});

test("unparseable and non-postgres URLs pass through untouched", async () => {
  for (const raw of ["not a url", "mysql://u:p@host:3306/db"]) {
    const r = await rewriteUrl(raw, { resolver, log: quiet });
    assert.equal(r.changed, false);
    assert.equal(r.url, raw);
  }
});

test("a host with no A record is a pass-through, not a throw", async () => {
  const dead = {
    async resolve4() { throw Object.assign(new Error("nope"), { code: "ENOTFOUND" }); },
    async lookup() { return []; },
  };
  const r = await rewriteUrl(URL_OK, { resolver: dead, log: quiet });
  assert.equal(r.changed, false);
  assert.equal(r.url, URL_OK);
});

test("buildEnv rewrites every known database var and leaves others alone", async () => {
  const env = await buildEnv(
    { DATABASE_URL: URL_OK, DATABASE_URL_DIRECT: URL_OK, SOMETHING_ELSE: "untouched" },
    { resolver, log: quiet },
  );
  for (const name of DB_VARS) assert.equal(new URL(env[name]).hostname, "203.0.113.10");
  assert.equal(env.SOMETHING_ELSE, "untouched");
});

test("buildEnv ignores database vars that are not set", async () => {
  const env = await buildEnv({ DATABASE_URL: URL_OK }, { resolver, log: quiet });
  assert.equal(env.DATABASE_URL_DIRECT, undefined);
});
