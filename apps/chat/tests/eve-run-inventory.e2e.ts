/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/eve-run-inventory"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */

import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import {
  readEvePostgresRunInventory,
  readEvePostgresRunInventoryInTransaction,
} from "../lib/db/eve-run-inventory";
import { env } from "../lib/env";
/* oxlint-enable import/no-relative-parent-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Run inventory acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 1 });
const ids: string[] = [];
const streamIds: string[] = [];
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): afterAll uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
afterAll(async () => {
  if (streamIds.length > 0) {
    await query`delete from workflow.workflow_stream_chunks where stream_id in ${query(streamIds)}`;
  }
  if (ids.length > 0) {
    await query`delete from workflow.workflow_runs where id in ${query(ids)}`;
  }
  await query.end();
});
/* oxlint-enable no-magic-numbers */

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): run accepts attributes: Record<string, string> = {}; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
async function run(
  attributes: Record<string, string> = {},
  status = "completed"
): Promise<string> {
  const id = crypto.randomUUID();
  ids.push(id);
  await query`
    insert into workflow.workflow_runs (id, name, deployment_id, status, attributes, input)
    values (${id}, 'inventory-fixture', 'inventory-fixture', ${status},
      ${query.json(attributes)}, ${query.json({ secret: "must not be loaded" })})
  `;
  return id;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

async function stream(
  runId: string | null,
  existingId?: string
): Promise<string> {
  const id = existingId ?? crypto.randomUUID();
  streamIds.push(id);
  await query`
    insert into workflow.workflow_stream_chunks (id, stream_id, run_id, data, eof)
    values (${crypto.randomUUID()}, ${id}, ${runId}, ${Buffer.from("private payload")}, false)
  `;
  return id;
}

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("inventories native descendants and collectors without returning payloads or unr keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("inventories native descendants and collectors without returning payloads or unr uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
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
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-statements, unicorn/no-null --
 * max-statements (#512): test("reports active work, missing relationships, and streams without exclusive owner keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("reports active work, missing relationships, and streams without exclusive owner preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable max-statements, unicorn/no-null */

test("cyclic parent metadata terminates without duplicating records", async () => {
  const root = await run();
  const child = await run({ $parentRunId: root });
  await query`update workflow.workflow_runs set attributes = ${query.json({ $parentRunId: child })} where id = ${root}`;
  const inventory = await readEvePostgresRunInventory(query, root);
  expect(inventory.runs.map((row) => row.id).toSorted()).toEqual(
    [root, child].toSorted()
  );
});

/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): test("retains missing queue-discovered seeds as incomplete ownership") accepts transaction; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("retains missing queue-discovered seeds as incomplete ownership", async () => {
  const root = await run();
  const missing = crypto.randomUUID();
  const inventory = await query.begin(
    "isolation level repeatable read read only",
    async (transaction) =>
      await readEvePostgresRunInventoryInTransaction(transaction, root, [
        missing,
      ])
  );
  expect(inventory.missingRunIds).toEqual([missing]);
  expect(inventory.runs.map((row) => row.id)).toEqual([root]);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
