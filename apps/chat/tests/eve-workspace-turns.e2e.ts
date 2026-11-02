import type * as EveClient from "eve/client";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import type { WorkspaceTurnEvent } from "../lib/eve/workspace-turn-evidence";
import { assertEveTestDatabase } from "./eve-test-database";

const databaseUrl =
  process.env.WORKSPACE_GATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error(
    "WORKSPACE_GATE_DATABASE_URL must identify a disposable local test database."
  );
}
assertEveTestDatabase(databaseUrl);
const schema = `workspace_gate_${randomUUID().replaceAll("-", "")}`;
const admin = postgres(databaseUrl, { max: 1 });
const client = postgres(databaseUrl, {
  max: 8,
  connection: { search_path: schema },
});
const snapshots = new Map<string, readonly WorkspaceTurnEvent[]>();
vi.mock("../lib/env", () => ({ env: {} }));
vi.mock("../lib/db/client", () => ({ db: drizzle(client) }));
vi.mock("../lib/eve/connection-options", () => ({
  getEveConnectionOptions: () => ({ host: "http://native.invalid" }),
}));
vi.mock("eve/client", async (original) => ({
  ...(await original<typeof EveClient>()),
  Client: class {
    public sessions = {
      attach: (sessionId: string) => ({
        snapshot: () => {
          const events = snapshots.get(sessionId);
          if (!events) {
            throw new Error("Native evidence unavailable");
          }
          return { events };
        },
      }),
    };
  },
}));
const { dispatchEveOnce, EveDispatchUnknownError } =
  await import("../lib/db/eve-dispatch");
const { EveWorkspaceBusyError, releaseSettledEveWorkspaceOperation } =
  await import("../lib/db/eve-workspace-turns");
const { reconcileEveWorkspaceTurn } =
  await import("../lib/eve/reconcile-workspace-turn");
const workspaceId = randomUUID();
const firstConversation = randomUUID();
const secondConversation = randomUUID();
const operation = (conversationId = firstConversation) => ({
  ownerId: "owner",
  conversationId,
  operationId: randomUUID(),
  kind: "send" as const,
  intent: { message: "Preserve this intent", modelId: "model" },
});
const meta = (line: number) => ({
  at: "2026-11-02T00:00:00Z",
  position: { line, index: 0 },
  endOfLine: true,
});
const session: WorkspaceTurnEvent = {
  type: "session.started",
  meta: meta(0),
  data: {},
};
const active = (deliveryId: string): WorkspaceTurnEvent[] => [
  session,
  { type: "delivery.admitted", meta: meta(1), data: { deliveryId } },
  {
    type: "turn.started",
    meta: meta(2),
    data: { turnId: "turn", follows: null, cause: { deliveryId } },
  },
  {
    type: "delivery.consumed",
    meta: meta(3),
    data: {
      turnId: "turn",
      deliveryId,
      parts: [{ kind: "text", text: "Question" }],
    },
  },
];
const settled = (deliveryId: string): WorkspaceTurnEvent[] => [
  ...active(deliveryId),
  {
    type: "delivery.settled",
    meta: meta(4),
    data: { deliveryId, turnId: "turn", outcome: "handled" },
  },
  {
    type: "turn.settled",
    meta: meta(5),
    data: { turnId: "turn", outcome: "completed" },
  },
];

beforeAll(async () => {
  await admin`create schema ${admin(schema)}`;
  // Test only the three production tables this seam uses. Constraints and journal
  // fields match schema.ts; no application migration or shared test data is touched.
  await client`create table "EveWorkspace" (id uuid primary key,"ownerId" text not null,state text not null default 'active',"activeOperationId" uuid,unique(id,"ownerId"))`;
  await client`create table "EveConversation" (id uuid primary key,"ownerId" text not null,"workspaceId" uuid not null,state text not null default 'bound',"sessionId" text,unique(id,"ownerId"),foreign key("workspaceId","ownerId") references "EveWorkspace"(id,"ownerId"))`;
  await client`create table "EveDispatch" ("ownerId" text not null,"operationId" uuid not null,"conversationId" uuid not null,kind text not null check(kind in ('create','copy','send')),intent jsonb not null,"sessionId" text,"deliveryId" text,"createdAt" timestamp not null default now(),primary key("ownerId","operationId"),foreign key("conversationId","ownerId") references "EveConversation"(id,"ownerId"),check("deliveryId" is null or "sessionId" is not null))`;
  await client`insert into "EveWorkspace" (id,"ownerId") values (${workspaceId},'owner')`;
  await client`insert into "EveConversation" (id,"ownerId","workspaceId") values (${firstConversation},'owner',${workspaceId}),(${secondConversation},'owner',${workspaceId})`;
});
beforeEach(async () => {
  snapshots.clear();
  await client`update "EveWorkspace" set "activeOperationId"=null`;
  await client`delete from "EveDispatch"`;
});
afterAll(async () => {
  await client.end();
  await admin`drop schema ${admin(schema)} cascade`;
  await admin.end();
});

