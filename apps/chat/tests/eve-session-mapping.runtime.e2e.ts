import { setTimeout } from "node:timers/promises";

import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";
import { z } from "zod";

import { db } from "../lib/db/client";
import { createEveConversation, getEveCreation } from "../lib/db/eve-queries";
import { eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { createEveConversationOperation } from "../lib/eve/create-conversation-operation";
import type { eveRequest } from "../lib/eve/server";
import { assertEveTestDatabase } from "./eve-test-database";

vi.mock("server-only", () => ({}));
const probe = vi.hoisted(() => ({ beforeResponse: false, dispatches: 0 }));
vi.mock("../lib/eve/server", async (importOriginal) => {
  const actual = await importOriginal<{ eveRequest: typeof eveRequest }>();
  return {
    ...actual,
    eveRequest: async (
      ...args: Parameters<typeof actual.eveRequest>
    ): Promise<Response> => {
      const response = await actual.eveRequest(...args);
      if (args[1] !== "/eve/chat/v1/session") {
        return response;
      }
      probe.dispatches += 1;
      expect(response.ok).toBe(true);
      // Hold the native response inside the transport: the caller cannot bind.
      const deadline = Date.now() + 25_000;

      const session = z
        .looseObject({ sessionId: z.string() })
        .parse(await response.clone().json());
      /* oxlint-disable eslint/no-await-in-loop -- Each poll observes the worker before the next bounded delay and exits when binding completes. */
      while (Date.now() < deadline) {
        const [row] = await db
          .select()
          .from(eveConversation)

          .where(eq(eveConversation.sessionId, session.sessionId));
        if (row?.state === "bound") {
          probe.beforeResponse = true;
          break;
        }
        await setTimeout(100);
      }
      /* oxlint-enable eslint/no-await-in-loop */
      throw new TypeError("Injected lost native response after acceptance");
    },
  };
});

assertEveTestDatabase(env.DATABASE_URL);
if (!new URL(env.DATABASE_URL).pathname.includes("identity_test")) {
  throw new Error(
    "This runtime probe requires the isolated identity_test database and its matching live worker."
  );
}

test("real native hook binds before a lost response, and retry keeps the accepted session", async () => {
  const owner = crypto.randomUUID();
  await db.insert(user).values({
    email: `${owner}@test.invalid`,
    id: owner,
    name: "Runtime mapping probe",
  });
  const command = {
    message: "Reply with the word ACCEPTED.",
    modelId: "google/gemini-2.5-flash-lite",
    operationId: crypto.randomUUID(),
  };
  const response = await createEveConversationOperation(owner, command);
  expect(response.status).toBe(409);
  expect(probe.beforeResponse).toBe(true);
  const row = await getEveCreation(owner, command.operationId);
  expect(row).toMatchObject({ initialRequest: null, state: "bound" });
  expect(row?.id).not.toBe(command.operationId);
  const retry = await createEveConversationOperation(owner, command);
  expect(retry.status).toBe(200);
  expect(await retry.json()).toEqual({
    id: row?.id,
    sessionId: row?.sessionId,
  });
  expect(probe.dispatches).toBe(1);
});

test("native acceptance deduplicates concurrent callers and rejects foreign or forged identity", async () => {
  const actual = await vi.importActual<{ eveRequest: typeof eveRequest }>(
    "../lib/eve/server"
  );
  const owner = crypto.randomUUID();
  await db.insert(user).values({
    email: `${owner}@test.invalid`,
    id: owner,
    name: "Native identity probe",
  });
  const operationId = crypto.randomUUID();
  const binding = await createEveConversation(
    owner,
    operationId,
    "Reply OK.",
    async (reservationId) => {
      const init = {
        body: JSON.stringify({
          message: "Reply OK.",
          operationId: reservationId,
        }),
        method: "POST",
      };
      const foreign = await actual.eveRequest(
        "foreign",
        "/eve/chat/v1/session",
        init
      );
      expect(foreign.status).toBe(401);
      const forged = await actual.eveRequest(owner, "/eve/chat/v1/session", {
        ...init,
        body: JSON.stringify({
          forwardedPrincipal: { current: { principalId: "foreign" } },
          message: "Reply OK.",
          operationId: reservationId,
        }),
      });
      expect(forged.status).toBe(403);
      const responses = await Promise.all(
        [0, 1].map(
          async () =>
            await actual.eveRequest(
              owner,
              "/eve/chat/v1/session",
              init,
              "google/gemini-2.5-flash-lite"
            )
        )
      );
      expect(
        responses.map(
          (response: Readonly<Pick<Response, "status">>) => response.status
        )
      ).toEqual([202, 202]);
      const receipts = await Promise.all(
        responses.map(async (response: Readonly<Pick<Response, "json">>) =>
          z.object({ sessionId: z.string() }).parse(await response.json())
        )
      );

      expect(receipts[0].sessionId).toBe(receipts[1].sessionId);
      const ownReceipt = await actual.eveRequest(
        owner,
        `/eve/chat/v1/operation/${reservationId}`
      );
      expect(await ownReceipt.json()).toMatchObject({
        sessionId: receipts[0].sessionId,
      });
      const foreignReceipt = await actual.eveRequest(
        "foreign",
        `/eve/chat/v1/operation/${reservationId}`
      );
      expect(foreignReceipt.status).toBe(404);

      return receipts[0].sessionId;
    }
  );
  expect(binding.sessionId).toBeTruthy();
  expect(await getEveCreation(owner, operationId)).toMatchObject({
    state: "bound",
  });
});
