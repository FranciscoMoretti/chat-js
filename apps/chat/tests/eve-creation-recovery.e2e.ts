import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, test, vi } from "vitest";
import { z } from "zod";

import { db } from "../lib/db/client";
import {
  bindAcceptedEveConversation,
  createEveConversation,
  getEveCreation,
} from "../lib/db/eve-queries";
import { eveChat, eveConversation, user } from "../lib/db/schema";
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

vi.mock("../lib/db/credits", () => ({
  canSpend: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
}));

vi.mock("@/lib/eve/lifecycle/postgres/eve-stream-positions", () => ({
  getEvePostgresStreamPositions: native.positions,
}));

assertEveTestDatabase(env.DATABASE_URL);
const owners: string[] = [];
afterAll(async () => {
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.ownerId, owners));
  await db.delete(eveChat).where(inArray(eveChat.ownerId, owners));
  await db.delete(user).where(inArray(user.id, owners));
});

test.each(["before-dispatch", "lost-response"])(
  "a new tab recovers %s before admitting another conversation",
  async (failure) => {
    const owner = crypto.randomUUID();
    owners.push(owner);
    await db
      .insert(user)
      .values({ email: `${owner}@test.invalid`, id: owner, name: "Recovery" });
    const receipts = new Map<string, string>();
    const allocations: string[] = [];
    let fail = true;
    native.request.mockImplementation(
      (_owner: string, path: string, init: Readonly<{ body?: unknown }>) => {
        if (path.startsWith("/eve/chat/v1/operation/")) {
          const sessionId = receipts.get(path.split("/").at(-1) ?? "");
          if (
            sessionId !== undefined &&
            sessionId !== null &&
            sessionId !== ""
          ) {
            return Response.json({ sessionId });
          }
          return Response.json(
            { code: "eve_operation_not_found" },
            { status: 404 }
          );
        }
        if (fail && failure === "before-dispatch") {
          throw new TypeError("connection refused");
        }
        if (typeof init.body !== "string") {
          throw new TypeError("Expected a JSON creation request body");
        }
        const command = z
          .object({ operationId: z.string() })
          .parse(JSON.parse(init.body));
        const sessionId = `wrun_${command.operationId}`;
        receipts.set(command.operationId, sessionId);
        allocations.push(command.operationId);
        if (fail) {
          throw new TypeError("reply lost");
        }
        return Response.json({ sessionId });
      }
    );
    const command = {
      message: "original message",
      modelId: "openai/gpt-4o",
      operationId: crypto.randomUUID(),
      selectedTool: "webSearch",
    } satisfies Parameters<typeof createEveConversationOperation>[1];
    const interruptedResponse = await createEveConversationOperation(
      owner,
      command
    );
    expect(interruptedResponse.status).toBe(409);
    const interrupted = await getEveCreation(owner, command.operationId);
    if (interrupted === undefined) {
      throw new Error("Missing interrupted creation");
    }
    expect(interrupted?.state).toBe("uncertain");
    expect(interrupted?.initialRequest).toEqual(command);

    if (failure === "before-dispatch") {
      const blockedCommand = { ...command, operationId: crypto.randomUUID() };
      const blocked = await createEveConversationOperation(
        owner,
        blockedCommand
      );
      expect(blocked.status).toBe(503);
      expect(await blocked.json()).toMatchObject({
        code: "creation_recovery_unavailable",
      });
      expect(
        await getEveCreation(owner, blockedCommand.operationId)
      ).toBeUndefined();
      const retained = await getEveCreation(owner, command.operationId);
      expect(retained?.initialRequest).toEqual(command);
    }
    fail = false;
    native.positions.mockResolvedValue(
      new Map([[`wrun_${interrupted.id}`, 0]])
    );
    const next = await createEveConversationOperation(owner, {
      ...command,
      message: "new tab",
      operationId: crypto.randomUUID(),
    });
    expect(next.status).toBe(200);
    const recovered = await getEveCreation(owner, command.operationId);
    expect(recovered).toMatchObject({
      id: interrupted?.id,
      initialRequest: null,
      sessionId: `wrun_${interrupted?.id}`,
      state: "bound",
    });
    expect(allocations.filter((id) => id === interrupted?.id)).toHaveLength(1);
    // The recovered session participates in usage reconciliation before admission.
    expect(native.positions).toHaveBeenLastCalledWith(expect.any(String), [
      recovered?.sessionId,
    ]);
    const retry = await createEveConversationOperation(owner, command);
    expect(await retry.json()).toEqual({
      id: recovered?.id,
      sessionId: recovered?.sessionId,
    });
    expect(allocations).toHaveLength(2);
  }
);

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
          reservationId
        )
      ).toEqual({ conversationId: reservationId, ownerId: owner });
      return nativeSession;
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
    bindAcceptedEveConversation("other", binding.id, nativeSession)
  ).rejects.toThrow("owner_mismatch");
  await expect(
    bindAcceptedEveConversation(owner, binding.id, "different-native")
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
  const outcomes = await Promise.allSettled(
    rows.map(
      async (row: Readonly<{ id: string }>) =>
        await bindAcceptedEveConversation(owner, row.id, sessionId)
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
    bindAcceptedEveConversation(owner, row.id, sessionId)
  ).rejects.toMatchObject({ code: "identity_deleted" });
  expect(await getEveCreation(owner, row.operationId)).toMatchObject({
    sessionId: null,
    state: "deleting",
  });
  await expect(
    bindAcceptedEveConversation(owner, crypto.randomUUID(), sessionId)
  ).rejects.toMatchObject({ code: "identity_missing" });
});
