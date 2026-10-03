/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/eve-native-purge"; "../lib/db/eve-payload-purge"; "../lib/db/eve-queue-fence"; "../lib/db/eve-queue-purge"; "../lib/db/eve-resource-fence" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable unicorn/consistent-function-scoping -- One-off helpers stay beside the scenario state they coordinate. */
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
} from "../lib/db/eve-native-purge";
import { purgeEvePostgresSessionPayloads } from "../lib/db/eve-payload-purge";
import { installEvePostgresQueueFence } from "../lib/db/eve-queue-fence";
import { purgeEvePostgresQueue } from "../lib/db/eve-queue-purge";
import { installEvePostgresResourceFence } from "../lib/db/eve-resource-fence";
import {
  isFencedEveDescendant,
  verifyEveSandboxCoverage,
} from "../lib/db/eve-sandbox-coverage-proof";
import { fenceEvePostgresSession } from "../lib/db/eve-session-fence";
import { env } from "../lib/env";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Payload purge acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 2 });
const task = `eve-payload-purge-${crypto.randomUUID()}`;
const runIds: string[] = [];
const tables = [
  "workflow_stream_chunks",
  "workflow_events",
  "workflow_event_slots",
  "workflow_steps",
  "workflow_hooks",
  "workflow_waits",
];
/* oxlint-disable node/no-top-level-await --
 * node/no-top-level-await (#539): await installEvePostgresResourceFence(query); runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
await installEvePostgresResourceFence(query);
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable node/no-top-level-await --
 * node/no-top-level-await (#539): await installEvePostgresQueueFence(query, task); runs in the configured Bun/ESM entrypoint and must finish before following module work; do not introduce background initialization.
 */
