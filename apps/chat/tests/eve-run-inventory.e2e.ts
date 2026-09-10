import postgres from "postgres";
import { afterAll, expect, test } from "vitest";
import { readEvePostgresRunInventory } from "../lib/db/eve-run-inventory";
import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Run inventory acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 1 });
const ids: string[] = [];
const streamIds: string[] = [];
afterAll(async () => {
  if (streamIds.length) {
    await query`delete from workflow.workflow_stream_chunks where stream_id in ${query(streamIds)}`;
  }
  if (ids.length) {
    await query`delete from workflow.workflow_runs where id in ${query(ids)}`;
  }
  await query.end();
});

async function run(
  attributes: Record<string, string> = {},
  status = "completed"
) {
  const id = crypto.randomUUID();
  ids.push(id);
  await query`
    insert into workflow.workflow_runs (id, name, deployment_id, status, attributes, input)
    values (${id}, 'inventory-fixture', 'inventory-fixture', ${status},
      ${query.json(attributes)}, ${query.json({ secret: "must not be loaded" })})
  `;
  return id;
}

async function stream(runId: string | null, existingId?: string) {
  const id = existingId ?? crypto.randomUUID();
  streamIds.push(id);
  await query`
    insert into workflow.workflow_stream_chunks (id, stream_id, run_id, data, eof)
    values (${crypto.randomUUID()}, ${id}, ${runId}, ${Buffer.from("private payload")}, false)
  `;
  return id;
}

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
  expect(inventory.runs.map((row) => row.id).sort()).toEqual(
    [root, turn, timer, task, collector, collectorChild].sort()
  );
  expect(inventory.streamIds.sort()).toEqual(
    [ownedStream, collectorStream].sort()
  );
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
    { $rootRunId: root, $parentRunId: missingParent },
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
    [missingCollector, missingParent].sort()
  );
  expect(inventory.ambiguousStreamIds).toEqual([shared, unidentified].sort());
  await expect(
    readEvePostgresRunInventory(query, missingParent)
  ).rejects.toThrow("session run is missing");
});

test("cyclic parent metadata terminates without duplicating records", async () => {
  const root = await run();
  const child = await run({ $parentRunId: root });
  await query`update workflow.workflow_runs set attributes = ${query.json({ $parentRunId: child })} where id = ${root}`;
  const inventory = await readEvePostgresRunInventory(query, root);
  expect(inventory.runs.map((row) => row.id).sort()).toEqual(
    [root, child].sort()
  );
});
