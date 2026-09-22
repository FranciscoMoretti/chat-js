import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const eveRoot = fileURLToPath(
  new URL("./", import.meta.resolve("eve/package.json"))
);
it("installed native reader distinguishes missing, ready, malformed, and corrupt checkpoints", () => {
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
    import { registerHooks } from "node:module";
    import assert from "node:assert/strict";
    let records = [];
    let readCount = 0;
    globalThis.checkpointTestGetRun = () => ({ getReadable() {
      readCount++;
      let cursor = 0;
      return Object.assign(new ReadableStream({ pull(controller) {
        const record = records[cursor++];
        if (record) controller.enqueue(record);
      }}), { getTailIndex: async () => records.length - 1 });
    }});
    registerHooks({ load(url, context, nextLoad) {
      if (url.endsWith("/internal/workflow/runtime.js")) return { format: "module", source: "export * from " + JSON.stringify(url + "?checkpoint-test-real") + "; export const getRun = globalThis.checkpointTestGetRun", shortCircuit: true };
      return nextLoad(url, context);
    }});
    const { handleCheckpointReadiness } = await import(${JSON.stringify(eveRoot)} + "dist/src/execution/checkpoint-readiness.js");
    const request = () => new Request("http://eve/session/source/checkpoint?beforeTurnId=turn_0");
    const pending = await handleCheckpointReadiness(request(), "source");
    assert.equal(pending.status, 404);
    assert.deepEqual(await pending.json(), { code: "checkpoint_not_ready" });
    records = [{ version: 1, sessionId: "source", beforeTurnId: "turn_0", snapshot: { version: 1, session: { sessionId: "source", continuationToken: "", history: [], agent: { system: "private" } } } }];
    const ready = await handleCheckpointReadiness(request(), "source");
    assert.equal(ready.status, 200);
    assert.deepEqual(await ready.json(), { ready: true, sessionId: "source", beforeTurnId: "turn_0" });
    assert.equal(ready.headers.get("cache-control"), "no-store");
    const { readSessionCheckpoint } = await import(${JSON.stringify(eveRoot)} + "dist/src/execution/read-session-checkpoint.js");
    const { restoreSessionCheckpoint } = await import(${JSON.stringify(eveRoot)} + "dist/src/execution/restore-session-checkpoint.js");
    const { createSession } = await import(${JSON.stringify(eveRoot)} + "dist/src/execution/session.js");
    const checkpoint = await readSessionCheckpoint({ sessionId: "source", beforeTurnId: "turn_0" });
    assert.equal(checkpoint.snapshot.version, 2);
    const target = createSession({ sessionId: "branch", continuationToken: "", turnAgent: {
      id: "test", instructions: ["test"], model: { id: "test-model" }, tools: [], workspaceSpec: { rootEntries: [] },
    } });
    assert.equal(restoreSessionCheckpoint({ target, checkpoint }).sessionId, "branch");
    const before = readCount;
    assert.equal((await handleCheckpointReadiness(new Request("http://eve/checkpoint?beforeTurnId=turn_0&beforeTurnId=turn_1"), "source")).status, 400);
    assert.equal(readCount, before);
    records = [{ version: 1, sessionId: "other", beforeTurnId: "turn_0" }];
    const corrupt = await handleCheckpointReadiness(request(), "source");
    assert.equal(corrupt.status, 503);
    assert.deepEqual(await corrupt.json(), { error: "Checkpoint lookup is unavailable." });
    const { handleSandboxIdentityRead } = await import(${JSON.stringify(eveRoot)} + "dist/src/execution/sandbox-identity-read.js");
    const identityRequest = () => new Request("http://eve/session/source/sandbox-identity");
    records = [];
    assert.equal((await handleSandboxIdentityRead(identityRequest(), "source")).status, 503);
    const birth = { version: 1, snapshotVersion: 2, sessionId: "source", local: { version: 1, sessionId: "source", appRoot: "/worker", backendName: "microsandbox" } };
    records = [birth, structuredClone(birth)];
    const certified = await handleSandboxIdentityRead(identityRequest(), "source");
    assert.equal(certified.status, 200);
    assert.equal(certified.headers.get("cache-control"), "no-store");
    assert.deepEqual(await certified.json(), birth);
    records.push({ ...birth, local: null });
    assert.equal((await handleSandboxIdentityRead(identityRequest(), "source")).status, 503);
    const identityReads = readCount;
    assert.equal((await handleSandboxIdentityRead(new Request("http://eve/session/source/sandbox-identity?sessionId=other"), "source")).status, 400);
    assert.equal(readCount, identityReads);
    process.stdout.write("verified");
  `,
    ],
    { encoding: "utf-8" }
  );
  expect(result).toBe("verified");
});
