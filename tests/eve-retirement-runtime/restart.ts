import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Client } from "eve/client";
import { z } from "zod";

import { recoverDeadPostgresFixture } from "./operator-recovery";
import { createPersistentRuntime } from "./persistent-runtime";
import { preparePostgresFixture } from "./postgres-fixture";

const crashAtCallbacks = process.argv.includes("--callbacks");
const swapConnector = process.argv.includes("--swap-connector");
const useDefaultLease = process.argv.includes("--default-lease");
const operatorRecovery = process.argv.includes("--operator-recovery");
const abruptServer = process.argv.includes("--abrupt-server");
const crashTestLeaseSeconds = 1;
const postgresFlag = process.argv.indexOf("--postgres");
const absentFlag = -1;
const argumentOffset = 1;
const postgres =
  postgresFlag === absentFlag
    ? undefined
    : await preparePostgresFixture({
        handoff: z.string().parse(process.argv[postgresFlag + argumentOffset]),
        lane: "lane_d",
        nodeModules: path.join(import.meta.dir, "node_modules"),
        source: path.join(import.meta.dir, "restart-fixture"),
      });
const runtime = await createPersistentRuntime(
  postgres?.source ?? "restart-fixture",
  postgres === undefined
    ? undefined
    : {
        nodeModules: postgres.nodeModules,
        provenance:
          "Published eve@0.71.3 with ChatJS patched PostgreSQL beta.40",
      },
  {
    ...(crashAtCallbacks && !useDefaultLease
      ? { inlineOwnershipLeaseSeconds: crashTestLeaseSeconds }
      : {}),
    world: postgres === undefined ? "local" : "postgres",
  }
);
const processMarker = z.object({ pid: z.number().int().positive() });
const noSettledProcess = 0;
let settledPid = noSettledProcess;
await Bun.write(
  Bun.stdout,
  `Persistent runtime fixture: ${runtime.directory}\n`
);
try {
  await writeFile(path.join(runtime.directory, "connector.txt"), "original");
  await runtime.start();
  const client = new Client({
    headers: { authorization: "Bearer fixture-owner" },
    host: runtime.url,
  });
  const { session, response } = await client.sessions.create({
    message: "Run action",
  });
  await response.result();
  const snapshot = await session.snapshot();
  await writeFile(
    path.join(runtime.directory, "snapshot.json"),
    JSON.stringify(snapshot)
  );
  const request = snapshot.events.find(
    (event) => event.type === "input.requested"
  );
  assert.ok(request);
  const expectedInput = { amount: 7, label: "default" };
  const parsed = await runtime.waitForMarker("request");
  assert.deepEqual(parsed, {
    connectorIdentity: "original",
    input: expectedInput,
    toolName: "act",
  });
  const [approval] = request.data.requests;
  if (approval === undefined) {
    throw new Error("Missing pending approval");
  }
  assert.deepEqual(approval.action.input, expectedInput);
  if (swapConnector) {
    await writeFile(
      path.join(runtime.directory, "connector.txt"),
      "replacement"
    );
  }
  if (!crashAtCallbacks) {
    await runtime.crash();
    await runtime.start();
    await runtime.release("candidate");
    await runtime.release("settled");
  }
  await session.respond([
    { optionId: "approve", requestId: approval.requestId },
  ]);
  if (crashAtCallbacks) {
    const candidate = processMarker.parse(
      await runtime.waitForMarker("candidate")
    );
    await runtime.crash(abruptServer ? candidate.pid : undefined);
    if (operatorRecovery) {
      const candidateGeneration = 1;
      await recoverDeadPostgresFixture(runtime.directory, candidateGeneration);
    }
    await runtime.release("candidate");
    await runtime.start();
    const settled = processMarker.parse(await runtime.waitForMarker("settled"));
    assert.notEqual(settled.pid, candidate.pid);
    settledPid = settled.pid;
    const settledSnapshot = await session.snapshot();
    assert.ok(
      settledSnapshot.events.some((event) => event.type === "approval.settled")
    );
    await writeFile(
      path.join(runtime.directory, "settled-snapshot.json"),
      JSON.stringify(settledSnapshot)
    );
    assert.equal(
      await Bun.file(path.join(runtime.directory, "effects.jsonl")).exists(),
      false
    );
    await runtime.crash(abruptServer ? settled.pid : undefined);
    if (operatorRecovery) {
      const settledGeneration = 2;
      await recoverDeadPostgresFixture(runtime.directory, settledGeneration);
    }
    await runtime.release("settled");
    await runtime.start();
  }
  const effect = await runtime.waitForMarker("effect");
  await Bun.write(Bun.stdout, `Effect: ${JSON.stringify(effect)}\n`);
  const effectProcess = processMarker.parse(effect);
  if (crashAtCallbacks) {
    assert.notEqual(effectProcess.pid, settledPid);
  }
  assert.deepEqual(effect, {
    callId: approval.action.callId,
    connectorIdentity: "original",
    input: expectedInput,
    pid: effectProcess.pid,
    sessionId: session.state.sessionId,
    toolName: approval.action.toolName,
  });
  const effects = await readFile(
    path.join(runtime.directory, "effects.jsonl"),
    "utf-8"
  );
  const singleEffect = 1;
  assert.equal(effects.trim().split("\n").length, singleEffect);
  if (operatorRecovery) {
    await runtime.crash();
    await Bun.write(
      Bun.stdout,
      `Operator recovery evidence retained: ${runtime.directory}\n`
    );
  } else {
    await runtime.remove();
  }
} catch (error) {
  await writeFile(
    path.join(runtime.directory, "failure.txt"),
    error instanceof Error ? (error.stack ?? error.message) : String(error)
  );
  try {
    await runtime.crash();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      `Restart and cleanup failed; retained ${runtime.directory}`,
      { cause: cleanupError }
    );
  }
  throw new Error(`Restart proof failed; retained ${runtime.directory}`, {
    cause: error,
  });
}