await installEvePostgresQueueFence(query, task);
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable max-statements, oxc/no-async-await --
 * max-statements (#512): afterAll keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): afterAll sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
afterAll(async () => {
  for (const table of tables) {
    await query`delete from ${query(`workflow.${table}`)} where run_id in ${query(runIds)}`;
  }
  await query`delete from workflow.workflow_runs where id in ${query(runIds)}`;
  await query`delete from workflow.eve_sandbox_coverage where session_id in ${query(runIds)}`;
  await query`delete from workflow.eve_session_retirements where session_id in ${query(runIds)}`;
  await query`delete from workflow.eve_payload_purges where task_identifier = ${task}`;
  await query`delete from workflow.eve_queue_purge_runs where task_identifier = ${task}`;
  await query`delete from workflow.eve_queue_tasks where identifier = ${task}`;
  await query`delete from graphile_worker._private_tasks where identifier = ${task}`;
  await query`delete from workflow.eve_resource_fences where resource in ${query(runIds.flatMap((id) => [`run:${id}`, `stream:${id}`]))}`;
  await query.end();
});
/* oxlint-enable max-statements, oxc/no-async-await */
/* oxlint-disable no-ternary, oxc/no-async-await, typescript/strict-boolean-expressions --
 * no-ternary (#518): fixture derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): fixture sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/strict-boolean-expressions (#610): fixture intentionally keeps the existing falsy-value behavior of parent; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
async function fixture(parent?: string): Promise<string> {
  const id = crypto.randomUUID();
  runIds.push(id);
  await query`insert into workflow.workflow_runs(id, name, deployment_id, status, attributes) values (${id}, 'purge-fixture', 'fixture', 'completed', ${query.json(parent ? { $parentRunId: parent } : {})})`;
  await query`insert into workflow.workflow_stream_chunks(id, stream_id, run_id, data, eof) values (${crypto.randomUUID()}, ${id}, ${id}, ${Buffer.from("private payload")}, true)`;
  await query`insert into workflow.workflow_events(id, run_id, type) values (${crypto.randomUUID()}, ${id}, 'step_completed')`;
  await query`insert into workflow.workflow_event_slots(run_id) values (${id})`;
  await query`insert into workflow.workflow_steps(step_id, run_id, step_name, status, attempt) values (${crypto.randomUUID()}, ${id}, 'fixture', 'completed', 1)`;
  await query`insert into workflow.workflow_hooks(hook_id, run_id, token, owner_id, project_id, environment) values (${crypto.randomUUID()}, ${id}, ${id}, 'fixture', 'fixture', 'test')`;
  await query`insert into workflow.workflow_waits(wait_id, run_id, status) values (${crypto.randomUUID()}, ${id}, 'completed')`;
  return id;
}
/* oxlint-enable no-ternary, oxc/no-async-await, typescript/strict-boolean-expressions */

/* oxlint-disable max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties --
 * max-statements (#512): test("purge requires fences, removes every native payload table, isolates other sessi keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("purge requires fences, removes every native payload table, isolates other sessi uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("purge requires fences, removes every native payload table, isolates other sessi sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("purge requires fences, removes every native payload table, isolates other sessi copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
test("purge requires fences, removes every native payload table, isolates other sessions and retries after root deletion", async () => {
  const root = await fixture();
  const child = await fixture(root);
  const unrelated = await fixture();
  const input = { sessionId: root, taskIdentifier: task };
  await expect(purgeEvePostgresSessionPayloads(query, input)).rejects.toThrow(
    "Fence every run"
  );
  const inventory = await fenceEvePostgresSession(query, root);
  await purgeEvePostgresQueue(query, { ...input, runIds: inventory.runIds });
  const receipt = await purgeEvePostgresSessionPayloads(query, input);
  expect(receipt.runIds).toEqual([root, child].toSorted());
  expect(receipt.streamIds).toEqual([root, child].toSorted());
  for (const table of tables) {
    expect(
      await query`select run_id from ${query(`workflow.${table}`)} where run_id in ${query([root, child])}`
    ).toEqual([]);
    expect(
      await query`select run_id from ${query(`workflow.${table}`)} where run_id = ${unrelated}`
    ).toHaveLength(1);
  }
  expect(
    await query`select id from workflow.workflow_runs where id in ${query([root, child])}`
  ).toEqual([]);
  expect(await purgeEvePostgresSessionPayloads(query, input)).toEqual(receipt);
  await expect(
    query`insert into workflow.workflow_events(id, run_id, type) values (${crypto.randomUUID()}, ${root}, 'step_completed')`
  ).rejects.toMatchObject({ code: "55000" });
});
/* oxlint-enable max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties --
 * no-magic-numbers (#517): test("queued payloads prevent removal until queue cleanup completes") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("queued payloads prevent removal until queue cleanup completes") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("queued payloads prevent removal until queue cleanup completes") copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 */
test("queued payloads prevent removal until queue cleanup completes", async () => {
  const root = await fixture();
  const envelope = {
    attempt: 1,
    data: Buffer.from(JSON.stringify({ runId: root })).toString("base64"),
    id: "fixture",
    messageId: crypto.randomUUID(),
  };
  await query`select id from graphile_worker.add_job(${task}, ${query.json(envelope)}::json, run_at := now() + interval '1 day')`;
  const inventory = await fenceEvePostgresSession(query, root);
  const input = { sessionId: root, taskIdentifier: task };
  await expect(purgeEvePostgresSessionPayloads(query, input)).rejects.toThrow(
    "Clear queued payloads"
  );
  expect(
    await query`select id from workflow.workflow_runs where id = ${root}`
  ).toHaveLength(1);
  expect(
    await query`select session_id from workflow.eve_payload_purges where session_id = ${root}`
  ).toEqual([]);
  await purgeEvePostgresQueue(query, { ...input, runIds: inventory.runIds });
  await purgeEvePostgresSessionPayloads(query, input);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable max-statements, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/promise-function-async --
 * max-statements (#512): test("queue-discovered native runs remain in the payload inventory after queue remova keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): test("queue-discovered native runs remain in the payload inventory after queue remova sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("queue-discovered native runs remain in the payload inventory after queue remova copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/promise-function-async (#606): test("queue-discovered native runs remain in the payload inventory after queue remova preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("queue-discovered native runs remain in the payload inventory after queue removal", async () => {
  const root = await fixture();
  const detached = await fixture();
  const envelope = {
    attempt: 1,
    data: Buffer.from(
      JSON.stringify({
        runId: detached,
        runInput: { attributes: { $parentRunId: root } },
      })
    ).toString("base64"),
    id: "fixture",
    messageId: crypto.randomUUID(),
  };
  await query`select id from graphile_worker.add_job(${task}, ${query.json(envelope)}::json, run_at := now() + interval '1 day')`;
  const inventory = await fenceEvePostgresSession(query, root);
  const input = { sessionId: root, taskIdentifier: task };
  await purgeEvePostgresQueue(query, { ...input, runIds: inventory.runIds });
  // Queue cleanup fences the discovered run; its stream still needs fencing.
  await expect(purgeEvePostgresSessionPayloads(query, input)).rejects.toThrow(
    "Fence every run"
  );
  const receipt = await purgeEveNativeSession(env.DATABASE_URL, input, () =>
    Promise.resolve()
  );
  expect(receipt.runIds).toEqual([root, detached].toSorted());
  expect(receipt.streamIds).toEqual([root, detached].toSorted());
  expect(
    await query`select id from workflow.workflow_runs where id = ${detached}`
  ).toEqual([]);
});
/* oxlint-enable max-statements, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/promise-function-async --
 * max-statements (#512): test("native coordinator retains retirement across failure and retries after payload  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native coordinator retains retirement across failure and retries after payload  uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("native coordinator retains retirement across failure and retries after payload  sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/explicit-function-return-type (#560): Keep test("native coordinator retains retirement across failure and retries after payload 's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/promise-function-async (#606): test("native coordinator retains retirement across failure and retries after payload  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native coordinator retains retirement across failure and retries after payload erasure", async () => {
  const root = await fixture();
  const scope = { sessionId: root, taskIdentifier: task };
  let retirements = 0;
  await expect(
    purgeEveNativeSession(env.DATABASE_URL, scope, () => {
      retirements += 1;
      return Promise.reject(new Error("unsettled usage"));
    })
  ).rejects.toThrow("unsettled usage");
  expect(
    await query`select session_id from workflow.eve_session_retirements where session_id = ${root}`
  ).toEqual([]);
  // Retirement succeeded, but a reachable child has not finished yet.
  const child = await fixture(root);
  await query`update workflow.workflow_runs set status = 'running' where id = ${child}`;
  await expect(
    purgeEveNativeSession(env.DATABASE_URL, scope, () => {
      retirements += 1;
      return Promise.resolve();
    })
  ).rejects.toThrow();
  expect(
    await query`select session_id from workflow.eve_session_retirements where session_id = ${root}`
  ).toEqual([{ session_id: root }]);
  await query`update workflow.workflow_runs set status = 'completed' where id = ${child}`;
  const shouldNotRetire = () =>
    Promise.reject(new Error("must not retire twice"));
  const receipt = await purgeEveNativeSession(
    env.DATABASE_URL,
    scope,
    shouldNotRetire
  );
  expect(receipt.runIds).toEqual([root, child].toSorted());
  expect(
    await purgeEveNativeSession(env.DATABASE_URL, scope, shouldNotRetire)
  ).toEqual(receipt);
  expect(retirements).toBe(2);
});
/* oxlint-enable max-statements, no-magic-numbers, oxc/no-async-await, typescript/explicit-function-return-type, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async --
 * no-magic-numbers (#517): test("concurrent native cleanup attempts retire once and share the completed receipt" uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("concurrent native cleanup attempts retire once and share the completed receipt" sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): test("concurrent native cleanup attempts retire once and share the completed receipt" preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("concurrent native cleanup attempts retire once and share the completed receipt", async () => {
  const root = await fixture();
  const scope = { sessionId: root, taskIdentifier: task };
  let retirements = 0;
  const retire = (): Promise<void> => {
    retirements += 1;
    return Promise.resolve();
  };
  const receipts = await Promise.all([
    purgeEveNativeSession(env.DATABASE_URL, scope, retire),
    purgeEveNativeSession(env.DATABASE_URL, scope, retire),
  ]);
  expect(retirements).toBe(1);
  expect(receipts[0]).toEqual(receipts[1]);
  expect(receipts[0].runIds).toEqual([root]);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async --
 * no-magic-numbers (#517): test("family retirement persists partial progress without erasing another member's pa uses 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("family retirement persists partial progress without erasing another member's pa sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): test("family retirement persists partial progress without erasing another member's pa preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("family retirement persists partial progress without erasing another member's payloads", async () => {
  const first = await fixture();
  const second = await fixture();
  const retired: string[] = [];
  await expect(
    retireEveNativeSessions(env.DATABASE_URL, [first, second], (id) => {
      retired.push(id);
      if (id === second) {
        return Promise.reject(new Error("usage not settled"));
      }
      return Promise.resolve();
    })
  ).rejects.toThrow("usage not settled");
  expect(
    await query`select session_id from workflow.eve_session_retirements where session_id in ${query([first, second])}`
  ).toEqual([{ session_id: first }]);
  expect(
    await query`select id from workflow.workflow_runs where id in ${query([first, second])}`
  ).toHaveLength(2);
  await retireEveNativeSessions(
    env.DATABASE_URL,
    [first, second, first],
    (id) => {
      retired.push(id);
      return Promise.resolve();
    }
  );
  expect(retired).toEqual([first, second, second]);
  expect(
    await query`select id from workflow.workflow_runs where id in ${query([first, second])}`
  ).toHaveLength(2);
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable max-statements, no-magic-numbers, oxc/no-async-await, typescript/promise-function-async --
 * max-statements (#512): test("preparation keeps native payloads for inventory and recovers the same identitie keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("preparation keeps native payloads for inventory and recovers the same identitie uses 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("preparation keeps native payloads for inventory and recovers the same identitie sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): test("preparation keeps native payloads for inventory and recovers the same identitie preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("preparation keeps native payloads for inventory and recovers the same identities after purge", async () => {
  const root = await fixture();
  const child = await fixture(root);
  const queued = await fixture();
  const envelope = {
    data: Buffer.from(
      JSON.stringify({
        runId: queued,
        runInput: { attributes: { $parentRunId: child } },
      })
    ).toString("base64"),
  };
  await query`select id from graphile_worker.add_job(${task}, ${query.json(envelope)}::json, run_at := now() + interval '1 day')`;
  const scope = { sessionId: root, taskIdentifier: task };
  let retirements = 0;
  const retire = (): Promise<void> => {
    retirements += 1;
    return Promise.resolve();
  };
  const inventory = await prepareEveNativeSessionPurge(
    env.DATABASE_URL,
    scope,
    retire
  );
  expect(inventory.runIds).toEqual([root, child, queued].toSorted());
  expect(inventory.streamIds).toEqual([root, child, queued].toSorted());
  for (const table of tables) {
    expect(
      await query`select run_id from ${query(`workflow.${table}`)} where run_id in ${query([root, child])}`
    ).toHaveLength(2);
  }
  expect(
    await query`select session_id from workflow.eve_payload_purges where session_id = ${root}`
  ).toEqual([]);
  await expect(
    query`insert into workflow.workflow_events(id, run_id, type) values (${crypto.randomUUID()}, ${child}, 'step_completed')`
  ).rejects.toMatchObject({ code: "55000" });
  expect(
    await prepareEveNativeSessionPurge(env.DATABASE_URL, scope, retire)
  ).toEqual(inventory);
  expect(await purgeEveNativeSession(env.DATABASE_URL, scope, retire)).toEqual(
    inventory
  );
  expect(
    await prepareEveNativeSessionPurge(env.DATABASE_URL, scope, retire)
  ).toEqual(inventory);
  expect(retirements).toBe(1);
});
/* oxlint-enable max-statements, no-magic-numbers, oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async --
 * no-magic-numbers (#517): test("missing queue-discovered runs stop preparation before payload erasure") uses 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("missing queue-discovered runs stop preparation before payload erasure") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): test("missing queue-discovered runs stop preparation before payload erasure") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("missing queue-discovered runs stop preparation before payload erasure", async () => {
  const root = await fixture();
  const missing = crypto.randomUUID();
  runIds.push(missing);
  const envelope = {
    data: Buffer.from(
      JSON.stringify({
        runId: missing,
        runInput: { attributes: { $parentRunId: root } },
      })
    ).toString("base64"),
  };
  await query`select id from graphile_worker.add_job(${task}, ${query.json(envelope)}::json, run_at := now() + interval '1 day')`;
  const scope = { sessionId: root, taskIdentifier: task };
  await expect(
    prepareEveNativeSessionPurge(env.DATABASE_URL, scope, () =>
      Promise.resolve()
    )
  ).rejects.toThrow("Resolve missing runs");
  expect(
    await query`select id from workflow.workflow_runs where id = ${root}`
  ).toHaveLength(1);
  expect(
    await query`select session_id from workflow.eve_payload_purges where session_id = ${root}`
  ).toHaveLength(0);
  await expect(
    prepareEveNativeSessionPurge(env.DATABASE_URL, scope, () =>
      Promise.resolve()
    )
  ).rejects.toThrow("Resolve missing runs");
});
/* oxlint-enable no-magic-numbers, oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/promise-function-async --
 * max-lines-per-function (#510): test("sandbox coverage requires fences and receipts, then survives native payload era keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("sandbox coverage requires fences and receipts, then survives native payload era keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("sandbox coverage requires fences and receipts, then survives native payload era uses 1, 0, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("sandbox coverage requires fences and receipts, then survives native payload era sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("sandbox coverage requires fences and receipts, then survives native payload era copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/promise-function-async (#606): test("sandbox coverage requires fences and receipts, then survives native payload era preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("sandbox coverage requires fences and receipts, then survives native payload erasure", async () => {
  const root = await fixture();
  const child = await fixture(root);
  await query`update workflow.workflow_runs set name = 'workflow//eve//workflowEntry' where id in ${query([root, child])}`;
  const input = { appRoot: "/fixture", runIds: [root, child], sessionId: root };
  let reads = 0;
  const verify = (): Promise<void> => {
    reads += 1;
    return Promise.resolve();
  };
  await expect(verifyEveSandboxCoverage(query, input, verify)).rejects.toThrow(
    "Fence native writers"
  );
  expect(await isFencedEveDescendant(env.DATABASE_URL, root, child)).toBe(
    false
  );
  const inventory = await fenceEvePostgresSession(query, root);
  expect(await isFencedEveDescendant(env.DATABASE_URL, root, child)).toBe(true);
  expect(
    await isFencedEveDescendant(env.DATABASE_URL, root, crypto.randomUUID())
  ).toBe(false);
  await expect(
    verifyEveSandboxCoverage(query, input, () => {
      throw new Error("receipt absent");
    })
  ).rejects.toThrow("receipt absent");
  expect(
    await query`select session_id from workflow.eve_sandbox_coverage where session_id = ${root}`
  ).toHaveLength(0);
  expect(await verifyEveSandboxCoverage(query, input, verify)).toEqual(
    [root, child].toSorted()
  );
  expect(reads).toBe(2);
  await purgeEvePostgresQueue(query, {
    runIds: inventory.runIds,
    sessionId: root,
    taskIdentifier: task,
  });
  await purgeEvePostgresSessionPayloads(query, {
    sessionId: root,
    taskIdentifier: task,
  });
  expect(
    await verifyEveSandboxCoverage(query, input, () => {
      throw new Error("must use saved proof");
    })
  ).toEqual([root, child].toSorted());
  await expect(
    verifyEveSandboxCoverage(query, { ...input, appRoot: "/other" }, verify)
  ).rejects.toThrow("scope changed");
  await expect(
    verifyEveSandboxCoverage(query, { ...input, runIds: [root] }, verify)
  ).rejects.toThrow("scope changed");
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/promise-function-async */
/* oxlint-disable oxc/no-async-await, typescript/promise-function-async --
 * oxc/no-async-await (#540): test("unknown workflow coverage never calls the ownership verifier") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/promise-function-async (#606): test("unknown workflow coverage never calls the ownership verifier") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("unknown workflow coverage never calls the ownership verifier", async () => {
  const root = await fixture();
  await fenceEvePostgresSession(query, root);
  let called = false;
  await expect(
    verifyEveSandboxCoverage(
      query,
      { appRoot: "/fixture", runIds: [root], sessionId: root },
      () => {
        called = true;
        return Promise.resolve();
      }
    )
  ).rejects.toThrow("incomplete sandbox workflow coverage");
  expect(called).toBe(false);
});
/* oxlint-enable oxc/no-async-await, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This eve-payload-purge.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
