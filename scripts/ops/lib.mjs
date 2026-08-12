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

export async function ghApi(pathOrUrl, { method = "GET", token, body, ok404 = false } = {}) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `https://api.github.com${pathOrUrl}`;
  const headers = {
    "user-agent": "agentplain-ops",
    accept: "application/vnd.github+json",
  };
  if (token) headers.authorization = `token ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 404 && ok404) return null;
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`${method} ${url} -> ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
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
