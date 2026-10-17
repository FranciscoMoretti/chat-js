import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { z } from "zod";

const postgres = new PGlite();
vi.mock("server-only", () => ({}));
vi.mock("./client", () => {
  const database = drizzle(postgres);
  const transaction = database.transaction.bind(database);
  type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];
  // Production postgres-js execute returns rows directly; PGlite wraps them.
  database.transaction = async <Result>(
    runTransaction: (tx: Transaction) => Promise<Result>
  ): Promise<Result> =>
    await transaction(async (tx): Promise<Result> => {
      const execute = tx.execute.bind(tx);
      const adapted = new Proxy(tx, {
        get(target, property, receiver): unknown {
          if (property === "execute") {
            return async (
              ...args: Parameters<typeof execute>
            ): Promise<Record<string, unknown>[]> => {
              const response = await execute(...args);
              return response.rows;
            };
          }
          return Reflect.get(target, property, receiver);
        },
      });
      return await runTransaction(adapted);
    });
  return { db: database };
});
vi.mock("../env", () => ({ env: {} }));
const {
  dispatchEveOnce,
  EveDispatchUnknownError,
  getEveSendReceipt,
  getEveMessageDisplayReceipts,
} = await import("./eve-dispatch");
const conversationId = "00000000-0000-4000-8000-000000000001";
const input = {
  ownerId: "owner",
  conversationId,
  kind: "send",
  intent: { sessionId: "source", message: "same message", modelId: "model" },
} satisfies Omit<Parameters<typeof dispatchEveOnce>[0], "operationId">;
beforeAll(async () => {
  const journal = z
    .object({ entries: z.array(z.object({ tag: z.string() })) })
    .parse(
      JSON.parse(
        await readFile(
          new URL("migrations/meta/_journal.json", import.meta.url),
          "utf-8"
        )
      )
    );
  /* oxlint-disable no-await-in-loop -- Apply schema migrations in dependency order. */
  for (const entry of journal.entries) {
    await postgres.exec(
      await readFile(
        new URL(`migrations/${entry.tag}.sql`, import.meta.url),
        "utf-8"
      )
    );
  }
  /* oxlint-enable no-await-in-loop */
  await postgres.exec(`INSERT INTO "user" (id,name,email) VALUES ('owner','owner','owner'), ('foreign','foreign','foreign');
    INSERT INTO "EveChat" (id,"ownerId",title) VALUES ('${conversationId}','owner','Test');
    INSERT INTO "EveConversation" (id,"chatId","ownerId","operationId","firstMessage","sessionId",state)
    VALUES ('${conversationId}','${conversationId}','owner','${conversationId}','Test','source','bound');`);
}, 30_000);
afterAll(async () => {
  await postgres.close();
});

