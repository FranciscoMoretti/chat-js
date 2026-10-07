/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "@playwright/test" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-code-sandboxes"; "../lib/db/eve-queries"; "../lib/db/schema"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
import { expect, test } from "@playwright/test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { APIError, Sandbox } from "@vercel/sandbox";
/* oxlint-enable sort-imports */
import { eq } from "drizzle-orm";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  confirmEveCodeSandboxCreation,
  reserveEveCodeSandbox,
} from "../lib/db/eve-code-sandboxes";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { eveCodeSandbox, eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { eveCodeSandboxName } from "../lib/eve/code-sandbox-name";
import { purgeEveFamilyCodeSandboxes } from "../lib/eve/purge-code-sandboxes";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createModuleLogger } from "../lib/logger";
/* oxlint-enable sort-imports */
import { executeJavaScriptInSandbox } from "../tools/chatjs/_shared/code-execution/javascript";
import { executePythonInSandbox } from "../tools/chatjs/_shared/code-execution/python";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  cleanupSandbox,
  createSandbox,
  resolveSandboxAuth,
} from "../tools/chatjs/vercel-code-execution/execution-sandbox";
/* oxlint-enable sort-imports */
import { codeExecution } from "../tools/chatjs/vercel-code-execution/tool";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
import { testToolContext } from "./helpers/eve-tool-context";
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): for (const language of ["javascript", "python"] as cons keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): for (const language of ["javascript", "python"] as cons uses 120_000, 30_000, 15_000, 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
for (const language of ["javascript", "python"] as const) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test(`Sandbox SDK executes ${language} and removes the disposable resource`, async () => {
    test.setTimeout(120_000);
    const auth = resolveSandboxAuth();
    const name = eveCodeSandboxName({
      callId: language,
      ownerId: "local-sdk-fixture",
      provider: auth,
      sessionId: crypto.randomUUID(),
    });
    const sandbox = await createSandbox(
      // oxlint-disable-next-line no-ternary -- Keep createSandbox argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      language === "javascript" ? "node22" : "python3.13",
      AbortSignal.timeout(30_000),
      name,
      auth
    );
    const log = createModuleLogger("sandbox-sdk-test");
    const requestId = crypto.randomUUID();
    try {
      expect(sandbox.persistent).toBe(false);
      expect(sandbox.name).toBe(name);
      const context = {
        // oxlint-disable-next-line no-ternary -- Keep code as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        code: language === "javascript" ? "console.log(6 * 7)" : "print(6 * 7)",
        log,
        requestId,
        sandbox,
      };
      const result =
        // oxlint-disable-next-line no-ternary -- Keep result as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        language === "javascript"
          ? await executeJavaScriptInSandbox(context)
          : await executePythonInSandbox(context);
      expect(result.message).toContain("42");
    } finally {
      await cleanupSandbox(sandbox, log, requestId);
    }
    let removed = false;
    try {
      await Sandbox.get({
        name: sandbox.name,
        resume: false,
        signal: AbortSignal.timeout(15_000),
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing auth own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...auth,
      });
    } catch (error) {
      removed = error instanceof APIError && error.response.status === 404;
    }
    expect(
      removed,
      "Deleted sandbox must no longer be retrievable by its exact name"
    ).toBe(true);
  });
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-lines-per-function (#510): test("native sandbox ownership is durably released after real provider cleanup") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native sandbox ownership is durably released after real provider cleanup") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native sandbox ownership is durably released after real provider cleanup") uses 120_000, 60_000, 1, 0, 15_000, 404, 30_000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("native sandbox ownership is durably released after real provider cleanup") accepts resource; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native sandbox ownership is durably released after real provider cleanup") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("native sandbox ownership is durably released after real provider cleanup") intentionally keeps the existing falsy-value behavior of tool.execute; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): test("native sandbox ownership is durably released after real provider cleanup") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("native sandbox ownership is durably released after real provider cleanup", async () => {
  test.setTimeout(120_000);
  assertEveTestDatabase(env.DATABASE_URL);
  const ownerId = crypto.randomUUID();
  await db.insert(user).values({
    email: `${ownerId}@test.invalid`,
    id: ownerId,
    name: "Sandbox fixture",
  });
  const row = await createEveConversation(
    ownerId,
    crypto.randomUUID(),
    "Ownership fixture",
    () => Promise.resolve(crypto.randomUUID())
  );
  if (!row.sessionId) {
    throw new Error("Missing native fixture session");
  }
  try {
    const tool = codeExecution;
    if (!tool.execute) {
      throw new Error("Missing code executor");
    }
    const result = await tool.execute(
      {
        code: "console.log(6 * 7)",
        language: "javascript",
        title: "Ownership check",
      },
      testToolContext({
        abortSignal: AbortSignal.timeout(60_000),
        callId: "sdk-fixture",
        session: {
          auth: {
            current: null,
            initiator: {
              attributes: {},
              authenticator: "test",
              principalId: ownerId,
              principalType: "user",
            },
          },
          id: row.sessionId,
          turn: { id: "turn", sequence: 0 },
        },
        toolName: "codeExecution",
      })
    );
    expect(result).toMatchObject({
      output: { message: expect.stringContaining("42") },
    });
    const resources = await db
      .select()
      .from(eveCodeSandbox)
      .where(eq(eveCodeSandbox.ownerId, ownerId));
    expect(resources).toHaveLength(1);
    expect(resources[0].state).toBe("deleted");
    expect(resources[0].creationConfirmed).toBe(true);
    let missing = false;
    try {
      await Sandbox.get({
        name: resources[0].name,
        resume: false,
        signal: AbortSignal.timeout(15_000),
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing resolveSandboxAuth() own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...resolveSandboxAuth(),
      });
    } catch (error) {
      missing = error instanceof APIError && error.response.status === 404;
    }
    expect(missing).toBe(true);
    // Simulate process loss after the successful create reply was recorded.
    const orphanName = await reserveEveCodeSandbox(
      ownerId,
      row.id,
      "orphan-fixture",
      resolveSandboxAuth()
    );
    const orphan = await createSandbox(
      "node22",
      AbortSignal.timeout(30_000),
      orphanName,
      resolveSandboxAuth()
    );
    await confirmEveCodeSandboxCreation(ownerId, row.id, orphan.name);
    await beginEveConversationDeletion(ownerId, row.id);
    await purgeEveFamilyCodeSandboxes(ownerId, row.id);
    await purgeEveFamilyCodeSandboxes(ownerId, row.id);
    const [recovered] = await db
      .select()
      .from(eveCodeSandbox)
      .where(eq(eveCodeSandbox.name, orphanName));
    expect(recovered.state).toBe("deleted");
  } finally {
    const resources = await db
      .select()
      .from(eveCodeSandbox)
      .where(eq(eveCodeSandbox.ownerId, ownerId));
    // Preserve ownership evidence if allocation or cleanup had an uncertain outcome.
    if (resources.every((resource) => resource.state === "deleted")) {
      await db
        .delete(eveCodeSandbox)
        .where(eq(eveCodeSandbox.ownerId, ownerId));
      await db
        .delete(eveConversation)
        .where(eq(eveConversation.ownerId, ownerId));
      await db.delete(user).where(eq(user.id, ownerId));
    }
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */
