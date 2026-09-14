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
await installEvePostgresResourceFence(query);
await installEvePostgresQueueFence(query, task);
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
async function fixture(parent?: string) {
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

test("concurrent native cleanup attempts retire once and share the completed receipt", async () => {
  const root = await fixture();
  const scope = { sessionId: root, taskIdentifier: task };
  let retirements = 0;
  const retire = () => {
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
  const retire = () => {
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

test("sandbox coverage requires fences and receipts, then survives native payload erasure", async () => {
  const root = await fixture();
  const child = await fixture(root);
  await query`update workflow.workflow_runs set name = 'workflow//eve//workflowEntry' where id in ${query([root, child])}`;
  const input = { appRoot: "/fixture", runIds: [root, child], sessionId: root };
  let reads = 0;
  const verify = () => {
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
