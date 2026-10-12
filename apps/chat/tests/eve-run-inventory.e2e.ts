import postgres from "postgres";
import type { TransactionSql } from "postgres";
import { afterAll, expect, test } from "vitest";

import {
  readEvePostgresRunInventory,
  readEvePostgresRunInventoryInTransaction,
} from "@/lib/eve/lifecycle/postgres/eve-run-inventory";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Run inventory acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 1 });
const ids: string[] = [];
const streamIds: string[] = [];
afterAll(async () => {
  if (streamIds.length > 0) {
    await query`delete from workflow.workflow_stream_chunks where stream_id in ${query(streamIds)}`;
  }
  if (ids.length > 0) {
    await query`delete from workflow.workflow_runs where id in ${query(ids)}`;
  }
  await query.end();
});

const run = async (
  attributes: Readonly<Record<string, string>> = {},
  status = "completed"
): Promise<string> => {
  const id = crypto.randomUUID();
  ids.push(id);
  await query`
    insert into workflow.workflow_runs (id, name, deployment_id, status, attributes, input)
    values (${id}, 'inventory-fixture', 'inventory-fixture', ${status},
      ${query.json(attributes)}, ${query.json({ secret: "must not be loaded" })})
  `;
  return id;
};

const stream = async (
  runId: string | null,
  existingId?: string
): Promise<string> => {
  const id = existingId ?? crypto.randomUUID();
  streamIds.push(id);
  await query`
    insert into workflow.workflow_stream_chunks (id, stream_id, run_id, data, eof)
    values (${crypto.randomUUID()}, ${id}, ${runId}, ${Buffer.from("private payload")}, false)
  `;
  return id;
};
test("inventories native descendants and collectors without returning payloads or unrelated runs", async () => {
  const collector = await run();
  const root = await run({ "$eve.activity_collector": collector });
  const turn = await run({ "$eve.parent": root, "$eve.root": root });
  const timer = await run(
    { $parentRunId: root, $rootRunId: root },
    "cancelled"
  );
  const task = await run({ $parentRunId: turn });
  const collectorChild = await run({ $parentRunId: collector });
  const unrelated = await run();
  const ownedStream = await stream(task);
  await stream(task, ownedStream);
  const collectorStream = await stream(collectorChild);
  await stream(unrelated);
  const inventory = await readEvePostgresRunInventory(query, root);
  expect(inventory.runs.map((row) => row.id).toSorted()).toEqual(
    [root, turn, timer, task, collector, collectorChild].toSorted()
  );
  expect(inventory.streamIds.toSorted()).toEqual(
    [ownedStream, collectorStream].toSorted()
  );
  expect(
    inventory.runs.every((row) => row.workflowName === "inventory-fixture")
  ).toBe(true);
  expect(inventory.sandboxCoverage).toEqual({
    sessionIds: [],
    unresolvedRunIds: [
      root,
      turn,
      timer,
      task,
      collector,
      collectorChild,
    ].toSorted(),
  });
  expect(inventory.activeRunIds).toEqual([]);
  expect(inventory.missingRunIds).toEqual([]);
  expect(inventory.ambiguousStreamIds).toEqual([]);
  expect(JSON.stringify(inventory)).not.toContain("must not be loaded");
  expect(JSON.stringify(inventory)).not.toContain("private payload");
  expect(
    await query`select id from workflow.workflow_runs where id = ${root}`
  ).toHaveLength(1);
});

test("reports active work, missing relationships, and streams without exclusive ownership", async () => {
  const missingCollector = crypto.randomUUID();
  const root = await run({ "$eve.activity_collector": missingCollector });
  const missingParent = crypto.randomUUID();
  const child = await run(
    { $parentRunId: missingParent, $rootRunId: root },
    "running"
  );
  const unrelated = await run();
  const shared = await stream(child);
  await stream(unrelated, shared);
  const unidentified = await stream(root);
  await stream(null, unidentified);
  const inventory = await readEvePostgresRunInventory(query, root);
  expect(inventory.activeRunIds).toEqual([child]);
  expect(inventory.missingRunIds).toEqual(
    [missingCollector, missingParent].toSorted()
  );
  expect(inventory.ambiguousStreamIds).toEqual(
    [shared, unidentified].toSorted()
  );
  await expect(
    readEvePostgresRunInventory(query, missingParent)
  ).rejects.toThrow("session run is missing");
});

test("cyclic parent metadata terminates without duplicating records", async () => {
  const root = await run();
  const child = await run({ $parentRunId: root });
  await query`update workflow.workflow_runs set attributes = ${query.json({ $parentRunId: child })} where id = ${root}`;
  const inventory = await readEvePostgresRunInventory(query, root);
  expect(inventory.runs.map((row) => row.id).toSorted()).toEqual(
    [root, child].toSorted()
  );
});

test("retains missing queue-discovered seeds as incomplete ownership", async () => {
  const root = await run();
  const missing = crypto.randomUUID();
  const inventory = await query.begin(
    "isolation level repeatable read read only",
    async (transaction: ReadonlyNativeSurface<TransactionSql>) =>
      await readEvePostgresRunInventoryInTransaction(transaction, root, [
        missing,
      ])
  );
  expect(inventory.missingRunIds).toEqual([missing]);
  expect(inventory.runs.map((row) => row.id)).toEqual([root]);
});
