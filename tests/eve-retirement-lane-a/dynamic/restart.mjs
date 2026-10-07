/* oxlint-disable import/no-nodejs-modules -- This standalone test controller owns disposable storage and process evidence. */
/* oxlint-disable eslint/no-magic-numbers, no-undefined -- Expected process/effect counts and absent probe values are explicit restart assertions. */
/* oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/no-unsafe-argument, typescript/restrict-template-expressions, typescript/strict-boolean-expressions -- This controller imports the external pinned runtime helper by CLI path; runtime assertions verify its observable boundary. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [harnessDirectory, sourceDirectory, postgresHandoff] = process.argv
  .slice(2)
  .filter((value) => value !== "--abrupt");
const abrupt = process.argv.includes("--abrupt");
assert.ok(
  harnessDirectory && sourceDirectory,
  "Pass D's harness directory and an absolute prepared native-candidate fixture."
);
const helperHash = createHash("sha256")
  .update(
    await readFile(path.resolve(harnessDirectory, "persistent-runtime.ts"))
  )
  .digest("hex");
const { createPersistentRuntime, until } = await import(
  pathToFileURL(path.resolve(harnessDirectory, "persistent-runtime.ts")).href
);
const { Client } = await import(
  pathToFileURL(
    path.resolve(harnessDirectory, "node_modules/eve/dist/src/client/client.js")
  ).href
);
const { preparePostgresFixture } = await import(
  pathToFileURL(path.resolve(harnessDirectory, "postgres-fixture.ts")).href
);
const postgres = postgresHandoff
  ? await preparePostgresFixture({
      handoff: postgresHandoff,
      lane: "lane_a",
      nodeModules: path.resolve(harnessDirectory, "node_modules"),
      source: path.resolve(sourceDirectory),
    })
  : undefined;
const runtime = await createPersistentRuntime(
  postgres?.source ?? path.resolve(sourceDirectory),
  postgres
    ? {
        nodeModules: postgres.nodeModules,
        provenance:
          "Published eve@0.71.3 with ChatJS patched PostgreSQL beta.40",
      }
    : undefined,
  { inlineOwnershipLeaseSeconds: 1, world: postgres ? "postgres" : "local" }
);
process.stdout.write(
  `Installed resolver restart fixture: ${runtime.directory}\n`
);
const marker = `import { access, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
export const barrier = async (name, detail) => {
  await writeFile(name + ".json", JSON.stringify({ pid: process.pid, detail }));
  for (;;) { try { await access(name + ".release"); return; } catch { await setTimeout(50); } }
};\n`;
await writeFile(path.join(runtime.directory, "proof/barrier.ts"), marker);
await mkdir(path.join(runtime.directory, "agent/hooks"), { recursive: true });
await writeFile(
  path.join(runtime.directory, "agent/hooks/settlement.ts"),
  `import { defineHook } from "eve/hooks";\nimport { writeFile } from "node:fs/promises";\nimport { barrier } from "../../proof/barrier";\nexport default defineHook({ events: { "input.requested": async () => { await writeFile("request-process.json", JSON.stringify({pid: process.pid})); }, "approval.settled": async (event) => { await barrier("settled", event); } } });\n`
);
const storePath = path.join(runtime.directory, "proof/store.ts");
const store = await readFile(storePath, "utf-8");
const effectBoundary = "  await appendFile(";
assert.equal(
  store.split(effectBoundary).length,
  2,
  "Exactly one disposable effect boundary must be instrumented."
);
await writeFile(
  storePath,
  `import { writeFile } from "node:fs/promises";\n${store.replace(
    effectBoundary,
    `  if (kind === "delete") await writeFile("effect.json", JSON.stringify({ pid: process.pid, detail }));\n${
      effectBoundary
    }`
  )}`
);
await writeFile(
  path.join(runtime.directory, "restart-instrumentation.json"),
  JSON.stringify({
    abrupt,
    effect: "disposable DB boundary marker",
    helperHash,
    hook: "approval.settled before execution",
    inlineOwnershipLeaseSeconds: 1,
  })
);
const markerTimeoutMs = postgres && abrupt ? 10_000 : 60_000;
try {
  await runtime.start();
  const client = new Client({ host: runtime.url });
  const created = await client.sessions.create({ message: "Delete document" });
  await created.response.result();
  const { session } = created;
  const snapshot = await session.snapshot();
  await writeFile(
    path.join(runtime.directory, "snapshot-pending.json"),
    JSON.stringify(snapshot)
  );
  const requested = snapshot.events.find(
    (event) => event.type === "input.requested"
  );
  assert.ok(requested);
  const [approval] = requested.data.requests;
  assert.equal(approval.action.toolName, "deleteDocument");
  const firstProcess = await runtime.waitForMarker("request-process");
  await runtime.crash(abrupt ? firstProcess.pid : undefined);
  await runtime.start();
  await session.respond([
    { optionId: "approve", requestId: approval.requestId },
  ]);
  const settled = await runtime.waitForMarker("settled", markerTimeoutMs);
  assert.notEqual(firstProcess.pid, settled.pid);
  const settledSnapshot = await session.snapshot();
  await writeFile(
    path.join(runtime.directory, "snapshot-settled.json"),
    JSON.stringify(settledSnapshot)
  );
  assert.ok(
    settledSnapshot.events.some((event) => event.type === "approval.settled")
  );
  assert.equal(
    await Bun.file(path.join(runtime.directory, "effect.json")).exists(),
    false
  );
  await runtime.crash(abrupt ? settled.pid : undefined);
  await runtime.release("settled");
  await runtime.start();
  const effect = await runtime.waitForMarker("effect", markerTimeoutMs);
  assert.notEqual(effect.pid, settled.pid);
  assert.deepEqual(effect.detail.input, approval.action.input);
  assert.equal(effect.detail.scope.conversationId, session.state.sessionId);
  assert.equal(effect.detail.scope.ownerId, "owner");
  await until(async () => {
    const final = await session.snapshot();
    return final.events.some((event) => event.type === "action.result")
      ? final
      : undefined;
  });
  const journal = await readFile(
    path.join(runtime.directory, "proof-effects.jsonl"),
    "utf-8"
  );
  const deletes = journal
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.kind === "delete");
  assert.equal(deletes.length, 1);
  process.stdout.write(
    `PASS actual installed resolver: pending restart, settled-before-effect restart, exact owner/input, one observed effect.\n`
  );
  process.stdout.write(
    `${JSON.stringify({ abrupt, effectPid: effect.pid, helperHash, requestPid: firstProcess.pid, settledPid: settled.pid, world: postgres ? "postgres" : "local" })}\n`
  );
  await runtime.remove();
} catch (error) {
  try {
    await runtime.crash();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      `Restart proof and cleanup failed; retained ${runtime.directory}`,
      { cause: cleanupError }
    );
  }
  throw new Error(
    `Installed resolver restart proof failed; retained ${runtime.directory}`,
    { cause: error }
  );
}
