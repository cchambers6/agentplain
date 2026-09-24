#!/usr/bin/env node
/**
 * Run a command with the database URLs rewritten to connect over IPv4.
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured from inside a Vercel builder on 2026-09-24:
 *
 *   IPv4 52.72.123.251 : CONNECTED 4ms  (Postgres answers SSLRequest with 'S')
 *   IPv6 2600:1f18:... : ENETUNREACH after 0ms   (all three AAAA records)
 *
 * Vercel build containers have no IPv6 route. Neon publishes both A and AAAA
 * records. Prisma's Rust engine takes the AAAA path and fails instantly, which
 * surfaces as `P1001: Can't reach database server`. That ~100ms "database is
 * down" error is what froze production from 2026-06-19 to 2026-09-24 — 140
 * consecutive failed production deploys. The database was reachable the whole
 * time. Only the address family was wrong.
 *
 * WHY NOT /etc/hosts
 * ------------------
 * The obvious fix — pin the host to its A record in /etc/hosts — does not work
 * here: the Vercel build container mounts /etc read-only (EROFS, confirmed in
 * build dpl_AVgNX2pH). So the address family has to be forced in the
 * connection string instead.
 *
 * HOW
 * ---
 * Neon routes by TLS SNI, which is unavailable when you dial an IP literal. Neon
 * supports exactly this case via a connection option carrying the endpoint id.
 * Verified against production with deliberately invalid credentials, so the
 * check needed no secrets:
 *
 *   IPv4 literal + options=endpoint=<id>  -> 28P01 invalid password  (routed)
 *   IPv4 literal, no options              -> 28000 "Endpoint ID is not specified"
 *
 * Reaching "wrong password" proves the connection was routed to the right
 * compute. So: swap the host for its A record and carry the endpoint id in
 * `options`.
 *
 * SAFETY
 * ------
 * - Credentials are never read, logged, or printed. Only hostnames and IPs are
 *   logged, and the rewritten URL is passed to the child process in its
 *   environment, never through a shell argument.
 * - If the URL asks for full certificate verification (`verify-full`/`verify-ca`)
 *   the rewrite is SKIPPED rather than silently downgrading TLS: an IP literal
 *   cannot satisfy hostname verification, and quietly weakening that is not a
 *   trade this script is allowed to make.
 * - Any failure to rewrite is non-fatal. The child still runs with the original
 *   environment, and the migrate gate downstream decides what to do about
 *   connectivity. A network helper must never become a shipping precondition —
 *   that coupling is the original defect.
 */
import dns from "node:dns/promises";
import { spawn } from "node:child_process";

export const DB_VARS = ["DATABASE_URL", "DATABASE_URL_DIRECT"];

/** Resolve IPv4 addresses, falling back to the OS resolver behind a local stub. */
export async function resolveIpv4(host, resolver = dns) {
  try {
    const addrs = await resolver.resolve4(host);
    if (addrs.length) return addrs;
  } catch {
    // fall through to the OS resolver
  }
  const found = await resolver.lookup(host, { all: true, family: 4 });
  return found.map((f) => f.address);
}

/** `ep-aged-snow-aq0e4b6k.c-8.us-east-1.aws.neon.tech` -> `ep-aged-snow-aq0e4b6k` */
export function endpointIdFromHost(host) {
  const first = String(host).split(".")[0];
  return first.endsWith("-pooler") ? first.slice(0, -"-pooler".length) : first;
}

/**
 * Rewrite one connection URL to dial IPv4 directly.
 * Returns the original string unchanged when it should not or cannot be rewritten.
 */
export async function rewriteUrl(raw, { resolver = dns, log = console } = {}) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { url: raw, changed: false, reason: "unparseable" };
  }
  if (!/^postgres/i.test(u.protocol)) return { url: raw, changed: false, reason: "not-postgres" };
  if (/^[0-9.]+$/.test(u.hostname)) return { url: raw, changed: false, reason: "already-ip" };

  const sslmode = (u.searchParams.get("sslmode") || "").toLowerCase();
  if (sslmode === "verify-full" || sslmode === "verify-ca") {
    log.warn(
      `[ipv4-db] ${u.hostname} requests sslmode=${sslmode}; not rewriting, because an IP ` +
        `literal cannot satisfy certificate hostname verification.`,
    );
    return { url: raw, changed: false, reason: "strict-tls" };
  }

  let addrs;
  try {
    addrs = await resolveIpv4(u.hostname, resolver);
  } catch (e) {
    log.warn(`[ipv4-db] Could not resolve an A record for ${u.hostname} (${e.code}).`);
    return { url: raw, changed: false, reason: "no-a-record" };
  }
  if (!addrs || !addrs.length) {
    log.warn(`[ipv4-db] No A records for ${u.hostname}.`);
    return { url: raw, changed: false, reason: "no-a-record" };
  }

  const endpointOption = `endpoint=${endpointIdFromHost(u.hostname)}`;
  const existing = u.searchParams.get("options");
  u.searchParams.set("options", existing ? `${existing} ${endpointOption}` : endpointOption);

  const originalHost = u.hostname;
  u.hostname = addrs[0];

  log.log(`[ipv4-db] ${originalHost} -> ${addrs[0]} (${endpointOption}); ${addrs.length} A records available.`);
  return { url: u.toString(), changed: true, host: originalHost, address: addrs[0] };
}

/** Build a child environment with every known DB var rewritten. */
export async function buildEnv(env = process.env, opts = {}) {
  const out = { ...env };
  for (const name of DB_VARS) {
    if (!out[name]) continue;
    const { url } = await rewriteUrl(out[name], opts);
    out[name] = url;
  }
  return out;
}

async function main() {
  const sep = process.argv.indexOf("--");
  const argv = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(2);
  if (!argv.length) {
    console.error("[ipv4-db] usage: node scripts/with-ipv4-db.mjs -- <command> [args...]");
    return 1;
  }

  let env = process.env;
  try {
    env = await buildEnv(process.env);
  } catch (e) {
    console.warn(`[ipv4-db] Rewrite failed (${e.message}); running with the original environment.`);
  }

  const child = spawn(argv[0], argv.slice(1), { stdio: "inherit", shell: true, env });
  return await new Promise((resolve) => {
    child.on("error", (e) => {
      console.error(`[ipv4-db] Could not start ${argv[0]}: ${e.message}`);
      resolve(1);
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

// Only self-run when invoked directly as the wrapper, never when imported by the
// test file (whose path also contains this module name).
const invokedAs = (process.argv[1] || "").split("/").pop().split("\\").pop();
if (invokedAs === "with-ipv4-db.mjs") {
  process.exit(await main());
}
