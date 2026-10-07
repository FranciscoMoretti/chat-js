import { createWorld } from "@workflow/world-postgres";
import postgres from "postgres";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterAll, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { env } from "@/lib/env";
import { installEvePostgresQueueFence } from "@/lib/eve/lifecycle/postgres/eve-queue-fence";
import { installEvePostgresResourceFence } from "@/lib/eve/lifecycle/postgres/eve-resource-fence";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createEveLifecycleProvider } from "@/lib/eve/lifecycle/provider";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */

assertEveTestDatabase(env.DATABASE_URL);
const connection = postgres(env.DATABASE_URL, { max: 1 });
const provider = createEveLifecycleProvider({
  databaseUrl: env.DATABASE_URL,
  world: "@workflow/world-postgres",
});
if (!provider.supported) {
  throw new Error(provider.reason);
}
const lifecycle = provider;
const world = createWorld({
  applicationManagedShutdown: true,
  connectionString: env.DATABASE_URL,
});
const fixtureIds: string[] = [];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async () => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling world.close; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
  await world.close?.();
  await connection`delete from workflow.workflow_events where run_id = any(${fixtureIds})`;
  await connection`delete from workflow.workflow_event_slots where run_id = any(${fixtureIds})`;
  await connection`delete from workflow.workflow_runs where id = any(${fixtureIds})`;
  await connection`delete from workflow.eve_payload_purges where session_id = any(${fixtureIds})`;
  await connection`delete from workflow.eve_queue_purge_runs where session_id = any(${fixtureIds})`;
  await connection`delete from workflow.eve_session_retirements where session_id = any(${fixtureIds})`;
  await connection`delete from workflow.eve_resource_fences where resource = any(${fixtureIds.map((sessionId) => `run:${sessionId}`)})`;
  await connection.end();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("setup installs the supported native lifecycle contract", async () => {
  await expect(lifecycle.check()).resolves.toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("a provider schema upgrade refuses retirement before side effects", async () => {
  const retire = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("Retirement must not run"));
  const future = "9999999999999";
  await connection`insert into workflow_drizzle.workflow_migrations (hash, created_at) values ('unsupported-test', ${future})`;
  try {
    await expect(
      lifecycle.retire([crypto.randomUUID()], retire)
    ).rejects.toThrow("Unsupported workflow lifecycle schema version");
    expect(retire).not.toHaveBeenCalled();
  } finally {
    await connection`delete from workflow_drizzle.workflow_migrations where hash = 'unsupported-test' and created_at = ${future}`;
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("disabled queue fences refuse cleanup before retirement", async () => {
  const retire = vi
    .fn<() => Promise<void>>()
    .mockRejectedValue(new Error("Retirement must not run"));
  await connection`alter table graphile_worker._private_jobs disable trigger eve_queue_fence`;
  try {
    await expect(
      lifecycle.prepare(crypto.randomUUID(), retire)
    ).rejects.toThrow("Workflow lifecycle fences are missing or disabled");
    expect(retire).not.toHaveBeenCalled();
  } finally {
    await connection`alter table graphile_worker._private_jobs enable trigger eve_queue_fence`;
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("always-enabled fences are accepted, replica-only fences are rejected", async () => {
  await connection`alter table graphile_worker._private_jobs enable always trigger eve_queue_fence`;
  try {
    await expect(lifecycle.check()).resolves.toBeUndefined();
    await connection`alter table graphile_worker._private_jobs enable replica trigger eve_queue_fence`;
    await expect(lifecycle.check()).rejects.toThrow(
      "fences are missing or disabled"
    );
  } finally {
    await connection`alter table graphile_worker._private_jobs enable trigger eve_queue_fence`;
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   "create or replace trigger eve_resource_fence after insert or update on workflow.workf's awaited sequencing and rejected-Promise behavior. */
test.each([
  "create or replace trigger eve_resource_fence after insert or update on workflow.workflow_events for each row execute function workflow.eve_guard_run_payload()",
  "create or replace trigger eve_resource_fence before insert on workflow.workflow_events for each row execute function workflow.eve_guard_run_payload()",
  "create or replace trigger eve_resource_fence before insert or update on workflow.workflow_events for each row execute function workflow.eve_guard_stream()",
  "create or replace trigger eve_resource_fence before insert or update on workflow.workflow_events for each row when (false) execute function workflow.eve_guard_run_payload()",
  "create or replace trigger eve_queue_fence before insert or update of payload on graphile_worker._private_jobs for each row execute function workflow.eve_guard_queue()",
])("altered fence definitions refuse side effects: %s", async (definition) => {
  const retire = vi.fn<() => Promise<void>>().mockResolvedValue();
  await connection.unsafe(definition);
  try {
    await expect(
      lifecycle.retire([crypto.randomUUID()], retire)
    ).rejects.toThrow("definitions are incompatible");
    expect(retire).not.toHaveBeenCalled();
  } finally {
    await installEvePostgresResourceFence(connection);
    await installEvePostgresQueueFence(connection, "workflow_flows");
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createRun's awaited sequencing and rejected-Promise behavior. */
const createRun = async (started: boolean): Promise<string> => {
  // The provider's create-run API requires null to allocate a native run ID.
  // oxlint-disable-next-line unicorn/no-null -- null is the provider's documented server-generated run ID input.
  const created = await world.events.create(null, {
    eventData: {
      deploymentId: "fixture",
      input: [],
      workflowName: "lifecycle-fixture",
    },
    eventType: "run_created",
  });
  const sessionId = created.run.runId;
  fixtureIds.push(sessionId);
  if (started) {
    await world.events.create(sessionId, { eventType: "run_started" });
  }
  return sessionId;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([false, true])'s awaited sequencing and rejected-Promise behavior. */
// Keep this ordered public-contract scenario together: retirement, fencing,
// payload removal, and retry must share the same native run and receipt.
/* oxlint-disable eslint/max-statements -- This integration scenario verifies the persisted lifecycle across sequential provider operations. */
test.each([false, true])(
  "provider retires, fences and purges a real run (started: %s)",
  async (started) => {
    const sessionId = await createRun(started);
    expect(await lifecycle.inventory(sessionId)).toMatchObject({
      activeRunIds: [sessionId],
      runIds: [sessionId],
    });
    const retire = vi.fn(async (): Promise<void> => {
      await world.events.create(sessionId, { eventType: "run_cancelled" });
    });
    const envelope = {
      data: Buffer.from(JSON.stringify({ runId: sessionId })).toString(
        "base64"
      ),
    };
    const [queued] = await connection<
      { id: string }[]
    >`select id from graphile_worker.add_job('workflow_flows', ${connection.json(envelope)}::json, run_at := now() + interval '1 day')`;
    await lifecycle.retire([sessionId, sessionId], retire);
    expect(await world.runs.get(sessionId)).toMatchObject({
      status: "cancelled",
    });
    const unexpectedRetirement = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(
        new Error("Retirement must not repeat after its durable receipt")
      );
    const resources = await lifecycle.prepare(sessionId, unexpectedRetirement);
    expect(resources.runIds).toEqual([sessionId]);
    expect(await world.runs.get(sessionId)).toMatchObject({
      status: "cancelled",
    });
    expect(
      await connection`select id from graphile_worker._private_jobs where id = ${queued.id}`
    ).toEqual([]);
    await expect(
      connection`update workflow.workflow_runs set status = 'running' where id = ${sessionId}`
    ).rejects.toMatchObject({ code: "55000" });
    expect(await lifecycle.purge(sessionId, unexpectedRetirement)).toEqual(
      resources
    );
    expect(
      await connection`select id from workflow.workflow_runs where id = ${sessionId}`
    ).toEqual([]);
    expect(await lifecycle.purge(sessionId, unexpectedRetirement)).toEqual(
      resources
    );

    expect(retire).toHaveBeenCalledExactlyOnceWith(sessionId);
  }
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
