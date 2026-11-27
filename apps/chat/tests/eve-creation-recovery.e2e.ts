import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { z } from "zod";

import { db } from "../lib/db/client";
import {
  bindAcceptedEveCreation,
  createEveConversation,
  getEveCreation,
} from "../lib/db/eve-queries";
import { eveChat, eveDispatch, eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { resolveEveConversationScope } from "../lib/eve/conversation-scope";
import { createEveConversationOperation } from "../lib/eve/create-conversation-operation";
import type { getEvePostgresStreamPositions } from "../lib/eve/lifecycle/postgres/eve-stream-positions";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
import { assertEveTestDatabase } from "./eve-test-database";

const native = vi.hoisted(() => ({
  positions: vi.fn<typeof getEvePostgresStreamPositions>(),
  request: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("../lib/eve/server", () => ({
  assertEveConfigured: vi.fn(),
  eveRequest: native.request,
}));
vi.mock("../lib/eve/model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
}));

vi.mock("../lib/eve/conversation-title", () => ({
  eveConversationTitleFallback: (): string => "Recovery",
}));

vi.mock("../integrations/billing", () => ({
  billing: {
    canSpend: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
    debit: undefined,
  },
}));

vi.mock("@/lib/eve/lifecycle/postgres/eve-stream-positions", () => ({
  getEvePostgresStreamPositions: native.positions,
}));

assertEveTestDatabase(env.DATABASE_URL);
const owners: string[] = [];
afterAll(async () => {
  await db.delete(eveDispatch).where(inArray(eveDispatch.ownerId, owners));
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.ownerId, owners));
  await db.delete(eveChat).where(inArray(eveChat.ownerId, owners));
  await db.delete(user).where(inArray(user.id, owners));
});

test("a verified native hook binds while dispatch is in flight without conflicting with the HTTP response", async () => {
  const owner = crypto.randomUUID();
  owners.push(owner);
  await db.insert(user).values({
    email: `${owner}@test.invalid`,
    id: owner,
    name: "Binding race",
  });
  const nativeSession = `wrun_${crypto.randomUUID()}`;
  const operationId = crypto.randomUUID();
  const binding = await createEveConversation(
    owner,
    operationId,
    "race",
    async (reservationId) => {
      native.request.mockResolvedValue(
        Response.json({ sessionId: nativeSession })
      );
      expect(
        await resolveEveConversationScope(
          owner,
          nativeSession,
          AbortSignal.timeout(1000),
          reservationId,
          "delivery"
        )
      ).toEqual({ branchId: reservationId, ownerId: owner });
      return { sessionId: nativeSession, deliveryId: "delivery" };
    },
    { initialRequest: { message: "race", operationId } }
  );
  const row = await getEveCreation(owner, operationId);
  expect(row).toMatchObject({
    id: binding.id,
    initialRequest: null,
    sessionId: nativeSession,
    state: "bound",
  });
  await expect(
    bindAcceptedEveCreation("other", binding.id, nativeSession, "delivery")
  ).rejects.toThrow("owner_mismatch");
  await expect(
    bindAcceptedEveCreation(owner, binding.id, "different-native", "delivery")
  ).rejects.toThrow("binding_conflict");
});

test("concurrent bindings cannot claim one native session for two branches", async () => {
  const owner = crypto.randomUUID();
  owners.push(owner);
  await db
    .insert(user)
    .values({ email: `${owner}@test.invalid`, id: owner, name: "Mapping" });
  const rows = await insertEveConversationFixtures(
    [0, 1].map(() => ({
      firstMessage: "mapping",
      operationId: crypto.randomUUID(),
      ownerId: owner,
    }))
  );
  const sessionId = `wrun_${crypto.randomUUID()}`;
  await db.insert(eveDispatch).values(
    rows.map(({ id }): typeof eveDispatch.$inferInsert => ({
      branchId: id,
      operationId: id,
      ownerId: owner,
      kind: "create",
      intent: {},
    }))
  );
  const outcomes = await Promise.allSettled(
    rows.map(
      async (row: Readonly<{ id: string }>) =>
        await bindAcceptedEveCreation(owner, row.id, sessionId, "delivery")
    )
  );
  expect(
    outcomes.filter(
      (result: Readonly<{ status: "fulfilled" | "rejected" }>) =>
        result.status === "fulfilled"
    )
  ).toHaveLength(1);
  expect(
    outcomes.find(
      (result: Readonly<{ status: "fulfilled" | "rejected" }>) =>
        result.status === "rejected"
    )
  ).toMatchObject({
    reason: { code: "binding_conflict" },
    status: "rejected",
  });
});

