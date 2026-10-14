import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// The process may connect only to the explicitly owned disposable lane.
const handoff = z
  .object({
    root: z.string(),
    port: z.number(),
    databases: z.object({ lane_d: z.url() }),
  })
  .parse(
    JSON.parse(await readFile(z.string().parse(process.argv[2]), "utf-8"))
  );
const ownership = await readFile(path.join(handoff.root, "ownership"), "utf-8");
assert.equal(ownership.trim(), "chatjs-retirement-disposable-v1");
const targetUrl = new URL(handoff.databases.lane_d);
assert.equal(targetUrl.hostname, "127.0.0.1");
assert.equal(targetUrl.username, "retirement");
assert.equal(targetUrl.pathname, "/lane_d");
assert.equal(Number(targetUrl.port), handoff.port);
process.env.DATABASE_URL = targetUrl.href;
process.env.AUTH_SECRET = "fixture-not-a-secret";
process.env.EVE_GATEWAY_SECRET =
  "fixture-secret-with-at-least-thirty-two-characters";
const { db } = await import("../../apps/chat/lib/db/client");
const { eveModelLedger, assertEveModelCostsKnown, getEveModelAccountingState } =
  await import("../../apps/chat/lib/db/eve-model-ledger");
const { prepareEveModelAccounting } =
  await import("../../apps/chat/lib/db/eve-model-cutover");
const { recordEveUsage } = await import("../../apps/chat/lib/db/eve-billing");
const { registerEveSubagent } =
  await import("../../apps/chat/lib/db/eve-subagents");
const { fenceEvePostgresSession } =
  await import("../../apps/chat/lib/eve/lifecycle/postgres/eve-session-fence");
