import { expect, test } from "@playwright/test";
import { APIError, Sandbox } from "@vercel/sandbox";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import {
  confirmEveCodeSandboxCreation,
  reserveEveCodeSandbox,
} from "../lib/db/eve-code-sandboxes";
import {
  beginEveConversationDeletion,
  createEveConversation,
} from "../lib/db/eve-queries";
import { eveCodeSandbox, eveConversation, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { eveCodeSandboxName } from "../lib/eve/code-sandbox-name";
import { eveCodeSandboxOwnership } from "../lib/eve/code-sandbox-ownership";
import { purgeEveFamilyCodeSandboxes } from "../lib/eve/purge-code-sandboxes";
import { createModuleLogger } from "../lib/logger";
import { codeExecution } from "../tools/platform/code-execution";
import { executeJavaScriptInSandbox } from "../tools/platform/code-execution.javascript";
import { executePythonInSandbox } from "../tools/platform/code-execution.python";
import {
  cleanupSandbox,
  createSandbox,
  getTokenAuth,
} from "../tools/platform/code-execution.shared";
import { resolveSandboxAuth } from "../tools/platform/sandbox-auth";
import { assertEveTestDatabase } from "./eve-test-database";

for (const language of ["javascript", "python"] as const) {
  test(`Sandbox SDK executes ${language} and removes the disposable resource`, async () => {
    test.setTimeout(120_000);
    const name = eveCodeSandboxName({
      ownerId: "local-sdk-fixture",
      sessionId: crypto.randomUUID(),
      callId: language,
      provider: await resolveSandboxAuth(),
    });
    const sandbox = await createSandbox(
      language === "javascript" ? "node22" : "python3.13",
      AbortSignal.timeout(30_000),
      name
    );
    const log = createModuleLogger("sandbox-sdk-test");
    const requestId = crypto.randomUUID();
    try {
      expect(sandbox.persistent).toBe(false);
      expect(sandbox.name).toBe(name);
      const context = {
        sandbox,
        log,
        requestId,
        code: language === "javascript" ? "console.log(6 * 7)" : "print(6 * 7)",
      };
      const result =
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
        ...getTokenAuth(),
      });
    } catch (error) {
      removed = error instanceof APIError && error.response.status === 404;
    }
    expect(
      removed,
      "Deleted sandbox must no longer be retrievable by its exact name"
    ).toBe(true);
  });
}

test("native sandbox ownership is durably released after real provider cleanup", async () => {
  test.setTimeout(120_000);
  assertEveTestDatabase(env.DATABASE_URL);
  const ownerId = crypto.randomUUID();
  await db.insert(user).values({
    id: ownerId,
    name: "Sandbox fixture",
    email: `${ownerId}@test.invalid`,
  });
  const row = await createEveConversation(
    ownerId,
    crypto.randomUUID(),
    "Ownership fixture",
    async () => crypto.randomUUID()
  );
  if (!row.sessionId) {
    throw new Error("Missing native fixture session");
  }
  try {
    const sandboxOwnership = eveCodeSandboxOwnership({
      callId: "sdk-fixture",
      session: {
        id: row.sessionId,
        auth: { initiator: { principalId: ownerId } },
      },
    });
    const tool = codeExecution({ sandboxOwnership });
    if (!tool.execute) {
      throw new Error("Missing code executor");
    }
    const result = await tool.execute(
      {
        title: "Ownership check",
        language: "javascript",
        code: "console.log(6 * 7)",
      },
      {
        toolCallId: "sdk-fixture",
        messages: [],
        context: {},
        abortSignal: AbortSignal.timeout(60_000),
      }
    );
    expect(result).toMatchObject({ message: expect.stringContaining("42") });
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
        ...getTokenAuth(),
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
      await resolveSandboxAuth()
    );
    const orphan = await createSandbox(
      "node22",
      AbortSignal.timeout(30_000),
      orphanName
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