test("mapping rejects deletion, foreign ownership and inherited subagent identity without rebinding", async () => {
  const owner = crypto.randomUUID();
  owners.push(owner);
  await db
    .insert(user)
    .values({ email: `${owner}@test.invalid`, id: owner, name: "Mapping" });
  const [row] = await insertEveConversationFixtures({
    firstMessage: "mapping",
    operationId: crypto.randomUUID(),
    ownerId: owner,
  });
  const sessionId = `wrun_${crypto.randomUUID()}`;
  native.request.mockResolvedValue(Response.json({ sessionId }));
  await expect(
    resolveEveConversationScope(
      "foreign",
      sessionId,
      AbortSignal.timeout(1000),
      row.id
    )
  ).rejects.toMatchObject({ code: "owner_mismatch" });
  await expect(
    resolveEveConversationScope(
      owner,
      "child",
      AbortSignal.timeout(1000),
      row.id
    )
  ).rejects.toMatchObject({ code: "identity_pending" });
  await expect(
    bindAcceptedEveCreation(owner, row.id, sessionId, "unclaimed-delivery")
  ).rejects.toMatchObject({ code: "binding_conflict" });
  await db
    .update(eveConversation)
    .set({ state: "deleting" })
    .where(eq(eveConversation.id, row.id));
  await expect(
    resolveEveConversationScope(
      owner,
      sessionId,
      AbortSignal.timeout(1000),
      row.id
    )
  ).rejects.toMatchObject({ code: "identity_deleted" });
  await expect(
    bindAcceptedEveCreation(owner, row.id, sessionId, "delivery")
  ).rejects.toMatchObject({ code: "identity_deleted" });
  expect(await getEveCreation(owner, row.operationId)).toMatchObject({
    sessionId: null,
    state: "deleting",
  });
  await expect(
    bindAcceptedEveCreation(owner, crypto.randomUUID(), sessionId, "delivery")
  ).rejects.toMatchObject({ code: "identity_missing" });
});

test.each(["refused", "accepted-reply-lost"])(
  "journal probe for %s",
  async (mode) => {
    const owner = crypto.randomUUID();
    owners.push(owner);
    await db.insert(user).values({
      email: `${owner}@test.invalid`,
      id: owner,
      name: "Journal probe",
    });
    const accepted = new Set<string>();
    native.request.mockReset();
    native.request.mockImplementation(
      (_owner: string, path: string, init: { readonly body: string }) => {
        expect(path).toBe("/eve/chat/v1/session");
        if (mode === "accepted-reply-lost") {
          accepted.add(
            z.object({ operationId: z.string() }).parse(JSON.parse(init.body))
              .operationId
          );
        }
        throw new TypeError(mode);
      }
    );
    const command = {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-4o",
      message: "journal probe",
    };
    const initial = await createEveConversationOperation(owner, command);
    expect(initial.status).toBe(409);
    const retry = await createEveConversationOperation(owner, command);
    expect(retry.status).toBe(409);
    const newCommand = { ...command, operationId: crypto.randomUUID() };
    const blocked = await createEveConversationOperation(owner, newCommand);
    expect(blocked.status).toBe(503);
    expect(await blocked.json()).toMatchObject({
      code: "creation_recovery_unavailable",
    });
    expect(native.request).toHaveBeenCalledTimes(1);
    const rows = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.ownerId, owner));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      operationId: command.operationId,
      sessionId: null,
      state: "uncertain",
    });
    const journal = await db
      .select()
      .from(eveDispatch)
      .where(eq(eveDispatch.ownerId, owner));
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({
      branchId: rows[0].id,
      sessionId: null,
      operationId: rows[0].id,
    });
    expect([...accepted]).toEqual(
      mode === "accepted-reply-lost" ? [rows[0].id] : []
    );
  }
);

test("a verified hook atomically repairs creation and dispatch after a lost response", async () => {
  const owner = crypto.randomUUID();
  owners.push(owner);
  await db.insert(user).values({
    email: `${owner}@test.invalid`,
    id: owner,
    name: "Hook receipt probe",
  });
  const sessionId = `wrun_${crypto.randomUUID()}`;
  native.request.mockReset();
  native.request.mockImplementation(
    async (_owner: string, path: string, init: { readonly body: string }) => {
      expect(path).toBe("/eve/chat/v1/session");
      const { operationId } = z
        .object({ operationId: z.string() })
        .parse(JSON.parse(init.body));
      await resolveEveConversationScope(
        owner,
        sessionId,
        AbortSignal.timeout(1000),
        operationId,
        "delivery"
      );
      throw new Error("lost POST response");
    }
  );
  const command = {
    operationId: crypto.randomUUID(),
    modelId: "openai/gpt-4o",
    message: "hook receipt",
  };
  const interrupted = await createEveConversationOperation(owner, command);
  expect(interrupted.status).toBe(409);
  expect(await getEveCreation(owner, command.operationId)).toMatchObject({
    state: "bound",
    sessionId,
  });
  const [dispatch] = await db
    .select()
    .from(eveDispatch)
    .where(eq(eveDispatch.ownerId, owner));
  expect(dispatch).toMatchObject({ sessionId, deliveryId: "delivery" });
  const retry = await createEveConversationOperation(owner, command);
  expect(retry.status).toBe(200);
  expect(native.request).toHaveBeenCalledTimes(1);
  native.positions.mockResolvedValue(new Map([[sessionId, 0]]));
  native.request.mockResolvedValueOnce(
    Response.json({
      deliveryId: "next-delivery",
      sessionId: `wrun_${crypto.randomUUID()}`,
    })
  );
  const next = await createEveConversationOperation(owner, {
    ...command,
    operationId: crypto.randomUUID(),
  });
  expect(next.status).toBe(200);
  expect(native.request).toHaveBeenCalledTimes(2);
});
