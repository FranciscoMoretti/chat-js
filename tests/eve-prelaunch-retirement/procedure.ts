import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { defaultMessageReducer } from "eve/client";
import type { Client } from "eve/client";
import type { Sql } from "postgres";

import { assertPostgresLifecycleCompatibility } from "../../apps/chat/lib/eve/lifecycle/postgres/compatibility";
import { readEvePostgresRunInventory } from "../../apps/chat/lib/eve/lifecycle/postgres/eve-run-inventory";
import { fenceEvePostgresSession } from "../../apps/chat/lib/eve/lifecycle/postgres/eve-session-fence";
import { until } from "../eve-retirement-runtime/persistent-runtime";

// This investigation API is intentionally not a production CLI. Its caller must
// own the target, stop admission, and explicitly select every session.
const inventoryRetirement = async (
  connection: Sql,
  roots: readonly string[]
) => {
  assert.ok(roots.length > 0 && roots.length <= 100);
  await assertPostgresLifecycleCompatibility(connection);
  const scopes = [];
  // Inventory validates each session before proceeding; a failed scope must stop collection.
  /* oxlint-disable no-await-in-loop */
  for (const root of new Set(roots)) {
    const inventory = await readEvePostgresRunInventory(connection, root);
    assert.deepEqual(
      inventory.missingRunIds,
      [],
      "Resolve missing descendants first"
    );
    assert.deepEqual(
      inventory.ambiguousStreamIds,
      [],
      "Resolve ambiguous streams first"
    );
    scopes.push({
      activeRunIds: inventory.activeRunIds,
      root,
      runIds: inventory.runs.map((run) => run.id),
      streamIds: inventory.streamIds,
    });
  }
  /* oxlint-enable no-await-in-loop */
  return scopes;
};
const archiveRetirement = async (
  connection: Sql,
  client: Client,
  roots: readonly string[],
  directory: string
) => {
  const scopes = await inventoryRetirement(connection, roots);
  await mkdir(directory, { mode: 0o700, recursive: true });
  const sessions = [];
  const transcript: string[] = [
    "# Read-only prelaunch history",
    "Pending approvals below are abandoned historical records; never execute or replay them.",
  ];
  // Archive each native snapshot and its database evidence in session order before continuing.
  /* oxlint-disable no-await-in-loop */
  for (const scope of scopes) {
    const snapshot = await client.sessions
      .attach(scope.root)
      .snapshot({ signal: AbortSignal.timeout(15_000) });
    const events =
      await connection`select * from workflow.workflow_events where run_id in ${connection(scope.runIds)} order by run_id, id`;
    const streams =
      await connection`select * from workflow.workflow_stream_chunks where run_id in ${connection(scope.runIds)}`;
    sessions.push({ ...scope, events, snapshot, streams });
    const reducer = defaultMessageReducer();
    let state = reducer.initial();
    const reduceEvent = reducer.reduce.bind(reducer);
    for (const event of snapshot.events) {
      state = reduceEvent(state, event);
    }
    transcript.push(`## ${scope.root}`);
    for (const message of state.messages) {
      transcript.push(`### ${message.role}`);
      for (const part of message.parts) {
        transcript.push(
          part.type === "text" ? part.text : JSON.stringify(part)
        );
      }
    }
  }
  /* oxlint-enable no-await-in-loop */
  const target =
    await connection`select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port`;
  const content = JSON.stringify(
    {
      format: 1,
      semantics:
        "read-only history; pending actions abandoned, never executable",
      sessions,
      target,
    },
    null,
    2
  );
  const digest = new Bun.CryptoHasher("sha256").update(content).digest("hex");
  await writeFile(path.join(directory, "archive.json"), content, {
    flag: "wx",
    mode: 0o600,
  });
  await writeFile(
    path.join(directory, "README.md"),
    "# Retired prelaunch history\n\nThis immutable JSON archive contains decoded native snapshots and original events/stream payloads. Pending approvals are historical records, not actionable requests. No messages or tools may be replayed from this archive.\n",
    { flag: "wx", mode: 0o600 }
  );
  await writeFile(
    path.join(directory, "transcript.md"),
    transcript.join("\n\n"),
    { flag: "wx", mode: 0o600 }
  );
  return { digest, directory, scopes, target };
};
const applyRetirement = async (
  connection: Sql,
  client: Client,
  plan: Awaited<ReturnType<typeof archiveRetirement>>,
  afterReset?: () => Promise<void>
) => {
  const archive = await readFile(
    path.join(plan.directory, "archive.json"),
    "utf-8"
  );
  assert.equal(
    new Bun.CryptoHasher("sha256").update(archive).digest("hex"),
    plan.digest,
    "Archive must be verified before mutation"
  );
  assert.deepEqual(
    await connection`select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port`,
    plan.target,
    "Target database changed"
  );
  const current = await inventoryRetirement(
    connection,
    plan.scopes.map((scope) => scope.root)
  );
  assert.deepEqual(
    current.map(({ root, runIds, streamIds }) => ({ root, runIds, streamIds })),
    plan.scopes.map(({ root, runIds, streamIds }) => ({
      root,
      runIds,
      streamIds,
    })),
    "Changed inventory requires a new archive and review"
  );
  // Retirement must finish reset, terminal evidence, marker, and fencing before another session starts.
  /* oxlint-disable no-await-in-loop */
  for (const scope of plan.scopes) {
    const [marker] =
      await connection`select session_id from workflow.eve_session_retirements where session_id=${scope.root}`;
    if (marker === undefined) {
      // Terminal native reset invalidates pending approval; never respond/approve.
      await client.sessions.attach(scope.root).reset({
        reason: "Prelaunch session retired",
        signal: AbortSignal.timeout(30_000),
      });
      await afterReset?.();
      const inventory = await until(async () => {
        const status = await readEvePostgresRunInventory(
          connection,
          scope.root
        );
        return status.activeRunIds.length === 0 ? status : undefined;
      }, 30_000);
      assert.deepEqual(
        inventory.runs.map((run) => run.id),
        scope.runIds,
        "Descendant inventory changed during reset; re-archive before completing"
      );
      assert.deepEqual(
        inventory.streamIds,
        scope.streamIds,
        "Stream inventory changed during reset; re-archive before completing"
      );
      assert.deepEqual(
        inventory.activeRunIds,
        [],
        "Reset must terminally retire every descendant"
      );
      await connection`insert into workflow.eve_session_retirements(session_id) values(${scope.root}) on conflict do nothing`;
    }
    await fenceEvePostgresSession(connection, scope.root);
    // Keep immutable command/owner/conversation identity; only retire its authority.
    await connection`update "EveSubmission" s set state='retired', "messageId"=null from "EveConversation" c where c.id=s."conversationId" and c."ownerId"=s."ownerId" and c."sessionId"=${scope.root} and s.state<>'retired'`;
  }
  /* oxlint-enable no-await-in-loop */
};

export { inventoryRetirement, archiveRetirement, applyRetirement };
