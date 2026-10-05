/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "drizzle-orm" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-queries"; "../lib/db/schema"; "../lib/env"; "../lib/eve/conversation-scope" dependency within this package instead of introducing an alias or barrel API.
 */
import { eq, inArray } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { afterAll, expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  bindAcceptedEveConversation,
  createEveConversation,
  getEveCreation,
} from "../lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { eveChat, eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { resolveEveConversationScope } from "../lib/eve/conversation-scope";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createEveConversationOperation } from "../lib/eve/create-conversation-operation";
/* oxlint-enable sort-imports */
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

const native = vi.hoisted(() => ({ positions: vi.fn(), request: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../lib/eve/server", () => ({
  assertEveConfigured: vi.fn(),
  eveRequest: native.request,
}));
vi.mock("../lib/eve/model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
}));
/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): vi.mock("../lib/eve/prepare-message") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("../lib/eve/prepare-message", () => ({
  prepareEveMessage: (message: string): Promise<string> =>
    Promise.resolve(message),
}));
/* oxlint-enable typescript/promise-function-async */

vi.mock("../lib/eve/conversation-title", () => ({
  eveConversationTitleFallback: (): string => "Recovery",
}));

/* oxlint-disable typescript/promise-function-async --
 * typescript/promise-function-async (#606): vi.mock("../lib/db/credits") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
vi.mock("../lib/db/credits", () => ({
  canSpend: (): Promise<boolean> => Promise.resolve(true),
}));
/* oxlint-enable typescript/promise-function-async */
vi.mock("@/lib/eve/lifecycle/postgres/eve-stream-positions", () => ({
  getEvePostgresStreamPositions: native.positions,
}));

assertEveTestDatabase(env.DATABASE_URL);
const owners: string[] = [];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async () => {
  await db
    .delete(eveConversation)
    .where(inArray(eveConversation.ownerId, owners));
  await db.delete(eveChat).where(inArray(eveChat.ownerId, owners));
  await db.delete(user).where(inArray(user.id, owners));
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each(["before-dispatch", "lost-response"])'s awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): test.each(["before-dispatch", "lost-response"])("a new tab recovers %s before admitti keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test.each(["before-dispatch", "lost-response"])("a new tab recovers %s before admitti keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test.each(["before-dispatch", "lost-response"])("a new tab recovers %s before admitti uses -1, 0, 1, 409, 503, 200, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test.each(["before-dispatch", "lost-response"])("a new tab recovers %s before admitti accepts init: RequestInit; sessions: string[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test.each(["before-dispatch", "lost-response"])("a new tab recovers %s before admitti preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test.each(["before-dispatch", "lost-response"])("a new tab recovers %s before admitti intentionally keeps the existing falsy-value behavior of sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): test.each(["before-dispatch", "lost-response"])("a new tab recovers %s before admitti preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
      (_owner: string, path: string, init: RequestInit) => {
        if (path.startsWith("/eve/chat/v1/operation/")) {
          const sessionId = receipts.get(path.split("/").at(-1) ?? "");
          return sessionId
            ? Response.json({ sessionId })
            : Response.json(
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
    native.positions.mockImplementation((_url: string, sessions: string[]) =>
      Promise.resolve(new Map(sessions.map((id) => [id, 0])))
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable no-magic-numbers, unicorn/no-null --
 * no-magic-numbers (#517): test("a verified native hook binds while dispatch is in flight without conflicting wi uses 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("a verified native hook binds while dispatch is in flight without conflicting wi preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, unicorn/no-null */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * no-magic-numbers (#517): test("concurrent bindings cannot claim one native session for two branches") uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("concurrent bindings cannot claim one native session for two branches") accepts row; result; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("concurrent bindings cannot claim one native session for two branches") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
    rows.map((row) => bindAcceptedEveConversation(owner, row.id, sessionId))
  );
  expect(
    outcomes.filter((result) => result.status === "fulfilled")
  ).toHaveLength(1);
  expect(outcomes.find((result) => result.status === "rejected")).toMatchObject(
    {
      reason: { code: "binding_conflict" },
      status: "rejected",
    }
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null --
 * max-lines-per-function (#510): test("mapping rejects deletion, foreign ownership and inherited subagent identity wit keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("mapping rejects deletion, foreign ownership and inherited subagent identity wit keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("mapping rejects deletion, foreign ownership and inherited subagent identity wit uses 1000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/no-null (#570): test("mapping rejects deletion, foreign ownership and inherited subagent identity wit preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, unicorn/no-null */
