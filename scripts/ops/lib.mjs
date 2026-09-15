// Shared plumbing for the ops detection scripts (prevention architecture,
// docs/plans/2026-08-09-prevention-architecture.md).
//
// Design constraint carried from the spec: every count these scripts report is
// measured (API response, file stat, grep), never derived. Keep helpers dumb.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = process.env.OPS_REPO || "cchambers6/agentplain";

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function hasFlag(flag) {
  return process.argv.includes(flag);
}

// Token order: --token-file (on-host mint recipe writes to a file, never stdout),
// then env. ghs_ installation tokens require the `token` auth scheme, not Bearer.
export function readToken({ required = true } = {}) {
  const file = argValue("--token-file");
  if (file) return fs.readFileSync(file, "utf8").trim();
  const t = process.env.FLEET_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "";
  if (!t && required) {
    process.stderr.write(
      "no GitHub token: set GITHUB_TOKEN / FLEET_GITHUB_TOKEN or pass --token-file <path>\n"
    );
    process.exit(1);
  }
  return t.trim();
}

// A failure that produced NO ANSWER: the network refused, the API was
// unavailable, or we exhausted retries. Categorically NOT the same thing as
// "the thing you asked about is broken", and callers MUST surface it as
// UNDETERMINED rather than as a verdict. Conflating the two is how the
// 2026-09-14T12:59 transient blip rendered as an identical red X to the 19
// runs that had actually measured production.
export class UndeterminedError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = "UndeterminedError";
    this.undetermined = true;
  }
}

export const RETRY_ATTEMPTS = 4;
const RETRY_BASE_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// undici throws a bare TypeError("fetch failed") for DNS/TLS/socket errors and
// hides the real reason in .cause.code. That is what killed the 2026-09-14
// run 29 seconds into a 141-call walk.
const TRANSIENT_CODES = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "EPIPE", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT",
]);

export function isTransientError(err) {
  if (!err) return false;
  if (err.undetermined) return true;
  if (TRANSIENT_CODES.has(err.code) || TRANSIENT_CODES.has(err.cause?.code)) return true;
  return err instanceof TypeError && /fetch failed|network|socket/i.test(err.message);
}

// Retryable on the HTTP side: server faults and rate limiting. A 4xx is an
// authoritative answer and is never retried.
const isRetryableStatus = (s) => s === 429 || (s >= 500 && s <= 599);

export async function ghApi(
  pathOrUrl,
  { method = "GET", token, body, ok404 = false, attempts = RETRY_ATTEMPTS, onRetry, sleepFn = sleep } = {}
) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://api.github.com${pathOrUrl}`;
  const headers = {
    "user-agent": "agentplain-ops",
    accept: "application/vnd.github+json",
  };
  if (token) headers.authorization = `token ${token}`;

  let lastReason = "unknown";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (!isTransientError(err)) throw err;
      // Only method + url ever reach the message. Never headers, never token.
      lastReason = `${err.message}${err.cause?.code ? ` (${err.cause.code})` : ""}`;
      if (attempt === attempts) break;
      onRetry?.({ attempt, url, method, reason: lastReason });
      await sleepFn(RETRY_BASE_MS * 2 ** (attempt - 1));
      continue;
    }

    if (res.status === 404 && ok404) return null;

    if (isRetryableStatus(res.status)) {
      lastReason = `${method} ${url} -> ${res.status}`;
      if (attempt === attempts) break;
      onRetry?.({ attempt, url, method, reason: lastReason });
      await sleepFn(RETRY_BASE_MS * 2 ** (attempt - 1));
      continue;
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  throw new UndeterminedError(
    `${method} ${url}: no answer after ${attempts} attempts (last: ${lastReason})`
  );
}

export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function hoursBetween(a, b) {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) / 36e5;
}

export function daysBetween(a, b) {
  return hoursBetween(a, b) / 24;
}

// Pull a leading ISO timestamp out of free-text date fields — the live queue
// carries values like "2026-08-10T23:53Z (filed by session …".
export function parseIso(value) {
  if (!value) return null;
  const m = String(value).match(/\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?Z?)?/);
  if (!m) return null;
  let s = m[0];
  if (s.length === 10) s += "T00:00:00Z";
  if (!s.endsWith("Z")) s += s.length === 16 ? ":00Z" : "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
