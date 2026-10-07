/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */
import { expect, test } from "@playwright/test";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eq, sql } from "drizzle-orm";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { conversationBinding } from "../lib/eve/contracts";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

const modelId = "openai/gpt-5-nano";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null --
 * init-declarations (#507): test("fork API preserves native history in ChatJS and rejects changed retries and for assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("fork API preserves native history in ChatJS and rejects changed retries and for keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("fork API preserves native history in ChatJS and rejects changed retries and for keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("fork API preserves native history in ChatJS and rejects changed retries and for uses 180_000, 2, 409, 1, 404, 400, 150_000, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("fork API preserves native history in ChatJS and rejects changed retries and for accepts { page, }; testInfo; route; entry; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("fork API preserves native history in ChatJS and rejects changed retries and for preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/no-null (#570): test("fork API preserves native history in ChatJS and rejects changed retries and for preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
test("fork API preserves native history in ChatJS and rejects changed retries and foreign sources", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  let cleanup: { id: string; origin: string } | undefined;
  let bodyFailed = false;
  let cleanupFailure: { error: unknown } | undefined;
  try {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    await page.request.post("/api/chat-model", {
      data: { model: modelId },
    });
    const authSessionResponse = await page.request.get("/api/auth/get-session");
    const session = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await authSessionResponse.json());
    // The guarded test database uses virtual application credits for paid-tool tests.
    await db
      .insert(userCredit)
      .values({ credits: 1000, userId: session.user.id })
      .onConflictDoUpdate({
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
        target: userCredit.userId,
      });

    const headers = { origin: new URL(page.url()).origin };
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message:
          "Remember the token CEDAR-PINE. Reply briefly. Do not call tools.",
        modelId,
        operationId: crypto.randomUUID(),
      },
      headers,
    });
    expect(created.ok(), await created.text()).toBe(true);
    const source = conversationBinding.parse(await created.json());
    cleanup = { id: source.id, origin: headers.origin };
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Reply with original-second-response. Do not call tools.");
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByRole("log").locator(".is-user").last()
    ).toContainText("Reply with original-second-response. Do not call tools.");
    await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(
      2,
      {
        timeout: 90_000,
      }
    );
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();

    const operation = {
      fork: { beforeTurnId: "turn_1", conversationId: source.id },
      message:
        "What token did I ask you to remember? Reply only with the token. Do not call tools.",
      modelId,
      operationId: crypto.randomUUID(),
    };
    const forked = await page.request.post("/api/agent-conversations", {
      data: operation,
      headers,
    });
    expect(forked.ok(), await forked.text()).toBe(true);
    const branch = conversationBinding.parse(await forked.json());
    expect(branch.sessionId).not.toBe(source.sessionId);
    await page.goto(`/chat/${branch.id}`);
    await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(
      2,
      {
        timeout: 90_000,
      }
    );
    await expect(
      page.getByRole("log").locator(".is-assistant").last()
    ).toContainText("CEDAR-PINE", { timeout: 90_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await expect(page.getByRole("log").locator(".is-user")).toHaveCount(2);
    await expect(page.getByRole("log")).not.toContainText(
      "original-second-response"
    );
    await page.reload();
    await expect(page.getByRole("log").locator(".is-user")).toHaveCount(2);
    await expect(
      page.getByRole("log").locator(".is-assistant").last()
    ).toContainText("CEDAR-PINE");
    const replay = await page.request.post("/api/agent-conversations", {
      data: operation,
      headers,
    });
    expect(replay.ok(), await replay.text()).toBe(true);
    expect(conversationBinding.parse(await replay.json())).toEqual(branch);
    const changed = await page.request.post("/api/agent-conversations", {
      data: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing operation own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...operation,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing operation.fork own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        fork: { ...operation.fork, beforeTurnId: "turn_0" },
      },
      headers,
    });
    expect(changed.status()).toBe(409);
    const usage = await db
      .select()
      .from(eveUsage)
      .where(eq(eveUsage.sessionId, branch.sessionId));
    // Follow-up suggestions have independent hook-model receipts. Only the new
    // branch turn may be billed; copied ancestor turns must not be charged again.
    expect(new Set(usage.map((entry) => entry.turnId))).toEqual(
      new Set(["turn_1"])
    );
    expect(
      usage.filter((entry) => !entry.eventId.includes(":model-call:"))
    ).toHaveLength(1);
    const [stored] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, branch.id));
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading parentConversationId from stored; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(stored?.parentConversationId).toBe(source.id);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading rootConversationId from stored; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(stored?.rootConversationId).toBe(source.id);
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByRole("log")).toContainText(
      "original-second-response"
    );
    await expect(page.getByRole("log")).not.toContainText(operation.message);

    const foreignOwner = crypto.randomUUID();
    const foreignId = crypto.randomUUID();
    await db.insert(user).values({
      email: `${foreignOwner}@test.invalid`,
      id: foreignOwner,
      name: "Foreign fork fixture",
    });
    await insertEveConversationFixtures({
      firstMessage: "Private source",
      id: foreignId,
      operationId: crypto.randomUUID(),
      ownerId: foreignOwner,
      sessionId: crypto.randomUUID(),
      state: "bound",
    });
    try {
      const forbidden = await page.request.post("/api/agent-conversations", {
        data: {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing operation own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...operation,
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing operation.fork own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          fork: { ...operation.fork, conversationId: foreignId },
          operationId: crypto.randomUUID(),
        },
        headers,
      });
      expect(forbidden.status()).toBe(404);
      const raw = await page.request.post("/api/agent-conversations", {
        data: {
          // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing operation own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          ...operation,
          fork: { beforeTurnId: "turn_1", sessionId: source.sessionId },
        },
        headers,
      });
      expect(raw.status()).toBe(400);
    } finally {
      await db.delete(eveConversation).where(eq(eveConversation.id, foreignId));
      await db.delete(user).where(eq(user.id, foreignOwner));
    }
  } catch (error) {
    bodyFailed = true;
    throw error;
  } finally {
    testInfo.setTimeout(testInfo.timeout + 150_000);
    if (cleanup) {
      const url = `/api/agent-conversations/${cleanup.id}`;
      const headers = { origin: cleanup.origin };
      try {
        await expect
          .poll(
            async () => {
              const response = await page.request
                .delete(url, { headers, timeout: 30_000 })
                .catch(() => null);
              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading status from response; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
              if (response?.status() !== 200) {
                return null;
              }
              const responseBody: unknown = await response.json();
              return responseBody;
            },
            { intervals: [1000, 2000, 5000], timeout: 90_000 }
          )
          .toEqual({ rootId: cleanup.id, status: "deleted" });
      } catch (error) {
        if (!bodyFailed) {
          cleanupFailure = { error };
        }
        testInfo.annotations.push({
          description: "Native conversation family cleanup also failed.",
          type: "cleanup",
        });
      }
    }
  }
  if (cleanupFailure) {
    throw cleanupFailure.error;
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, unicorn/no-null */