it("keeps a lost response unknown across later attempts without dispatching again", async () => {
  const operation = {
    ...input,
    operationId: "00000000-0000-4000-8000-000000000002",
  };
  const first = vi
    .fn()
    .mockRejectedValue(new Error("response lost after native acceptance"));
  await expect(dispatchEveOnce(operation, first)).rejects.toThrow(
    "response lost"
  );
  const retry = vi.fn().mockResolvedValue({
    sessionId: "source",
    deliveryId: "duplicate",
  });
  await expect(dispatchEveOnce(operation, retry)).rejects.toBeInstanceOf(
    EveDispatchUnknownError
  );
  expect(first).toHaveBeenCalledTimes(1);
  expect(retry).not.toHaveBeenCalled();
});
it("binds successful responses exactly, rejects changed intent, and isolates ownership", async () => {
  const operation = {
    ...input,
    operationId: "00000000-0000-4000-8000-000000000003",
  };
  const dispatch = vi.fn().mockResolvedValue({
    sessionId: "source",
    deliveryId: "accepted-delivery",
  });
  expect(await dispatchEveOnce(operation, dispatch)).toEqual({
    sessionId: "source",
    deliveryId: "accepted-delivery",
  });
  expect(await dispatchEveOnce(operation, dispatch)).toEqual({
    sessionId: "source",
    deliveryId: "accepted-delivery",
  });
  await expect(
    dispatchEveOnce(
      { ...operation, intent: { ...input.intent, message: "changed" } },
      dispatch
    )
  ).rejects.toThrow("different intent");
  await expect(
    dispatchEveOnce({ ...operation, ownerId: "foreign" }, dispatch)
  ).rejects.toThrow("Conversation not found");
  expect(dispatch).toHaveBeenCalledTimes(1);
});
it("fences a concurrent request while the first dispatch is still pending", async () => {
  const operation = {
    ...input,
    operationId: "00000000-0000-4000-8000-000000000004",
  };
  const started = Promise.withResolvers<boolean>();
  const response = Promise.withResolvers<{
    sessionId: string;
    deliveryId: string;
  }>();
  const first = dispatchEveOnce(operation, async () => {
    started.resolve(true);
    return await response.promise;
  });
  await started.promise;
  const duplicate = vi.fn().mockResolvedValue({
    sessionId: "source",
    deliveryId: "wrong",
  });
  await expect(dispatchEveOnce(operation, duplicate)).rejects.toBeInstanceOf(
    EveDispatchUnknownError
  );
  response.resolve({ sessionId: "source", deliveryId: "first" });
  expect(await first).toEqual({ sessionId: "source", deliveryId: "first" });
  expect(duplicate).not.toHaveBeenCalled();
});

it("keeps the creation fence committed when its binding transaction rolls back", async () => {
  const { createEveConversation } = await import("./eve-queries");
  const operationId = "00000000-0000-4000-8000-000000000005";
  const dispatch = vi.fn().mockRejectedValue(new Error("lost create response"));
  await expect(
    createEveConversation(
      "owner",
      operationId,
      "Alice starts a note.",
      dispatch
    )
  ).rejects.toThrow("lost create response");
  await expect(
    createEveConversation(
      "owner",
      operationId,
      "Alice starts a note.",
      dispatch
    )
  ).rejects.toBeInstanceOf(EveDispatchUnknownError);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

it("exposes only a known send receipt for the exact owner and session", async () => {
  const operationId = "00000000-0000-4000-8000-000000000061";
  const dispatch = vi
    .fn()
    .mockResolvedValue({ sessionId: "source", deliveryId: "receipt-delivery" });
  expect(await getEveSendReceipt("owner", "source", operationId)).toBeNull();
  await dispatchEveOnce(
    {
      ...input,
      operationId,
      intent: { ...input.intent, selectedTool: "webSearch" },
    },
    dispatch
  );
  expect(await getEveSendReceipt("owner", "source", operationId)).toEqual({
    sessionId: "source",
    deliveryId: "receipt-delivery",
    operationId,
  });
  expect(await getEveSendReceipt("foreign", "source", operationId)).toBeNull();
  expect(
    await getEveSendReceipt("owner", "foreign-session", operationId)
  ).toBeNull();
  expect(dispatch).toHaveBeenCalledTimes(1);
  const unknownId = "00000000-0000-4000-8000-000000000062";
  await expect(
    dispatchEveOnce(
      { ...input, operationId: unknownId },
      async () => await Promise.reject(new Error("Lost response"))
    )
  ).rejects.toThrow("Lost response");
  expect(await getEveSendReceipt("owner", "source", unknownId)).toBeNull();
  expect(await getEveMessageDisplayReceipts("owner", "source")).toEqual([
    { deliveryId: "receipt-delivery", selectedTool: "webSearch" },
  ]);
  expect(await getEveMessageDisplayReceipts("foreign", "source")).toEqual([]);
  expect(await getEveMessageDisplayReceipts("owner", "other-session")).toEqual(
    []
  );
});
