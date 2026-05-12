import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runWithDisableGate } from "@/lib/inngest/run-with-disable-gate";
import { disableFlagEnvName } from "@/lib/inngest/disable-flag";

describe("runWithDisableGate", () => {
  it("runs the handler when the env flag is unset", async () => {
    let ran = false;
    const r = await runWithDisableGate(
      "test-fn",
      async () => {
        ran = true;
        return 42;
      },
      {} as unknown as NodeJS.ProcessEnv,
    );
    assert.equal(ran, true);
    assert.equal(r.disabled, false);
    assert.equal(r.result, 42);
  });

  it("short-circuits when the env flag is 'true'", async () => {
    let ran = false;
    const env = {
      [disableFlagEnvName("test-fn")]: "true",
    } as unknown as NodeJS.ProcessEnv;
    const r = await runWithDisableGate(
      "test-fn",
      async () => {
        ran = true;
        return 42;
      },
      env,
    );
    assert.equal(ran, false);
    assert.equal(r.disabled, true);
    assert.equal(r.result, null);
  });

  it("runs the handler for any non-'true' value", async () => {
    const cases = ["false", "True", "1", "yes", ""];
    for (const v of cases) {
      let ran = false;
      const env = {
        [disableFlagEnvName("test-fn")]: v,
      } as unknown as NodeJS.ProcessEnv;
      await runWithDisableGate(
        "test-fn",
        async () => {
          ran = true;
        },
        env,
      );
      assert.equal(ran, true, `expected handler to run for env value "${v}"`);
    }
  });
});
