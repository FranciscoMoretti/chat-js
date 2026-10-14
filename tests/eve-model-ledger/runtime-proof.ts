import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "eve/client";
import { z } from "zod";
import {
  createPersistentRuntime,
  until,
} from "../eve-retirement-runtime/persistent-runtime";

const source = await mkdtemp(path.join(tmpdir(), "chatjs-ledger-source-"));
await cp(path.join(import.meta.dir, "fixture"), source, { recursive: true });
await cp(
  path.join(import.meta.dir, "../../apps/chat/lib/eve/model-ledger.ts"),
  path.join(source, "model-ledger.ts")
);
const runtime = await createPersistentRuntime(source, {
  distribution: "production-fork",
  nodeModules: path.resolve(import.meta.dir, "../../node_modules"),
  provenance:
    "Production @chat-js/eve0.61.0-chatjs.0 / 3a7acfe6ba42a8dc9d330132b11856962a675705; exact application wrapper source",
});
const row = z.object({
  kind: z.string(),
  sessionId: z.string().optional(),
  eventId: z.string().optional(),
  ownerId: z.string().optional(),
  compact: z.boolean().optional(),
  providerMetadata: z
    .object({ gateway: z.object({ cost: z.string() }) })
    .optional(),
});
const evidence = [];
console.log("Fixture:", runtime.directory);
try {
  await runtime.start();
  const client = new Client({
    host: runtime.url,
    headers: { authorization: "Bearer fixture-owner" },
  });
  // Scenarios share one server but use separate sessions; inspect evidence after each.
  /* oxlint-disable no-await-in-loop */
  for (const scenario of ["normal", "blank", "auto"]) {
    const { session, response } = await client.sessions.create({
      message: `case:${scenario} ${scenario === "auto" ? "long history ".repeat(1600) : "First question"}`,
      signal: AbortSignal.timeout(30_000),
    });
    await response.result();
    const second = await session.send(`case:${scenario} Second question`, {
      signal: AbortSignal.timeout(30_000),
    });
    await second.result();
    if (scenario !== "auto") {
      const before = await session.snapshot();
      await session.compact();
      await until(async () => {
        const current = await session.snapshot();
        return current.events
          .slice(before.events.length)
          .some((event) => event.type === "session.waiting")
          ? true
          : undefined;
      }, 30_000);
    }
    const snapshot = await session.snapshot({
      signal: AbortSignal.timeout(30_000),
    });
    const contents = await readFile(
      path.join(runtime.directory, "ledger.jsonl"),
      "utf-8"
    );
    const rows = contents
      .trim()
      .split("\n")
      .map((line) => row.parse(JSON.parse(line)));
    const scoped = rows.filter(
      (value) => value.sessionId === session.state.sessionId
    );
    const receipts = scoped.filter((value) => value.kind === "receipt");
    const intents = scoped.filter((value) => value.kind === "intent");
    assert.equal(receipts.length, intents.length);
    assert.ok(receipts.every((value) => value.ownerId === "owner"));
    assert.ok(
      receipts.some((value) => value.providerMetadata?.gateway.cost === "0.02"),
      `Compaction reached wrapper: ${scenario}`
    );
    assert.equal(
      new Set(intents.map((value) => value.eventId)).size,
      intents.length
    );
    const checkpoints = snapshot.events.filter(
      (value) => value.type === "compaction.completed"
    ).length;
    assert.equal(checkpoints > 0, scenario !== "blank");
    const replay = await session.snapshot();
    assert.deepEqual(replay.events, snapshot.events);
    evidence.push({
      scenario,
      sessionId: session.state.sessionId,
      receipts: receipts.length,
      checkpoints,
    });
  }
  /* oxlint-enable no-await-in-loop */
  await writeFile(
    path.join(runtime.directory, "proof.json"),
    JSON.stringify(evidence, null, 2)
  );
  console.log(JSON.stringify({ status: "passed", evidence }, null, 2));
} finally {
  await runtime.crash();
}