const connection = db.$client;
const owner = crypto.randomUUID();
const chat = crypto.randomUUID();
const legacy = crypto.randomUUID();
const root = crypto.randomUUID();
const child = crypto.randomUUID();
const event = (type: string, id: string, data: unknown) => ({
  type,
  meta: { id, at: "2026-10-13T00:00:00Z" },
  data,
});
const receipt = {
  providerMetadata: { gateway: { cost: "0.004", generationId: "paid" } },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
};
const attempt = {
  eventId: `eve-model:${crypto.randomUUID()}`,
  ownerId: owner,
  sessionId: root,
  turnId: "turn_0",
  modelId: "mock",
  provider: "mock",
};
try {
  await connection`insert into "user" (id,name,email) values(${owner},'Ledger proof',${`${owner}@test.invalid`})`;
  await connection`insert into "EveChat" (id,"ownerId",title) values(${chat},${owner},'Ledger proof')`;
  await connection`insert into "UserCredit" ("userId",credits) values(${owner},100)`;
  await connection`insert into "EveConversation" ("chatId","ownerId","operationId","firstMessage","sessionId",state) values(${chat},${owner},${crypto.randomUUID()},'Archived history',${legacy},'bound')`;
  assert.equal(await getEveModelAccountingState(owner, legacy), "unprepared");
  await assert.rejects(assertEveModelCostsKnown(owner), /prepared/u);
  await connection`insert into "EveConversation" ("chatId","ownerId","operationId","firstMessage","sessionId",state,"modelAccountingState") values(${chat},${owner},${crypto.randomUUID()},'New work',${root},'bound','wrapper')`;
  await registerEveSubagent(owner, legacy, child, "turn_2");
  await connection`insert into workflow.workflow_runs(id,deployment_id,status,name) values(${legacy},'proof','completed','eve/session')`;
  await connection`insert into workflow.workflow_runs(id,deployment_id,status,name,attributes) values(${child},'proof','completed','eve/session',${JSON.stringify({ "$eve.parent": legacy })}::jsonb)`;
  const [target] =
    await connection`select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port`;
  const plan = {
    ownerId: owner,
    rootSessionId: legacy,
    target,
    sessions: [
      {
        sessionId: legacy,
        events: [
          event("step.completed", `${legacy}:paid`, {
            turnId: "turn_2",
            usage: { costUsd: 0.014 },
          }),
          event("step.failed", `${legacy}:failed`, { turnId: "turn_2" }),
          event("hook.result", `${legacy}:hook`, {
            turnId: "turn_2",
            modelCalls: [{ usage: { costUsd: 0.003 } }],
          }),
        ],
      },
      {
        sessionId: child,
        events: [
          event("compaction.usage", "summary", {
            turnId: "turn_99",
            usage: { costUsd: 0.006 },
          }),
          event("action.result", "tool-event", {
            turnId: "turn_99",
            status: "completed",
            result: {
              kind: "tool-result",
              callId: "tool-call",
              output: {
                kind: "chatjs.tool-result",
                version: 1,
                status: "success",
                output: "result",
                usage: { costUsd: 0.007 },
              },
            },
          }),
        ],
      },
    ],
  };
  const prepare = async (value: unknown) => {
    const archive = JSON.stringify(value);
    await prepareEveModelAccounting({
      archive,
      digest: createHash("sha256").update(archive).digest("hex"),
    });
  };
  await assert.rejects(
    prepareEveModelAccounting({
      archive: JSON.stringify(plan),
      digest: "wrong",
    }),
    /digest/u
  );
  await assert.rejects(prepare({ ...plan, ownerId: "foreign" }), /owned/u);
  await assert.rejects(
    prepare({ ...plan, sessions: plan.sessions.slice(0, 1) }),
    /descendants/u
  );
  await assert.rejects(
    prepare({ ...plan, target: { ...target, database: "wrong" } }),
    /target/u
  );
  await assert.rejects(prepare(plan), /retirement/u);
  await connection`insert into workflow.eve_session_retirements(session_id) values(${legacy})`;
  await assert.rejects(prepare(plan), /fence/u);
  await fenceEvePostgresSession(connection, legacy);
  // Preserve the previous failed-call classification without trusting it as price evidence.
  await recordEveUsage({
    eventId: `${legacy}:failed`,
    ownerId: owner,
    sessionId: legacy,
    turnId: "turn_2",
    costUsd: 0,
  });
  await prepare(plan);
  await prepare(plan);
  await assert.rejects(
    prepare({
      ...plan,
      sessions: plan.sessions.map((session) => ({ ...session, events: [] })),
    }),
    /archive changed/u
  );
  assert.equal(await getEveModelAccountingState(owner, legacy), "retired");
  const [historical] =
    await connection`select sum("costUsd")::text as cost, sum("chargedCents")::int as cents, count(*) filter(where "costUsd" is null)::int as unresolved from "EveUsage" where "sessionId"=${legacy}`;
  assert.equal(Number(historical.cost), 0.03);
  assert.equal(historical.cents, 3);
  assert.equal(historical.unresolved, 2);
  const [childCharge] =
    await connection`select "turnId" from "EveUsage" where "eventId"=${`eve-child:${child}:summary`}`;
  assert.equal(childCharge.turnId, "turn_2");
  await assert.rejects(assertEveModelCostsKnown(owner), /reconciliation/u);
  await eveModelLedger.begin(attempt);
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      await eveModelLedger.finish(attempt, receipt);
    })
  );
  await eveModelLedger.begin(attempt);
  const [settled] =
    await connection`select "modelAttempt"->>'state' as state, "chargedCents" from "EveUsage" where "eventId"=${attempt.eventId}`;
  assert.equal(settled.state, "returned");
  assert.equal(settled.chargedCents, 1);
  await assert.rejects(
    eveModelLedger.finish(attempt, {
      ...receipt,
      providerMetadata: { gateway: { cost: "0.9" } },
    }),
    /amount changed/u
  );
  await assert.rejects(
    eveModelLedger.finish(attempt, {
      ...receipt,
      providerMetadata: { gateway: { cost: "0.004", generationId: "other" } },
    }),
    /generation identity/u
  );
  const pending = { ...attempt, eventId: `eve-model:${crypto.randomUUID()}` };
  await eveModelLedger.begin(pending);
  await eveModelLedger.observe?.(pending, {
    id: "early-response",
    modelId: "mock",
  });
  await connection`create or replace function public.ledger_test_failure() returns trigger language plpgsql as $$ begin raise exception 'fixture debit failure'; end $$`;
  await connection`create trigger ledger_test_failure before update on "UserCredit" for each row execute function public.ledger_test_failure()`;
  await assert.rejects(
    eveModelLedger.finish(pending, {
      ...receipt,
      providerMetadata: {
        gateway: { cost: "0.024", generationId: "rollback" },
      },
    }),
    /Failed query/u
  );
  await connection`drop trigger ledger_test_failure on "UserCredit"`;
  await connection`drop function public.ledger_test_failure()`;
  const [rolledBack] =
    await connection`select "costUsd", "modelAttempt"->>'state' as state, "modelAttempt"->'response'->>'id' as response from "EveUsage" where "eventId"=${pending.eventId}`;
  assert.equal(rolledBack.costUsd, null);
  assert.equal(rolledBack.state, "pending");
  assert.equal(rolledBack.response, "early-response");
  await connection`update "EveConversation" set state='deleted' where "sessionId"=${root}`;
  await eveModelLedger.finish(pending, receipt);
  await assert.rejects(
    eveModelLedger.begin({ ...pending, eventId: "forbidden-after-delete" }),
    /owned/u
  );
  const [credit] =
    await connection`select credits from "UserCredit" where "userId"=${owner}`;
  assert.equal(credit.credits, 96);
  console.log(
    JSON.stringify(
      {
        status: "passed",
        owner,
        legacy,
        root,
        assertions:
          "target/owner/archive/descendant/fences; legacy idempotency and unknown liabilities; eight concurrent receipts; immutable identity; pending-to-returned monotonicity; receipt after tombstone; decimal debit",
        historical,
        credit,
      },
      null,
      2
    )
  );
} finally {
  await connection.end();
}
