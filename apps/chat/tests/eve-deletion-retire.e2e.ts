/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:child_process" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { execFile } from "node:child_process";; import { promisify } from "node:util";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-documents"; "../lib/db/eve-native-purge"; "../lib/db/schema"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/no-shadow -- Nested callback names mirror the protocol fields and transaction APIs under test. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { z } from "zod";

import { db } from "../lib/db/client";
import { saveEveDocumentRevision } from "../lib/db/eve-documents";
import { purgeEveNativeSession } from "../lib/db/eve-native-purge";
import {
  eveConversation,
  eveDocumentCheckpoint,
  eveDocumentCheckpointEntry,
  eveDocumentRevision,
  eveChat,
  userCredit,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { prepareEveFamilyDeletion } from "../lib/eve/prepare-deletion";
import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "../lib/eve/retire-session";
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Retirement acceptance requires local Postgres.");
}

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/max-nested-calls, unicorn/no-null --
 * max-lines-per-function (#510): test("internal retirement settles usage after access revocation and is retryable") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("internal retirement settles usage after access revocation and is retryable") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("internal retirement settles usage after access revocation and is retryable") uses 404, 1, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/explicit-function-return-type (#560): Keep test("internal retirement settles usage after access revocation and is retryable")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test("internal retirement settles usage after access revocation and is retryable") accepts { page, }; route; event; tx; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("internal retirement settles usage after access revocation and is retryable") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("internal retirement settles usage after access revocation and is retryable") intentionally keeps the existing falsy-value behavior of identity; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * typescript/strict-void-return (#611): test("internal retirement settles usage after access revocation and is retryable")'s void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 * unicorn/max-nested-calls (#568): test("internal retirement settles usage after access revocation and is retryable") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("internal retirement settles usage after access revocation and is retryable") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("internal retirement settles usage after access revocation and is retryable", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const owner = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json())
    .user.id;
  await db
    .insert(userCredit)
    .values({ credits: 1000, userId: owner })
    .onConflictDoUpdate({
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      target: userCredit.userId,
    });
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply exactly retire-fixture-ok. Do not call tools.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  const [identity] = await db
    .select({ chatId: eveConversation.chatId })
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  if (!identity) {
    throw new Error("Missing logical chat identity");
  }
  expect(identity.chatId).not.toBe(binding.id);
  await page.goto(`/chat/${binding.id}`);
  await expect(page.locator(".is-assistant")).toContainText(
    "retire-fixture-ok",
    { timeout: 90_000 }
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await saveEveDocumentRevision({
    content: "Artifact content to remove",
    conversationId: binding.id,
    documentId: crypto.randomUUID(),
    expectedRevisionId: null,
    fileIds: [],
    kind: "text",
    operationId: crypto.randomUUID(),
    ownerId: owner,
    title: "Removal fixture",
    turnIndex: 0,
  });
  const family = await retireEveFamilyForDeletion(owner, binding.id);
  expect(family?.rootId).toBe(identity.chatId);
  expect(family?.conversations).toEqual([
    { id: binding.id, sessionId: binding.sessionId },
  ]);
  const denied = await page.request.get(
    `/api/eve/v1/session/${binding.sessionId}/stream`,
    { headers: { "x-chatjs-deletion": "1" } }
  );
  expect(denied.status()).toBe(404);
  // Keep a failed fixture fenced for diagnosis/retry; never reopen it to clean up.
  const snapshot = await retireEveSessionForDeletion(owner, binding.sessionId);
  expect(
    snapshot.events.some((event) => event.type === "session.completed")
  ).toBe(true);
  const [before] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  await retireEveSessionForDeletion(owner, binding.sessionId);
  const [after] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner));
  expect(after.credits).toBe(before.credits);
  const prepared = await prepareEveFamilyDeletion(owner, binding.id);
  expect(prepared?.runIds).toContain(binding.sessionId);
  expect(await prepareEveFamilyDeletion(owner, binding.id)).toEqual(prepared);
  const purgeResources = async () => {
    // Playwright loads this suite as CommonJS; run the ESM-only storage adapter
    // under the app's Bun runtime with the same local environment and app root.
    const { stdout } = await promisify(execFile)(
      "bun",
      [
        "-e",
        'import { purgeLocalEveFamilyResources } from "./lib/eve/purge-local-resources"; const result = await purgeLocalEveFamilyResources(process.argv[1], process.argv[2], process.cwd()); console.log(JSON.stringify(result)); process.exit(0);',
        owner,
        binding.id,
      ],
      { cwd: process.cwd(), timeout: 30_000 }
    );
    // oxlint-disable-next-line typescript/no-unsafe-return -- The controlled Bun child prints the deletion fixture as JSON; callers assert its raw persisted state.
    return JSON.parse(stdout);
  };
  expect(await purgeResources()).toEqual(prepared);
  expect(await purgeResources()).toEqual(prepared);
  expect(
    await db
      .select()
      .from(eveDocumentRevision)
      .where(eq(eveDocumentRevision.conversationId, binding.id))
  ).toEqual([]);
  const [pending] = await db
    .select({ state: eveConversation.state })
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  expect(pending.state).toBe("deleting");
  const native = postgres(env.DATABASE_URL, { max: 1 });
  try {
    expect(
      await native`select id from workflow.workflow_runs where id = ${binding.sessionId}`
    ).toHaveLength(1);
    const scope = {
      sessionId: binding.sessionId,
      taskIdentifier: "workflow_flows",
    };
    const receipt = await purgeEveNativeSession(
      env.DATABASE_URL,
      scope,
      async () => {
        await retireEveSessionForDeletion(owner, binding.sessionId);
      }
    );
    expect(receipt.runIds).toContain(binding.sessionId);
    expect(
      await native`select id from workflow.workflow_runs where id in ${native(receipt.runIds)}`
    ).toEqual([]);
    expect(
      await purgeEveNativeSession(env.DATABASE_URL, scope, () =>
        Promise.reject(new Error("Retired session must not reset again"))
      )
    ).toEqual(receipt);
    expect(await purgeResources()).toEqual(prepared);
    const deletionUrl = `/api/agent-conversations/${binding.id}`;
    const deletion = await page.request.delete(deletionUrl, {
      headers: { origin: new URL(page.url()).origin },
    });
    expect(deletion.status(), await deletion.text()).toBe(200);
    expect(await deletion.json()).toEqual({
      rootId: identity.chatId,
      status: "deleted",
    });
    expect(await (await page.request.get(deletionUrl)).json()).toEqual({
      rootId: identity.chatId,
      status: "deleted",
    });
    expect(
      (
        await page.request.delete(deletionUrl, {
          headers: { origin: new URL(page.url()).origin },
        })
      ).status()
    ).toBe(200);
    const [settled] = await db
      .select()
      .from(userCredit)
      .where(eq(userCredit.userId, owner));
    expect(settled.credits).toBe(after.credits);
  } finally {
    await native.end();
  }
  // Remove only this retired test binding; this is not a production purge assertion.
  await db.transaction(async (tx) => {
    await tx
      .delete(eveDocumentCheckpointEntry)
      .where(eq(eveDocumentCheckpointEntry.conversationId, binding.id));
    await tx
      .delete(eveDocumentCheckpoint)
      .where(eq(eveDocumentCheckpoint.conversationId, binding.id));
    await tx.delete(eveConversation).where(eq(eveConversation.id, binding.id));
    await tx.delete(eveChat).where(eq(eveChat.id, identity.chatId));
  });
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("sidebar deletion retires a fresh conversation and reports its durable tombstone keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("sidebar deletion retires a fresh conversation and reports its durable tombstone keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("sidebar deletion retires a fresh conversation and reports its durable tombstone uses 200, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("sidebar deletion retires a fresh conversation and reports its durable tombstone accepts { page, }; route; response; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("sidebar deletion retires a fresh conversation and reports its durable tombstone preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("sidebar deletion retires a fresh conversation and reports its durable tombstone intentionally keeps the existing falsy-value behavior of identity; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("sidebar deletion retires a fresh conversation and reports its durable tombstone", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const owner = z
    .object({ user: z.object({ id: z.string() }) })
    .parse(await (await page.request.get("/api/auth/get-session")).json())
    .user.id;
  await db
    .insert(userCredit)
    .values({ credits: 1000, userId: owner })
    .onConflictDoUpdate({
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      target: userCredit.userId,
    });
  const { origin } = new URL(page.url());
  const response = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply exactly deletion-api-ok. Do not call tools.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(response.ok(), await response.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await response.json());
  const [identity] = await db
    .select({ chatId: eveConversation.chatId })
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  if (!identity) {
    throw new Error("Missing logical chat identity");
  }
  expect(identity.chatId).not.toBe(binding.id);
  await page.goto(`/chat/${binding.id}`);
  await expect(page.locator(".is-assistant")).toContainText("deletion-api-ok", {
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const url = `/api/agent-conversations/${identity.chatId}`;
  expect(await (await page.request.get(url)).json()).toEqual({
    rootId: identity.chatId,
    status: "active",
  });
  const expand = page.getByRole("button", {
    exact: true,
    name: "Expand sidebar",
  });
  if (await expand.isVisible()) {
    await expand.click();
  }
  const row = page
    .locator("li")
    .filter({ has: page.locator(`a[href="/chat/${identity.chatId}"]`) });
  await row.hover();
  await row.getByRole("button", { exact: true, name: "More" }).click();
  await page.getByRole("menuitem", { exact: true, name: "Delete" }).click();
  const result = page.waitForResponse(
    (response) =>
      response.url().endsWith(url) && response.request().method() === "DELETE"
  );
  await page
    .getByRole("dialog", { name: "Delete conversation and branches?" })
    .getByRole("button", {
      exact: true,
      name: "Delete conversation and branches",
    })
    .click();
  const deleted = await result;
  expect(deleted.status(), await deleted.text()).toBe(200);
  await expect(page).toHaveURL(`${origin}/`);
  await expect(
    page.getByRole("dialog", { name: "Delete conversation and branches?" })
  ).toHaveCount(0);
  expect(await deleted.json()).toEqual({
    rootId: identity.chatId,
    status: "deleted",
  });
  expect(await (await page.request.get(url)).json()).toEqual({
    rootId: identity.chatId,
    status: "deleted",
  });
  expect(
    (await page.request.delete(url, { headers: { origin } })).status()
  ).toBe(200);
  const native = postgres(env.DATABASE_URL, { max: 1 });
  try {
    expect(
      await native`select id from workflow.workflow_runs where id = ${binding.sessionId}`
    ).toHaveLength(0);
  } finally {
    await native.end();
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
