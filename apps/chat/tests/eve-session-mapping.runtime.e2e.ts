/* oxlint-disable import/no-namespace, import/no-nodejs-modules, import/no-relative-parent-imports  --
 * import/no-namespace (#528): The EveServer namespace is the consumed SDK/module interface; renaming all member references requires changing that import contract.
 * import/no-nodejs-modules (#529): This test harness requires import { setTimeout } from "node:timers/promises";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-queries"; "../lib/db/schema"; "../lib/env"; "../lib/eve/create-conversation-operation" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { setTimeout } from "node:timers/promises";

import { eq } from "drizzle-orm";
import { expect, test, vi } from "vitest";

import { db } from "../lib/db/client";
import { createEveConversation, getEveCreation } from "../lib/db/eve-queries";
import { eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { createEveConversationOperation } from "../lib/eve/create-conversation-operation";
import type * as EveServer from "../lib/eve/server";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-namespace, import/no-nodejs-modules, import/no-relative-parent-imports */

vi.mock("server-only", () => ({}));
const probe = vi.hoisted(() => ({ beforeResponse: false, dispatches: 0 }));
/* oxlint-disable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types  --
 * max-statements (#512): vi.mock("../lib/eve/server") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): vi.mock("../lib/eve/server") uses 1, 25_000, 100 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): vi.mock("../lib/eve/server") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): vi.mock("../lib/eve/server") handles optional row?.state without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): vi.mock("../lib/eve/server") copies or separates ...actual while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("../lib/eve/server") accepts ...args: Parameters<typeof actual.eveRequest>; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
vi.mock("../lib/eve/server", async (importOriginal) => {
  const actual = await importOriginal<typeof EveServer>();
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
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect raw native creation receipts to verify session identity and cross-owner replay isolation without normalizing the transport payload.
      const session = await response.clone().json();
      while (Date.now() < deadline) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Observe the independent real worker while the HTTP caller is held.
        const [row] = await db
          .select()
          .from(eveConversation)
          // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- Inspect raw native creation receipts to verify session identity and cross-owner replay isolation without normalizing the transport payload.
          .where(eq(eveConversation.sessionId, session.sessionId));
        if (row?.state === "bound") {
          probe.beforeResponse = true;
          break;
        }
        // oxlint-disable-next-line eslint/no-await-in-loop -- Bound polling while the worker executes its hook.
        await setTimeout(100);
      }
      throw new TypeError("Injected lost native response after acceptance");
    },
  };
});
/* oxlint-enable max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types */

assertEveTestDatabase(env.DATABASE_URL);
if (!new URL(env.DATABASE_URL).pathname.includes("identity_test")) {
  throw new Error(
    "This runtime probe requires the isolated identity_test database and its matching live worker."
  );
}

/* oxlint-disable max-statements, no-magic-numbers, unicorn/no-null  --
 * max-statements (#512): test("real native hook binds before a lost response, and retry keeps the accepted ses keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("real native hook binds before a lost response, and retry keeps the accepted ses uses 409, 200, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("real native hook binds before a lost response, and retry keeps the accepted ses sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("real native hook binds before a lost response, and retry keeps the accepted ses handles optional row?.id; row?.sessionId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * unicorn/no-null (#570): test("real native hook binds before a lost response, and retry keeps the accepted ses preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable max-statements, no-magic-numbers, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async  --
 * max-lines-per-function (#510): test("native acceptance deduplicates concurrent callers and rejects foreign or forged keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native acceptance deduplicates concurrent callers and rejects foreign or forged keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native acceptance deduplicates concurrent callers and rejects foreign or forged uses 401, 403, 0, 1, 202, 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("native acceptance deduplicates concurrent callers and rejects foreign or forged sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): test("native acceptance deduplicates concurrent callers and rejects foreign or forged copies or separates ...init while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): test("native acceptance deduplicates concurrent callers and rejects foreign or forged accepts response; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native acceptance deduplicates concurrent callers and rejects foreign or forged preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("native acceptance deduplicates concurrent callers and rejects foreign or forged identity", async () => {
  const actual = await vi.importActual<typeof EveServer>("../lib/eve/server");
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
        [0, 1].map(() =>
          actual.eveRequest(
            owner,
            "/eve/chat/v1/session",
            init,
            "google/gemini-2.5-flash-lite"
          )
        )
      );
      expect(responses.map((response) => response.status)).toEqual([202, 202]);
      const receipts = await Promise.all(
        responses.map((response) => response.json())
      );
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect raw native creation receipts to verify session identity and cross-owner replay isolation without normalizing the transport payload.
      expect(receipts[0].sessionId).toBe(receipts[1].sessionId);
      const ownReceipt = await actual.eveRequest(
        owner,
        `/eve/chat/v1/operation/${reservationId}`
      );
      expect(await ownReceipt.json()).toMatchObject({
        // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access -- Inspect raw native creation receipts to verify session identity and cross-owner replay isolation without normalizing the transport payload.
        sessionId: receipts[0].sessionId,
      });
      const foreignReceipt = await actual.eveRequest(
        "foreign",
        `/eve/chat/v1/operation/${reservationId}`
      );
      expect(foreignReceipt.status).toBe(404);
      // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-return -- Inspect raw native creation receipts to verify session identity and cross-owner replay isolation without normalizing the transport payload.
      return receipts[0].sessionId;
    }
  );
  expect(binding.sessionId).toBeTruthy();
  expect(await getEveCreation(owner, operationId)).toMatchObject({
    state: "bound",
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
