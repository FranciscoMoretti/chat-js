/* oxlint-disable eslint/no-console, eslint/no-magic-numbers, eslint/no-undefined, import/no-nodejs-modules, import/no-relative-parent-imports, typescript/prefer-readonly-parameter-types, unicorn/no-await-expression-member, unicorn/no-null --
 * eslint/no-console: Emit local proof results and retained evidence locations.
 * eslint/no-magic-numbers: Bounded proof deadlines, fixture counts and archive permissions are explicit protocol inputs.
 * eslint/no-undefined: Undefined represents absent durable evidence or a bounded poll still waiting.
 * import/no-nodejs-modules: The disposable proof owns local files and child processes.
 * import/no-relative-parent-imports: Exercise the exact shared runtime/provider implementation without adding a production export.
 * typescript/prefer-readonly-parameter-types: The database and runtime SDKs own these mutable parameter types; proofs do not mutate them.
 * unicorn/no-await-expression-member: Read the asserted evidence directly without maintaining a second mutable snapshot.
 * unicorn/no-null: SQL null and child process exit state are distinct protocol values.
 */
import assert from "node:assert/strict";
import path from "node:path";

import { Client } from "eve/client";
import postgres from "postgres";
import { z } from "zod";

import { assertEvePostgresRuntimeCompatibility } from "../../apps/chat/lib/db/workflow-runtime-compatibility";
import { createPersistentRuntime } from "../eve-retirement-runtime/persistent-runtime";
import { preparePostgresFixture } from "../eve-retirement-runtime/postgres-fixture";
import {
  archiveRetirement,
  applyRetirement,
  inventoryRetirement,
} from "./procedure";

const handoff = z.string().parse(process.argv[2]);
const prepared = await preparePostgresFixture({
  handoff,
  lane: "lane_d",
  nodeModules: path.resolve(import.meta.dir, "../../node_modules"),
  source: path.join(import.meta.dir, "fixture"),
});
const runtime = await createPersistentRuntime(
  prepared.source,
  {
    distribution: "production-fork",
    nodeModules: prepared.nodeModules,
    provenance: "Retirement proof of original @chat-js/eve0.61.0-chatjs.0",
  },
  { world: "postgres" }
);
const data = z
  .object({ databases: z.object({ lane_d: z.url() }) })
  .parse(await Bun.file(handoff).json());
const sql = postgres(z.string().parse(data.databases.lane_d), { max: 2 });
console.log("Retirement fixture:", runtime.directory);
try {
  await runtime.start();
  const client = new Client({
    headers: { authorization: "Bearer fixture-owner" },
    host: runtime.url,
  });
  const { session, response } = await client.sessions.create({
    message: "Run action",
    signal: AbortSignal.timeout(30_000),
  });
  await response.result();
  const before = await session.snapshot({
    signal: AbortSignal.timeout(10_000),
  });
  const requested = before.events.find(
    (event) => event.type === "input.requested"
  );
  assert.ok(requested);
  const [approval] = requested.data.requests;
  assert.notEqual(approval, undefined);
  const { sessionId } = session.state;
  const owner = crypto.randomUUID();
  const chat = crypto.randomUUID();
  const conversation = crypto.randomUUID();
  const operation = crypto.randomUUID();
  await sql`insert into "user"(id,name,email) values(${owner},'Retirement fixture',${`${owner}@test.invalid`})`;
  await sql`insert into "EveChat"(id,"ownerId",title) values(${chat},${owner},'Readable history')`;
  await sql`insert into "EveConversation"(id,"chatId","ownerId","operationId","firstMessage","sessionId",state) values(${conversation},${chat},${owner},${operation},'Run action',${sessionId},'bound')`;
  await sql`insert into "EveSubmission"("ownerId","operationId","conversationId",command,state) values(${owner},${operation},${conversation},' {"message":"Run action"}'::jsonb,'uncertain')`;
  const dry = await inventoryRetirement(sql, [sessionId]);
  assert.ok(dry[0]?.activeRunIds.length);
  await assert.rejects(
    assertEvePostgresRuntimeCompatibility(sql, "0.71.3"),
    /incompatible/u
  );
  const plan = await archiveRetirement(
    sql,
    client,
    [sessionId],
    path.join(runtime.directory, "archive")
  );
  await assert.rejects(
    applyRetirement(sql, client, { ...plan, digest: "changed archive" }),
    /Archive must be verified/u
  );
  assert.deepEqual(
    (await session.snapshot()).events,
    before.events,
    "Dry run and archive must not mutate history"
  );
  await assert.rejects(
    applyRetirement(sql, client, plan, async () => {
      await Bun.sleep(1);
      throw new Error("simulated lost result after reset");
    }),
    /simulated lost/u
  );
  await applyRetirement(sql, client, plan);
  await applyRetirement(sql, client, plan);
  await assertEvePostgresRuntimeCompatibility(sql, "0.71.3");
  const [retired] =
    await sql`select state,command,"conversationId" from "EveSubmission" where "ownerId"=${owner} and "operationId"=${operation}`;
  assert.equal(retired.state, "retired");
  assert.equal(retired.conversationId, conversation);
  assert.deepEqual(retired.command, { message: "Run action" });
  await assert.rejects(
    sql`insert into "EveSubmission"("ownerId","operationId","conversationId",command,state) values(${owner},${operation},${conversation},'{"message":"different"}'::jsonb,'pending')`
  );
  assert.ok(
    (
      await Bun.file(path.join(plan.directory, "transcript.md")).text()
    ).includes("Run action")
  );
  const after = await session.snapshot({ signal: AbortSignal.timeout(10_000) });
  assert.ok(
    after.events.some(
      (event) =>
        event.type === "session.completed" || event.type === "session.failed"
    )
  );
  assert.deepEqual(
    after.events.slice(0, before.events.length),
    before.events,
    "Original history preserved"
  );
  await assert.rejects(
    session.respond([{ optionId: "approve", requestId: approval.requestId }], {
      signal: AbortSignal.timeout(10_000),
    })
  );
  await assert.rejects(
    session.send("Run action", { signal: AbortSignal.timeout(10_000) })
  );
  assert.equal(
    await Bun.file(path.join(runtime.directory, "effects.jsonl")).exists(),
    false
  );
  await assert.rejects(
    sql`update workflow.workflow_runs set status='running' where id=${sessionId}`
  );
  const result = {
    dry,
    effects: 0,
    eventsAfter: after.events.length,
    eventsBefore: before.events.length,
    idempotency: "partial failure after reset then two applies",
    lateApproval: "rejected",
    lateSend: "rejected",
    plan,
    resurrection: "fenced",
    sessionId,
  };
  await Bun.write(
    path.join(runtime.directory, "retirement-result.json"),
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result));
} finally {
  await runtime.crash();
  await sql.end();
}

/* oxlint-enable eslint/no-console, eslint/no-magic-numbers, eslint/no-undefined, import/no-nodejs-modules, import/no-relative-parent-imports, typescript/prefer-readonly-parameter-types, unicorn/no-await-expression-member, unicorn/no-null */
