// upsert-issue.mjs — the ONE shared issue helper (spec §3, issue taxonomy).
//
// One issue per condition, identified by a slug. Upsert = comment on the
// existing issue, never a duplicate. Close-with-comment when the condition
// clears. All workflows share this file so a broken issue path fails every
// drill at once instead of rotting per-workflow.
//
// Discovery is STATE-FILE based, not list based, and that is load-bearing:
// measured 2026-08-11, GitHub App installation tokens (both the fleet token
// and — same token class — Actions' GITHUB_TOKEN) get an EMPTY result from
// every issue-listing form on this repo (list, creator filter, search all
// return only PRs), while direct GET /issues/{number} works and the issues
// are fully visible unauthenticated and in the UI. So the family keeps its
// own slug -> issue-number map in ops-issues.json on the ops/heartbeat
// branch, and reads issues by number. Labels are best-effort display
// metadata only (the fleet App token gets 403 on label writes); nothing
// depends on them.
//
// The checkers stay pure: they compute an action list; executeActions() is
// the only place that talks to the issues API. Dry-run = print the actions.

import { ghApi, REPO } from "./lib.mjs";

const STATE_BRANCH = "ops/heartbeat";
const STATE_PATH = "ops-issues.json";

export const slugMarker = (slug) => `<!-- ops-slug: ${slug} -->`;

async function loadStateFile(token) {
  const file = await ghApi(
    `/repos/${REPO}/contents/${STATE_PATH}?ref=${encodeURIComponent(STATE_BRANCH)}`,
    { token, ok404: true }
  );
  if (!file) return { state: {}, sha: null };
  try {
    return {
      state: JSON.parse(Buffer.from(file.content, "base64").toString("utf8")),
      sha: file.sha,
    };
  } catch {
    return { state: {}, sha: file.sha };
  }
}

async function saveStateFile(state, sha, token) {
  const put = (fileSha) =>
    ghApi(`/repos/${REPO}/contents/${STATE_PATH}`, {
      method: "PUT",
      token,
      body: {
        message: `ops-issues state ${new Date().toISOString()}`,
        content: Buffer.from(JSON.stringify(state, null, 2)).toString("base64"),
        branch: STATE_BRANCH,
        ...(fileSha ? { sha: fileSha } : {}),
      },
    });
  try {
    await put(sha);
  } catch {
    // One retry on write races (heartbeat publishes share the branch).
    const fresh = await loadStateFile(token);
    await put(fresh.sha);
  }
}

// Returns the open issues this family owns: [{number, body, created_at,
// updated_at, __slug}]. Closed/missing entries are pruned from the state.
export async function fetchOpenIssues({ token }) {
  const { state, sha } = await loadStateFile(token);
  const open = [];
  let dirty = false;
  for (const [slug, number] of Object.entries(state)) {
    const issue = await ghApi(`/repos/${REPO}/issues/${number}`, { token, ok404: true });
    if (issue && issue.state === "open") {
      open.push({ ...issue, __slug: slug });
    } else {
      delete state[slug];
      dirty = true;
    }
  }
  if (dirty) await saveStateFile(state, sha, token);
  return open;
}

export function findBySlug(openIssues, slug) {
  return (
    (openIssues || []).find(
      (i) => i.__slug === slug || (i.body || "").includes(slugMarker(slug))
    ) || null
  );
}

// actions: [{type:'create', slug, title, body, labels:[..]},
//           {type:'comment', number, body},
//           {type:'close', number, body, slug?}]
export async function executeActions(actions, { token, dryRun = false }) {
  if (dryRun) {
    for (const a of actions) process.stdout.write(JSON.stringify(a) + "\n");
    return;
  }
  let stateTouched = false;
  const { state, sha } = await loadStateFile(token);
  for (const a of actions) {
    if (a.type === "create") {
      const created = await ghApi(`/repos/${REPO}/issues`, {
        method: "POST",
        token,
        body: {
          title: a.title,
          body: `${a.body}\n\n${slugMarker(a.slug)}`,
          labels: a.labels, // best-effort; App tokens may drop these silently
        },
      });
      state[a.slug] = created.number;
      stateTouched = true;
      process.stdout.write(`created issue #${created.number}: ${a.title}\n`);
    } else if (a.type === "comment") {
      await ghApi(`/repos/${REPO}/issues/${a.number}/comments`, {
        method: "POST",
        token,
        body: { body: a.body },
      });
      process.stdout.write(`commented on issue #${a.number}\n`);
    } else if (a.type === "close") {
      await ghApi(`/repos/${REPO}/issues/${a.number}/comments`, {
        method: "POST",
        token,
        body: { body: a.body },
      });
      await ghApi(`/repos/${REPO}/issues/${a.number}`, {
        method: "PATCH",
        token,
        body: { state: "closed" },
      });
      for (const [slug, num] of Object.entries(state)) {
        if (num === a.number) {
          delete state[slug];
          stateTouched = true;
        }
      }
      process.stdout.write(`closed issue #${a.number}\n`);
    } else {
      throw new Error(`unknown action type: ${a.type}`);
    }
  }
  if (stateTouched) await saveStateFile(state, sha, token);
}
