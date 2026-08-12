// upsert-issue.mjs — the ONE shared issue helper (spec §3, issue taxonomy).
//
// One issue per condition, identified by a slug marker in the body. Upsert =
// comment on the existing issue, never a duplicate. Close-with-comment when
// the condition clears. All workflows share this file so a broken issue path
// fails every drill at once instead of rotting per-workflow.
//
// The checkers stay pure: they compute an action list; executeActions() is the
// only place that talks to the issues API. Dry-run = print the action list.

import { ghApi, REPO } from "./lib.mjs";

export const slugMarker = (slug) => `<!-- ops-slug: ${slug} -->`;

// Discovery is MARKER-based, never label-based: the fleet App token cannot
// manage labels (403 "Resource not accessible by integration", measured
// 2026-08-11 on issue #406), so an alarm path that depended on labels would
// silently lose track of its own issues depending on which credential ran it.
// Labels are best-effort display metadata only.
export async function fetchOpenIssues({ token }) {
  const all = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await ghApi(`/repos/${REPO}/issues?state=open&per_page=100&page=${page}`, {
      token,
    });
    all.push(...batch.filter((i) => !i.pull_request));
    if (batch.length < 100) break;
  }
  return all.filter((i) => /<!-- ops-slug: /.test(i.body || ""));
}

export function findBySlug(openIssues, slug) {
  return (openIssues || []).find((i) => (i.body || "").includes(slugMarker(slug))) || null;
}

// actions: [{type:'create', slug, title, body, labels:[..]},
//           {type:'comment', number, body},
//           {type:'close', number, body}]
export async function executeActions(actions, { token, dryRun = false }) {
  if (dryRun) {
    for (const a of actions) process.stdout.write(JSON.stringify(a) + "\n");
    return;
  }
  for (const a of actions) {
    if (a.type === "create") {
      const created = await ghApi(`/repos/${REPO}/issues`, {
        method: "POST",
        token,
        body: {
          title: a.title,
          body: `${a.body}\n\n${slugMarker(a.slug)}`,
          labels: a.labels,
        },
      });
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
      process.stdout.write(`closed issue #${a.number}\n`);
    } else {
      throw new Error(`unknown action type: ${a.type}`);
    }
  }
}