test("competing conversations dispatch once and preserve an unknown operation", async () => {
  const inputs = [operation(), operation(secondConversation)];
  const dispatch = vi.fn(
    async () => await Promise.reject(new Error("Reply lost after acceptance"))
  );
  const results = await Promise.allSettled(
    inputs.map(async (input) => await dispatchEveOnce(input, dispatch))
  );
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(results.every((result) => result.status === "rejected")).toBe(true);
  const [entry] = await client<
    { operationId: string }[]
  >`select "operationId" from "EveDispatch"`;
  const winner = inputs.find(
    (input) => input.operationId === entry.operationId
  );
  if (!winner) {
    throw new Error("Expected the admitted operation");
  }
  await expect(dispatchEveOnce(winner, dispatch)).rejects.toBeInstanceOf(
    EveDispatchUnknownError
  );
  await expect(
    dispatchEveOnce(
      { ...winner, intent: { ...winner.intent, message: "changed" } },
      dispatch
    )
  ).rejects.toThrow("different intent");
  await reconcileEveWorkspaceTurn("owner", secondConversation);
  await expect(
    dispatchEveOnce(operation(secondConversation), dispatch)
  ).rejects.toBeInstanceOf(EveWorkspaceBusyError);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test("known replay and cancellation acknowledgement preserve the gate until exact terminal proof", async () => {
  const input = operation();
  const binding = { sessionId: "native", deliveryId: "exact" };
  const dispatch = vi.fn(async () => await Promise.resolve(binding));
  await dispatchEveOnce(input, dispatch);
  expect(await dispatchEveOnce(input, dispatch)).toEqual(binding);
  expect(dispatch).toHaveBeenCalledTimes(1);
  // A cancel command receipt is not terminal stream evidence.
  snapshots.set("native", active("exact"));
  await expect(
    dispatchEveOnce(operation(secondConversation), dispatch)
  ).rejects.toBeInstanceOf(EveWorkspaceBusyError);
  snapshots.set("native", settled("another-delivery"));
  await expect(
    dispatchEveOnce(operation(secondConversation), dispatch)
  ).rejects.toBeInstanceOf(EveWorkspaceBusyError);
  snapshots.set("native", settled("exact"));
  const next = operation(secondConversation);
  await dispatchEveOnce(
    next,
    async () =>
      await Promise.resolve({ sessionId: "native-next", deliveryId: "next" })
  );
  await releaseSettledEveWorkspaceOperation(
    "owner",
    workspaceId,
    input.operationId
  );
  const [workspace] = await client<
    { activeOperationId: string }[]
  >`select "activeOperationId" from "EveWorkspace"`;
  expect(workspace.activeOperationId).toBe(next.operationId);
  await expect(dispatchEveOnce(operation(), dispatch)).rejects.toBeInstanceOf(
    EveWorkspaceBusyError
  );
});

test("root terminal waits for its native child subtree and permits a new conversation only after it stops", async () => {
  await dispatchEveOnce(
    operation(),
    async () =>
      await Promise.resolve({ sessionId: "root", deliveryId: "exact" })
  );
  snapshots.set("root", [
    ...settled("exact"),
    {
      type: "child.opened",
      meta: meta(6),
      data: {
        sessionId: "child",
        owner: { callId: "child-call" },
        name: "worker",
        stream: "/eve/v1/session/child/stream",
      },
    },
  ]);
  snapshots.set("child", active("child-delivery"));
  const dispatch = vi.fn(
    async () => await Promise.resolve({ sessionId: "other", deliveryId: "new" })
  );
  await expect(
    dispatchEveOnce(operation(secondConversation), dispatch)
  ).rejects.toBeInstanceOf(EveWorkspaceBusyError);
  expect(dispatch).not.toHaveBeenCalled();
  snapshots.set("child", [
    session,
    { type: "session.ended", meta: meta(7), data: { outcome: "completed" } },
  ]);
  await dispatchEveOnce(operation(secondConversation), dispatch);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test("membership is required even when the caller knows the conversation and workspace identifiers", async () => {
  const dispatch = vi.fn();
  await expect(
    dispatchEveOnce({ ...operation(), ownerId: "foreign" }, dispatch)
  ).rejects.toThrow("Conversation not found");
  expect(dispatch).not.toHaveBeenCalled();
});

test("seed-only copies hold the workspace until native seed idle and cannot unlock a subsequent send", async () => {
  const seed = {
    ...operation(),
    kind: "copy" as const,
    intent: { fork: { source: "original" } },
  };
  const create = vi.fn(
    async () => await Promise.resolve({ sessionId: "seeded" })
  );
  await dispatchEveOnce(seed, create);
  snapshots.set("seeded", []);
  const send = operation();
  const deliver = vi.fn(
    async () =>
      await Promise.resolve({ sessionId: "seeded", deliveryId: "followup" })
  );
  await expect(dispatchEveOnce(send, deliver)).rejects.toBeInstanceOf(
    EveWorkspaceBusyError
  );
  snapshots.set("seeded", [session]);
  await dispatchEveOnce(send, deliver);
  expect(deliver).toHaveBeenCalledTimes(1);
  await dispatchEveOnce(seed, create);
  expect(create).toHaveBeenCalledTimes(1);
  await reconcileEveWorkspaceTurn("owner", firstConversation);
  await expect(
    dispatchEveOnce(operation(secondConversation), deliver)
  ).rejects.toBeInstanceOf(EveWorkspaceBusyError);
  snapshots.set("seeded", [session, ...settled("followup")]);
  await dispatchEveOnce(operation(secondConversation), deliver);
  expect(deliver).toHaveBeenCalledTimes(2);
});

test("a known fork seed waits for asynchronous idle publication before its first send", async () => {
  const seed = {
    ...operation(),
    kind: "create" as const,
    intent: { fork: { conversationId: secondConversation } },
  };
  await dispatchEveOnce(
    seed,
    async () => await Promise.resolve({ sessionId: "delayed-seed" })
  );
  snapshots.set("delayed-seed", []);
  const ready = setTimeout(() => {
    snapshots.set("delayed-seed", [session]);
  }, 25);
  try {
    await reconcileEveWorkspaceTurn("owner", firstConversation, {
      waitForSeed: true,
    });
    const dispatch = vi.fn(
      async () =>
        await Promise.resolve({
          sessionId: "delayed-seed",
          deliveryId: "first-send",
        })
    );
    await dispatchEveOnce(operation(), dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
  } finally {
    clearTimeout(ready);
  }
});
