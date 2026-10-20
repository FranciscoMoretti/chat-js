import postgres from "postgres";
import { afterAll, expect, test, vi } from "vitest";

import {
  prepareEveNativeSessionPurge,
  purgeEveNativeSession,
  retireEveNativeSessions,
} from "@/lib/eve/lifecycle/postgres/eve-native-purge";
import { purgeEvePostgresSessionPayloads } from "@/lib/eve/lifecycle/postgres/eve-payload-purge";
import { installEvePostgresQueueFence } from "@/lib/eve/lifecycle/postgres/eve-queue-fence";
import { purgeEvePostgresQueue } from "@/lib/eve/lifecycle/postgres/eve-queue-purge";
import { installEvePostgresResourceFence } from "@/lib/eve/lifecycle/postgres/eve-resource-fence";
import { verifyEveSandboxCoverage } from "@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof";
import { fenceEvePostgresSession } from "@/lib/eve/lifecycle/postgres/eve-session-fence";

import { env } from "../lib/env";

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Payload purge acceptance requires local Postgres.");
}
const query = postgres(env.DATABASE_URL, { max: 2 });
const task = `eve-payload-purge-${crypto.randomUUID()}`;
const rejectUnexpectedRetirement = vi
  .fn<() => Promise<never>>()
  .mockRejectedValue(new Error("must not retire twice"));
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
  try {
    // Drain the six independent payload deletes before run deletion or pool closure.
    const deletions = await Promise.allSettled(
      tables.map(
        (table) =>
          query`delete from ${query(`workflow.${table}`)} where run_id in ${query(runIds)}`
      )
    );
    const failed = deletions.find((result) => result.status === "rejected");
    if (failed) {
      const reason: unknown = failed.reason;
      throw reason;
    }
    await query`delete from workflow.workflow_runs where id in ${query(runIds)}`;
    await query`delete from workflow.eve_sandbox_coverage where session_id in ${query(runIds)}`;
    await query`delete from workflow.eve_session_retirements where session_id in ${query(runIds)}`;
    await query`delete from workflow.eve_payload_purges where task_identifier = ${task}`;
    await query`delete from workflow.eve_queue_purge_runs where task_identifier = ${task}`;
    await query`delete from workflow.eve_queue_tasks where identifier = ${task}`;
    await query`delete from graphile_worker._private_tasks where identifier = ${task}`;
    await query`delete from workflow.eve_resource_fences where resource in ${query(runIds.flatMap((id) => [`run:${id}`, `stream:${id}`]))}`;
  } finally {
    await query.end();
  }
});

const fixture = async (parent?: string): Promise<string> => {
  const id = crypto.randomUUID();
  runIds.push(id);
  await query`insert into workflow.workflow_runs(id, name, deployment_id, status, attributes) values (${id}, 'purge-fixture', 'fixture', 'completed', ${query.json(parent === undefined || parent === null || parent === "" ? {} : { $parentRunId: parent })})`;
  await query`insert into workflow.workflow_stream_chunks(id, stream_id, run_id, data, eof) values (${crypto.randomUUID()}, ${id}, ${id}, ${Buffer.from("private payload")}, true)`;
  await query`insert into workflow.workflow_events(id, run_id, type) values (${crypto.randomUUID()}, ${id}, 'step_completed')`;
  await query`insert into workflow.workflow_event_slots(run_id) values (${id})`;
  await query`insert into workflow.workflow_steps(step_id, run_id, step_name, status, attempt) values (${crypto.randomUUID()}, ${id}, 'fixture', 'completed', 1)`;
  await query`insert into workflow.workflow_hooks(hook_id, run_id, token, owner_id, project_id, environment) values (${crypto.randomUUID()}, ${id}, ${id}, 'fixture', 'fixture', 'test')`;
  await query`insert into workflow.workflow_waits(wait_id, run_id, status) values (${crypto.randomUUID()}, ${id}, 'completed')`;
  return id;
};

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
  await Promise.all(
    tables.map(async (table) => {
      expect(
        await query`select run_id from ${query(`workflow.${table}`)} where run_id in ${query([root, child])}`
      ).toEqual([]);
      expect(
        await query`select run_id from ${query(`workflow.${table}`)} where run_id = ${unrelated}`
      ).toHaveLength(1);
    })
  );
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
  const receipt = await purgeEveNativeSession(
    env.DATABASE_URL,
    input,
    vi.fn<() => Promise<void>>().mockResolvedValue()
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
  const failedRetirement = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("unsettled usage"));
  await expect(
    purgeEveNativeSession(env.DATABASE_URL, scope, failedRetirement)
  ).rejects.toThrow("unsettled usage");
  expect(
    await query`select session_id from workflow.eve_session_retirements where session_id = ${root}`
  ).toEqual([]);
  // Retirement succeeded, but a reachable child has not finished yet.
  const child = await fixture(root);
  await query`update workflow.workflow_runs set status = 'running' where id = ${child}`;
  const completedRetirement = vi.fn<() => Promise<void>>().mockResolvedValue();
  await expect(
    purgeEveNativeSession(env.DATABASE_URL, scope, completedRetirement)
  ).rejects.toThrow();
  expect(
    await query`select session_id from workflow.eve_session_retirements where session_id = ${root}`
  ).toEqual([{ session_id: root }]);
  await query`update workflow.workflow_runs set status = 'completed' where id = ${child}`;
  const receipt = await purgeEveNativeSession(
    env.DATABASE_URL,
    scope,
    rejectUnexpectedRetirement
  );
  expect(receipt.runIds).toEqual([root, child].toSorted());
  expect(
    await purgeEveNativeSession(
      env.DATABASE_URL,
      scope,
      rejectUnexpectedRetirement
    )
  ).toEqual(receipt);
  expect([
    ...failedRetirement.mock.calls,
    ...completedRetirement.mock.calls,
  ]).toEqual([[], []]);
});

