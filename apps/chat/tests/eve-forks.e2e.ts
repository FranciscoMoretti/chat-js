import { expect, test } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db/client";
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

const modelId = "openai/gpt-5-nano";

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
    const session = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json());
    // The guarded test database uses virtual application credits for paid-tool tests.
    await db
      .insert(userCredit)
      .values({ userId: session.user.id, credits: 1000 })
      .onConflictDoUpdate({
        target: userCredit.userId,
        set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      });

    const headers = { origin: new URL(page.url()).origin };
    const created = await page.request.post("/api/agent-conversations", {
      headers,
      data: {
        operationId: crypto.randomUUID(),
        modelId,
        message:
          "Remember the token CEDAR-PINE. Reply briefly. Do not call tools.",
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const source = conversationBinding.parse(await created.json());
    cleanup = { id: source.id, origin: headers.origin };
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("Reply with original-second-response. Do not call tools.");
    await page.getByRole("button", { name: "Send", exact: true }).click();
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
      operationId: crypto.randomUUID(),
      modelId,
      message:
        "What token did I ask you to remember? Reply only with the token. Do not call tools.",
      fork: { conversationId: source.id, beforeTurnId: "turn_1" },
    };
    const forked = await page.request.post("/api/agent-conversations", {
      headers,
      data: operation,
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
      headers,
      data: operation,
    });
    expect(replay.ok(), await replay.text()).toBe(true);
    expect(conversationBinding.parse(await replay.json())).toEqual(branch);
    const changed = await page.request.post("/api/agent-conversations", {
      headers,
      data: {
        ...operation,
        fork: { ...operation.fork, beforeTurnId: "turn_0" },
      },
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
    expect(stored?.parentConversationId).toBe(source.id);
    expect(stored?.rootConversationId).toBe(source.id);
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByRole("log")).toContainText(
      "original-second-response"
    );
    await expect(page.getByRole("log")).not.toContainText(operation.message);

    const foreignOwner = crypto.randomUUID();
    const foreignId = crypto.randomUUID();
    await db.insert(user).values({
      id: foreignOwner,
      email: `${foreignOwner}@test.invalid`,
      name: "Foreign fork fixture",
    });
    await db.insert(eveConversation).values({
      id: foreignId,
      ownerId: foreignOwner,
      operationId: crypto.randomUUID(),
      firstMessage: "Private source",
      sessionId: crypto.randomUUID(),
      state: "bound",
    });
    try {
      const forbidden = await page.request.post("/api/agent-conversations", {
        headers,
        data: {
          ...operation,
          operationId: crypto.randomUUID(),
          fork: { ...operation.fork, conversationId: foreignId },
        },
      });
      expect(forbidden.status()).toBe(404);
      const raw = await page.request.post("/api/agent-conversations", {
        headers,
        data: {
          ...operation,
          fork: { sessionId: source.sessionId, beforeTurnId: "turn_1" },
        },
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
              return response?.status() === 200 ? response.json() : null;
            },
            { timeout: 90_000, intervals: [1000, 2000, 5000] }
          )
          .toEqual({ status: "deleted", rootId: cleanup.id });
      } catch (error) {
        if (!bodyFailed) {
          cleanupFailure = { error };
        }
        testInfo.annotations.push({
          type: "cleanup",
          description: "Native conversation family cleanup also failed.",
        });
      }
    }
  }
  if (cleanupFailure) {
    throw cleanupFailure.error;
  }
});
