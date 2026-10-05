/* oxlint-disable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "node:crypto" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-nodejs-modules (#529): This test harness requires import { createHash } from "node:crypto";; import { readFile, realpath } from "node:fs/promises";; import path from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/eve-documents"; "../lib/db/schema"; "../lib/env"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
import { createHash } from "node:crypto";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { readFile, realpath } from "node:fs/promises";
/* oxlint-enable sort-imports */
import path from "node:path";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "@playwright/test";
/* oxlint-enable sort-imports */
import { eq } from "drizzle-orm";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../lib/db/eve-documents";
/* oxlint-enable sort-imports */
import { eveConversation } from "../lib/db/schema";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "../lib/env";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { conversationBinding } from "../lib/eve/contracts";
/* oxlint-enable sort-imports */
import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies, import/no-nodejs-modules, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null --
 * init-declarations (#507): test("compiled idle capture preserves native history and exact document revisions in  assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("compiled idle capture preserves native history and exact document revisions in  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("compiled idle capture preserves native history and exact document revisions in  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("compiled idle capture preserves native history and exact document revisions in  uses 180_000, 0, 8, 200, 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("compiled idle capture preserves native history and exact document revisions in  uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep test("compiled idle capture preserves native history and exact document revisions in 's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): test("compiled idle capture preserves native history and exact document revisions in  accepts { page, }; testInfo; route; request; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("compiled idle capture preserves native history and exact document revisions in  preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/max-nested-calls (#568): test("compiled idle capture preserves native history and exact document revisions in  keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("compiled idle capture preserves native history and exact document revisions in  preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("compiled idle capture preserves native history and exact document revisions in follow-up comparisons", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash-lite" },
  });
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  const message = `Reply with exactly ${token} in plain text. Do not invoke any tools.`;
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message,
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(created.status()).toBe(200);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(
    page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const [binding] = await db
    .select({ ownerId: eveConversation.ownerId })
    .from(eveConversation)
    .where(eq(eveConversation.id, source.id));
  const document = {
    content: "Captured document",
    conversationId: source.id,
    documentId: crypto.randomUUID(),
    expectedRevisionId: null,
    fileIds: [],
    kind: "text" as const,
    operationId: crypto.randomUUID(),
    ownerId: binding.ownerId,
    title: "Idle checkpoint fixture",
    turnIndex: 0,
  };
  const original = await saveEveDocumentRevision(document);
  const workerRoot = await realpath(process.cwd());
  async function birthIdentity(sessionId: string) {
    // oxlint-disable-next-line typescript/no-unsafe-return -- The controlled checkpoint fixture captures native request and manifest shapes; preserving raw fields is part of the recovery assertions.
    return JSON.parse(
      await readFile(
        path.join(
          workerRoot,
          ".eve",
          "sandbox-identities",
          `${createHash("sha256").update(sessionId).digest("hex")}.json`
        ),
        "utf-8"
      )
    );
  }
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- The controlled checkpoint fixture captures native request and manifest shapes; preserving raw fields is part of the recovery assertions.
  const sourceIdentity = await birthIdentity(source.sessionId);
  expect(sourceIdentity).toMatchObject({
    appRoot: workerRoot,
    sessionId: source.sessionId,
    version: 1,
  });
  const captureRequests: { checkpointId: string; beforeTurnId: string }[] = [];
  let groupRequests = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/api/agent-response-groups"
    ) {
      groupRequests += 1;
    }
  });
  await page.route(
    `**/api/agent-conversations/${source.id}/checkpoint`,
    async (route) => {
      // oxlint-disable-next-line typescript/no-unsafe-argument -- The controlled checkpoint fixture captures native request and manifest shapes; preserving raw fields is part of the recovery assertions.
      captureRequests.push(route.request().postDataJSON());
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      if (captureRequests.length === 1) {
        await saveEveDocumentRevision(
          {
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing document own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...document,
            content: "Later source edit",
            expectedRevisionId: original.id,
            operationId: crypto.randomUUID(),
            turnIndex: null,
          },
          undefined,
          [0]
        );
        // The server committed the snapshot, but the browser loses the reply.
        await route.abort("failed");
      } else {
        await route.fulfill({ response });
      }
    }
  );
  await page.getByRole("combobox").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { exact: true, name: "1×" }).click();
  await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
  await page.keyboard.press("Escape");
  const followUp =
    "Repeat your previous answer verbatim, as plain text. Do not add commentary or call tools.";
  await page.locator('[contenteditable="true"]').fill(followUp);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const recover = page.getByRole("button", {
    exact: true,
    name: "Recover comparison",
  });
  await expect(recover).toBeEnabled();
  expect(groupRequests).toBe(0);
  const storageKey = `chatjs.eve.pending:${binding.ownerId}:fork:${source.id}`;
  const saved = await page.evaluate(
    (key) => sessionStorage.getItem(key),
    storageKey
  );
  expect(JSON.parse(saved ?? "null")).toMatchObject({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing captureRequests[0] own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    fork: { conversationId: source.id, ...captureRequests[0] },
    message: followUp,
    modelIds: ["google/gemini-2.5-flash-lite", "google/gemini-2.5-flash-lite"],
  });
  await page.reload();
  await expect(recover).toBeEnabled();
  expect(groupRequests).toBe(0);
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeDisabled();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("follow-up-recovery.png"),
  });
  let groupPayload: unknown;
  await page.route("**/api/agent-response-groups", async (route) => {
    const response = await route.fetch({ timeout: 90_000 });
    expect(response.status()).toBe(200);
    groupPayload = await response.json();
    await route.fulfill({ response });
  });
  await recover.click();
  await expect.poll(() => groupPayload, { timeout: 90_000 }).toBeTruthy();
  const group = eveResponseGroupResult.parse(groupPayload);
  expect(captureRequests).toHaveLength(2);
  expect(captureRequests[1]).toEqual(captureRequests[0]);
  expect(group.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "bound",
  ]);
  for (const candidate of group.candidates) {
    if (candidate.state !== "bound") {
      throw new Error("Follow-up did not bind");
    }
    const followupDocumentRevision = await getEveDocumentRevision(
      binding.ownerId,
      candidate.conversationId,
      document.documentId
    );
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from followupDocumentRevision; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(followupDocumentRevision?.id).toBe(original.id);
    await page.goto(`/chat/${candidate.conversationId}`);
    await expect(
      page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
    ).toHaveCount(2, { timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    expect(await birthIdentity(candidate.sessionId)).toEqual({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing sourceIdentity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...sourceIdentity,
      sessionId: candidate.sessionId,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
  }
  await page.reload();
  await expect(
    page.getByRole("log").locator(".is-assistant").filter({ hasText: token })
  ).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("idle-follow-up.png"),
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("follow-up-mobile.png"),
  });
  expect(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.setViewportSize({ height: 720, width: 1280 });
  await page.unroute("**/api/agent-response-groups");
  await page.route("**/api/agent-response-groups", (route) => {
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- The controlled checkpoint fixture captures native request and manifest shapes; preserving raw fields is part of the recovery assertions.
    const input = route.request().postDataJSON();
    return route.fulfill({
      json: {
        // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- The controlled checkpoint fixture captures native request and manifest shapes; preserving raw fields is part of the recovery assertions.
        candidates: input.modelIds.map((modelId: string) => ({
          modelId,
          operationId: crypto.randomUUID(),
          state: "rejected",
          error: "Fixture model unavailable",
        })),
        id: crypto.randomUUID(),
      },
    });
  });
  await page
    .getByRole("group", { exact: true, name: "Message composer" })
    .getByRole("combobox")
    .click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { exact: true, name: "1×" }).click();
  await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
  await page.keyboard.press("Escape");
  await page
    .locator('[contenteditable="true"]')
    .fill("Retain this rejected follow-up");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Fixture model unavailable" })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[contenteditable="true"]')).toHaveText(
    "Retain this rejected follow-up"
  );
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeEnabled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null */

/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * init-declarations (#507): test("an advanced source rejects the exact comparison checkpoint and keeps the editab assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("an advanced source rejects the exact comparison checkpoint and keeps the editab keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("an advanced source rejects the exact comparison checkpoint and keeps the editab keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("an advanced source rejects the exact comparison checkpoint and keeps the editab uses 1, 409, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("an advanced source rejects the exact comparison checkpoint and keeps the editab accepts { page, context, }; testInfo; route; request; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("an advanced source rejects the exact comparison checkpoint and keeps the editab preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("an advanced source rejects the exact comparison checkpoint and keeps the editable draft", async ({
  page,
  context,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  await page.request.post("/api/chat-model", {
    data: { model: "google/gemini-2.5-flash-lite" },
  });
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply exactly checkpoint-source-ready. Do not call tools.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(page.locator(".is-assistant")).toContainText(
    "checkpoint-source-ready",
    { timeout: 60_000 }
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const [binding] = await db
    .select({ ownerId: eveConversation.ownerId })
    .from(eveConversation)
    .where(eq(eveConversation.id, source.id));
  const other = await context.newPage();
  await other.route("https://unpkg.com/react-scan/**", (route) =>
    route.abort()
  );
  await other.goto(`/chat/${source.id}`);
  await expect(other.getByText("Ready", { exact: true })).toBeVisible();
  let groups = 0;
  let checkpoint: { checkpointId: string; beforeTurnId: string } | undefined;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/agent-response-groups" &&
      request.method() === "POST"
    ) {
      groups += 1;
    }
  });
  await page.route(
    `**/api/agent-conversations/${source.id}/checkpoint`,
    async (route) => {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- The controlled checkpoint fixture captures native request and manifest shapes; preserving raw fields is part of the recovery assertions.
      checkpoint = route.request().postDataJSON();
      // Another tab wins the next turn before the saved checkpoint reaches the worker.
      await other
        .getByRole("textbox", { exact: true, name: "Message" })
        .fill("Reply exactly checkpoint-source-advanced. Do not call tools.");
      await other.getByRole("button", { exact: true, name: "Send" }).click();
      await expect(other.locator(".is-assistant").last()).toContainText(
        "checkpoint-source-advanced",
        { timeout: 20_000 }
      );
      await expect(other.getByText("Ready", { exact: true })).toBeVisible();
      const rejected = await route.fetch();
      expect(rejected.status()).toBe(409);
      expect(await rejected.json()).toMatchObject({
        checkpointRejected: true,
        conversationId: source.id,
        reason: "source_advanced",
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing checkpoint own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...checkpoint,
      });
      await route.fulfill({ response: rejected });
    }
  );
  try {
    await page.getByTestId("model-selector").click();
    await page.getByRole("switch", { name: "Use Multiple Models" }).click();
    await page.getByRole("button", { exact: true, name: "1×" }).click();
    await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
    await page.keyboard.press("Escape");
    const draft = "Keep this comparison draft after the source advances.";
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(draft);
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByText(
        "The conversation changed before the comparison could start.",
        { exact: false }
      )
    ).toBeVisible({ timeout: 40_000 });
    expect(groups).toBe(0);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading beforeTurnId from checkpoint; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(checkpoint?.beforeTurnId).toBe("turn_1");
    await expect(
      page.getByRole("textbox", { exact: true, name: "Message" })
    ).toHaveText(draft);
    await expect(
      page.getByRole("button", { exact: true, name: "Send" })
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { exact: true, name: "Recover comparison" })
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        (key) => sessionStorage.getItem(key),
        `chatjs.eve.pending:${binding.ownerId}:fork:${source.id}`
      )
    ).toBeNull();
    // The durable rejection remains terminal when its exact identity is retried.
    const repeated = await page.request.post(
      `/api/agent-conversations/${source.id}/checkpoint`,
      { data: checkpoint, headers: { origin } }
    );
    expect(repeated.status()).toBe(409);
    expect(await repeated.json()).toMatchObject({
      checkpointRejected: true,
      reason: "source_advanced",
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing checkpoint own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...checkpoint,
    });
    await page
      .getByRole("alert")
      .filter({ hasText: "The conversation changed" })
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("checkpoint-rejected.png"),
      });
    await page.reload();
    await expect(
      page.getByRole("textbox", { exact: true, name: "Message" })
    ).toHaveText(draft);
    await expect(
      page.getByRole("button", { exact: true, name: "Send" })
    ).toBeEnabled();
    expect(groups).toBe(0);
  } finally {
    await other.close();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This eve-idle-checkpoint-live.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