test("concurrent native cleanup attempts retire once and share the completed receipt", async () => {
  const root = await fixture();
  const scope = { sessionId: root, taskIdentifier: task };
  const retire = vi.fn<() => Promise<void>>().mockResolvedValue();
  const receipts = await Promise.all([
    purgeEveNativeSession(env.DATABASE_URL, scope, retire),
    purgeEveNativeSession(env.DATABASE_URL, scope, retire),
  ]);
  expect(retire).toHaveBeenCalledExactlyOnceWith();
  expect(receipts[0]).toEqual(receipts[1]);
  expect(receipts[0].runIds).toEqual([root]);
});

test("family retirement persists partial progress without erasing another member's payloads", async () => {
  const first = await fixture();
  const second = await fixture();
  const firstPass = vi
    .fn<(id: string) => Promise<void>>()
    .mockResolvedValueOnce()
    .mockRejectedValueOnce(new Error("usage not settled"));
  await expect(
    retireEveNativeSessions(env.DATABASE_URL, [first, second], firstPass)
  ).rejects.toThrow("usage not settled");
  expect(firstPass.mock.calls).toEqual([[first], [second]]);
  expect(
    await query`select session_id from workflow.eve_session_retirements where session_id in ${query([first, second])}`
  ).toEqual([{ session_id: first }]);
  expect(
    await query`select id from workflow.workflow_runs where id in ${query([first, second])}`
  ).toHaveLength(2);
  const retry = vi.fn<(id: string) => Promise<void>>().mockResolvedValue();
  await retireEveNativeSessions(
    env.DATABASE_URL,
    [first, second, first],
    retry
  );
  expect([...firstPass.mock.calls, ...retry.mock.calls]).toEqual([
    [first],
    [second],
    [second],
  ]);
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
  const retire = vi.fn<() => Promise<void>>().mockResolvedValue();
  const inventory = await prepareEveNativeSessionPurge(
    env.DATABASE_URL,
    scope,
    retire
  );
  expect(inventory.runIds).toEqual([root, child, queued].toSorted());
  expect(inventory.streamIds).toEqual([root, child, queued].toSorted());
  await Promise.all(
    tables.map(async (table) => {
      expect(
        await query`select run_id from ${query(`workflow.${table}`)} where run_id in ${query([root, child])}`
      ).toHaveLength(2);
    })
  );
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
  expect(retire).toHaveBeenCalledExactlyOnceWith();
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
    prepareEveNativeSessionPurge(
      env.DATABASE_URL,
      scope,
      vi.fn<() => Promise<void>>().mockResolvedValue()
    )
  ).rejects.toThrow("Resolve missing runs");
  expect(
    await query`select id from workflow.workflow_runs where id = ${root}`
  ).toHaveLength(1);
  expect(
    await query`select session_id from workflow.eve_payload_purges where session_id = ${root}`
  ).toHaveLength(0);
  await expect(
    prepareEveNativeSessionPurge(
      env.DATABASE_URL,
      scope,
      vi.fn<() => Promise<void>>().mockResolvedValue()
    )
  ).rejects.toThrow("Resolve missing runs");
});

test("sandbox coverage requires fences and receipts, then survives native payload erasure", async () => {
  const root = await fixture();
  const child = await fixture(root);
  await query`update workflow.workflow_runs set name = 'workflow//eve//workflowEntry' where id in ${query([root, child])}`;
  const input = { appRoot: "/fixture", runIds: [root, child], sessionId: root };
  const verify = vi
    .fn<(sessionId: string) => Promise<void>>()
    .mockResolvedValue();
  await expect(verifyEveSandboxCoverage(query, input, verify)).rejects.toThrow(
    "Fence native writers"
  );
  const inventory = await fenceEvePostgresSession(query, root);
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
  expect(verify.mock.calls).toEqual(
    [root, child].toSorted().map((sessionId) => [sessionId])
  );
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
  expect(verify).toHaveBeenCalledTimes(2);
});

test("unknown workflow coverage never calls the ownership verifier", async () => {
  const root = await fixture();
  await fenceEvePostgresSession(query, root);
  const verify = vi
    .fn<(sessionId: string) => Promise<void>>()
    .mockResolvedValue();
  await expect(
    verifyEveSandboxCoverage(
      query,
      { appRoot: "/fixture", runIds: [root], sessionId: root },
      verify
    )
  ).rejects.toThrow("incomplete sandbox workflow coverage");
  expect(verify).not.toHaveBeenCalled();
});
