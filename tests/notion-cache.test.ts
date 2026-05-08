import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TtlCache, TestBriefingsProvider } from "@/lib/notion";

describe("TtlCache", () => {
  it("returns null on miss", () => {
    const c = new TtlCache<string>();
    assert.equal(c.get("missing"), null);
  });

  it("returns fresh value within TTL", () => {
    const c = new TtlCache<string>();
    c.set("k", "v", 60_000);
    const r = c.get("k");
    assert.ok(r);
    assert.equal(r.value, "v");
    assert.equal(r.isStale, false);
  });

  it("flags stale past TTL", async () => {
    const c = new TtlCache<string>();
    c.set("k", "v", 1); // 1 ms
    await new Promise((r) => setTimeout(r, 5));
    const got = c.get("k");
    assert.ok(got);
    assert.equal(got.isStale, true);
  });

  it("delete removes entries", () => {
    const c = new TtlCache<string>();
    c.set("k", "v", 60_000);
    c.delete("k");
    assert.equal(c.get("k"), null);
  });

  it("clear empties the store", () => {
    const c = new TtlCache<number>();
    c.set("a", 1, 1000);
    c.set("b", 2, 1000);
    c.clear();
    assert.equal(c.size(), 0);
  });
});

describe("TestBriefingsProvider", () => {
  it("returns seeded briefings, scoped by workspace", async () => {
    const p = new TestBriefingsProvider();
    p.seed("ws_1", [
      {
        sourceId: "p1",
        title: "Day one",
        publishedAt: "2026-05-08",
        body: "hello",
      },
    ]);
    p.seed("ws_2", [
      {
        sourceId: "p2",
        title: "Other",
        publishedAt: "2026-05-08",
        body: "bye",
      },
    ]);

    const a = await p.fetchBriefings({ workspaceId: "ws_1" });
    assert.equal(a.length, 1);
    assert.equal(a[0].title, "Day one");
    assert.equal(a[0].workspaceId, "ws_1");
    assert.equal(a[0].isStale, false);

    const b = await p.fetchBriefings({ workspaceId: "ws_2" });
    assert.equal(b.length, 1);
    assert.equal(b[0].title, "Other");
  });

  it("respects limit", async () => {
    const p = new TestBriefingsProvider();
    p.seed(
      "ws_1",
      Array.from({ length: 8 }, (_, i) => ({
        sourceId: `p${i}`,
        title: `b${i}`,
        publishedAt: "2026-05-08",
        body: "",
      })),
    );
    const r = await p.fetchBriefings({ workspaceId: "ws_1", limit: 3 });
    assert.equal(r.length, 3);
  });

  it("invalidate clears workspace cache and records call", async () => {
    const p = new TestBriefingsProvider();
    p.seed("ws_1", [
      {
        sourceId: "p1",
        title: "x",
        publishedAt: "2026-05-08",
        body: "",
      },
    ]);
    await p.invalidate("ws_1");
    assert.deepEqual(p.invalidations, ["ws_1"]);
    const after = await p.fetchBriefings({ workspaceId: "ws_1" });
    assert.equal(after.length, 0);
  });

  it("returns empty list for unknown workspace", async () => {
    const p = new TestBriefingsProvider();
    const r = await p.fetchBriefings({ workspaceId: "ws_unknown" });
    assert.deepEqual(r, []);
  });
});
