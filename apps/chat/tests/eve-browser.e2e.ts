import { userCredit } from "@/chatjs/plugins/credits/credits-schema";
import { setTimeout as delay } from "node:timers/promises";
import { mkdir } from "node:fs/promises";

import type { Page, Request, Response } from "@playwright/test";

import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage, user } from "../lib/db/schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";
import { readLogicalChatId } from "./eve-test-chat-identity";

assertEveTestDatabase(env.DATABASE_URL);

const conversationUrl = /\/chat\/[^/]+$/u;
const connectionFailure = /fetch|failed/iu;

const capture = async (
  page: Readonly<Pick<Page, "screenshot">>,
  name: string
): Promise<void> => {
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  await page.screenshot({
    animations: "disabled",
    path: `tests/eve-results/screenshots/${name}.png`,
    style:
      "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility: hidden !important; }",
  });
};

test.beforeEach(async ({ page }) => {
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toBeEditable();
});

const create = async (page: Page, message: string): Promise<void> => {
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(message);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page).toHaveURL(conversationUrl);
};

test("native transcript survives reload; streaming preserves the next draft; cancellation permits another send", async ({
  page,
}) => {
  // This scenario includes four durable turns and reloads.
  test.setTimeout(120_000);
  await capture(page, "empty-desktop");
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("slow response");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page.getByText("Responding…", { exact: true })).toBeVisible();
  await expect(composer).toHaveValue("", { timeout: 1000 });
  await composer.fill("my next draft");
  await capture(page, "streaming-desktop");
  await expect(
    page.getByText("Verified: slow response", { exact: true })
  ).toBeVisible();
  await expect(composer).toHaveValue("my next draft");
  await composer.fill("slow cancel");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Stop" })
  ).toBeEnabled();
  const cancellation = page.waitForResponse(
    (response: Readonly<Pick<Response, "url">>) =>
      response.url().endsWith("/cancel")
  );
  await page.getByRole("button", { exact: true, name: "Stop" }).click();
  const cancellationResponse = await cancellation;
  expect(cancellationResponse.status()).toBe(202);
  const cancellationReceipt = z
    .object({
      deliveryId: z.uuid(),
      ok: z.literal(true),
      sessionId: z.string().min(1),
    })
    .parse(await cancellationResponse.json());
  expect(cancellationReceipt.sessionId).toBe(
    new URL(cancellationResponse.url()).pathname.split("/").at(-2)
  );
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await composer.fill("after cancellation");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("Verified: after cancellation", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(composer).toHaveValue("");
  await capture(page, "conversation-desktop");
  await page.setViewportSize({ height: 844, width: 390 });
  await capture(page, "conversation-mobile");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test("freeform agent question survives reload and accepts an answer", async ({
  page,
}) => {
  await create(page, "question");
  await expect(
    page.getByRole("textbox", { name: "Your answer" })
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("Ship on Friday");
  await capture(page, "question-pending");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(
    page.getByText("Answer received.", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Ship on Friday", { exact: true })).toBeVisible();
});

for (const decision of ["Approve", "Deny"]) {
  test(`pending tool survives reload and ${decision.toLowerCase()} completes`, async ({
    page,
  }) => {
    await create(page, "confirm release");
    const action = page.getByRole("button", { exact: true, name: decision });
    await expect(action).toBeEnabled();
    await page.reload();
    await expect(action).toBeEnabled();
    await capture(page, `approval-${decision.toLowerCase()}`);
    await action.click();
    await expect(
      page.getByText("Approval handled.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(decision === "Approve" ? "Approved" : "Declined", {
        exact: true,
      })
    ).toBeVisible();
    await capture(page, `tool-${decision.toLowerCase()}`);
  });
}

test("failed turn is visible and the conversation can continue", async ({
  page,
}) => {
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("fail");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const failure = page
    .getByRole("alert")
    .filter({ hasText: "Reply interrupted" });
  await expect(failure).toBeVisible();
  await expect(
    page.getByRole("log").getByText("fail", { exact: true })
  ).toBeVisible();
  await expect(composer).toHaveValue("");
  await capture(page, "failed-turn");
  await page.reload();
  await expect(failure).toBeVisible();
  await composer.fill("recovered");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("Verified: recovered", { exact: true })
  ).toBeVisible();
});

test("lost creation reply retries the same conversation and access checks reject bypasses", async ({
  page,
  browser,
  baseURL,
}) => {
  let acceptedId: string | undefined;
  await page.route("**/api/agent-conversations", async (route) => {
    const response = await route.fetch();
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "id" in body &&
      typeof body.id === "string"
    ) {
      acceptedId = body.id;
    }
    await route.abort("failed");
    await page.unroute("**/api/agent-conversations");
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("retained intent");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: connectionFailure })
  ).toBeVisible();
  await capture(page, "creation-interrupted");
  if (acceptedId === undefined) {
    throw new Error("Missing branch identity from the accepted creation.");
  }
  const chatId = await readLogicalChatId(page.request, acceptedId);
  await page
    .getByRole("button", { exact: true, name: "Retry creation" })
    .click();
  await expect(page).toHaveURL(`${baseURL}/chat/${chatId}`);
  await expect(
    page.getByText("Verified: retained intent", { exact: true })
  ).toBeVisible();

  const { origin } = new URL(baseURL ?? "http://localhost");
  const rawCreate = await page.request.post("/api/eve/v1/session", {
    data: { message: "bypass" },
    headers: { origin },
  });
  expect(rawCreate.status()).toBe(404);
  const foreign = await page.request.get(
    "/api/eve/v1/session/foreign/stream?includeTailIndex=1"
  );
  expect(foreign.status()).toBe(404);
  const crossOrigin = await page.request.post("/api/agent-conversations", {
    data: { message: "bypass", operationId: crypto.randomUUID() },
    headers: { origin: "https://evil.test" },
  });
  expect(crossOrigin.status()).toBe(403);
  const invalid = await page.request.post("/api/agent-conversations", {
    data: { message: " ", operationId: crypto.randomUUID() },
    headers: { origin },
  });
  expect(invalid.status()).toBe(400);
  const anonymous = await browser.newContext({ baseURL });
  try {
    const denied = await anonymous.request.post("/api/agent-conversations", {
      data: { message: "bypass", operationId: crypto.randomUUID() },
      headers: { origin },
    });
    expect(denied.status()).toBe(401);
  } finally {
    await anonymous.close();
  }
});

test("exhausted credits block new messages but permit rejecting an approval", async ({
  page,
}) => {
  await create(page, "confirm release");
  await expect(
    page.getByRole("button", { exact: true, name: "Deny" })
  ).toBeEnabled();
  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.email, "dev@localhost"));
  if (owner === undefined) {
    throw new Error("Missing development user.");
  }
  const [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner.id));
  if (balance === undefined) {
    throw new Error("Missing credit balance.");
  }
  try {
    await db
      .update(userCredit)
      .set({ balanceCents: 0 })
      .where(eq(userCredit.userId, owner.id));
    await page.reload();
    await page.getByRole("button", { exact: true, name: "Deny" }).click();
    await expect(page.getByText("Declined", { exact: true })).toBeVisible();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("cannot start");
    const rejected = page.waitForResponse(
      (response: Readonly<Pick<Response, "request" | "url">>) =>
        response.url().includes("/api/eve/v1/session/") &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    const creditRejectionResponse = await rejected;
    expect(creditRejectionResponse.status()).toBe(402);
  } finally {
    await db
      .update(userCredit)
      .set({ balanceCents: balance.balanceCents })
      .where(eq(userCredit.userId, owner.id));
  }
});

test("unpriced usage remains recoverable without blocking a new conversation", async ({
  page,
  baseURL,
}) => {
  await create(page, "known zero-cost fixture");
  await expect(
    page.getByText("Verified: known zero-cost fixture", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1);
  if (id === undefined || id === null || id === "") {
    throw new Error("Missing conversation identity.");
  }
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.chatId, id));
  if (
    conversation === undefined ||
    conversation === null ||
    conversation.sessionId === undefined ||
    conversation.sessionId === null ||
    conversation.sessionId === ""
  ) {
    throw new Error("Missing session binding.");
  }
  const [usage] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  if (usage === undefined) {
    throw new Error("Missing fixture usage.");
  }
  try {
    await db
      .update(eveUsage)
      .set({ costUsd: null })
      .where(eq(eveUsage.eventId, usage.eventId));
    const response = await page.request.post("/api/agent-conversations", {
      data: {
        message: "continue with unpriced usage",
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(baseURL ?? "http://localhost").origin },
    });
    expect(response.status()).toBe(200);
    const [unpriced] = await db
      .select({ costUsd: eveUsage.costUsd })
      .from(eveUsage)
      .where(eq(eveUsage.eventId, usage.eventId));
    expect(unpriced).toEqual({ costUsd: null });
  } finally {
    await db
      .update(eveUsage)
      .set({ costUsd: usage.costUsd })
      .where(eq(eveUsage.eventId, usage.eventId));
  }
});

test("normal navigation and sidebar search use Eve without sending to the old chat API", async ({
  page,
}) => {
  const legacyRequests: string[] = [];
  page.on("request", (request: Readonly<Pick<Request, "method" | "url">>) => {
    if (
      new URL(request.url()).pathname === "/api/chat" &&
      request.method() === "POST"
    ) {
      legacyRequests.push(request.url());
    }
  });
  await create(page, "sidebar migration check");
  await expect(
    page.getByText("Verified: sidebar migration check", { exact: true })
  ).toBeVisible();
  const conversation = page.url();
  await page.getByRole("link", { name: /^New Chat\b/u }).click();
  await expect(page).toHaveURL(new URL("/", conversation).href);
  await page.getByRole("button", { name: /^Search chats\b/u }).click();
  const search = page.getByRole("combobox", { name: "Search conversations" });
  await search.fill("sidebar migration check");
  const chatId = z
    .uuid()
    .parse(new URL(conversation).pathname.split("/").at(-1));
  const result = page
    .getByRole("option", { name: /sidebar migration check/u })
    .and(page.locator(`[data-value="${chatId}"]`));
  await expect(result).toBeVisible();
  await capture(page, "sidebar-search");
  await result.click();
  await expect(page).toHaveURL(conversation);
  await expect(
    page.getByText("Verified: sidebar migration check", { exact: true })
  ).toBeVisible();
  expect(legacyRequests).toEqual([]);
});

test("unknown conversations and removed legacy APIs are unavailable", async ({
  page,
}) => {
  const id = crypto.randomUUID();
  /* oxlint-disable eslint/no-await-in-loop -- Navigate and inspect each 404 on the same browser page before the next navigation. */
  for (const path of [`/chat/${id}`, `/share/${id}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  }
  /* oxlint-enable eslint/no-await-in-loop */
  const legacySend = await page.request.post("/api/chat", { data: {} });
  expect(legacySend.status()).toBe(404);
  await Promise.all(
    [
      "getChatById",
      "getChatMessages",
      "getPublicChat",
      "getPublicChatMessages",
    ].map(async (procedure) => {
      const response = await page.request.get(`/api/trpc/chat.${procedure}`, {
        params: { input: JSON.stringify({ json: { chatId: id } }) },
      });
      expect(response.status()).toBe(404);
    })
  );
});

test("ChatJS editor supports Enter, multiline drafts and composition", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error: Readonly<Error>) => errors.push(error.message));
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("keyboard");
  await composer.press("Shift+Enter");
  await composer.press("x");
  await expect(composer).toHaveValue("keyboard\nx");
  await composer.dispatchEvent("keydown", {
    bubbles: true,
    code: "Enter",
    isComposing: true,
    key: "Enter",
    keyCode: 13,
  });
  await expect(page).not.toHaveURL(conversationUrl);
  await composer.fill("keyboard send");
  await composer.press("Enter");
  await expect(page).toHaveURL(conversationUrl);
  await expect(page.getByRole("log")).toContainText("Verified: keyboard send");
  expect(errors).toEqual([]);
});

test("stalled creation shows recovery and retries the retained operation", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const attempts: unknown[] = [];
  const stalled: { promise: Promise<void>; resolve: () => void } =
    Promise.withResolvers();
  await page.route("**/api/agent-conversations", async (route) => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) {
      await stalled.promise;
      await route.abort().catch(() => {
        // The browser may have already closed this request after its timeout.
      });
    } else {
      await route.fulfill({
        json: { error: "Worker is unavailable. Please retry." },
        status: 503,
      });
    }
  });
  try {
    const composer = page.getByRole("textbox", {
      exact: true,
      name: "Message",
    });
    await composer.fill("retained timeout message");
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "The request timed out" })
    ).toContainText("The request timed out", { timeout: 35_000 });
    const recovery = page.getByRole("region", {
      name: "Conversation recovery",
    });
    await expect(recovery).toContainText("retained timeout message");
    const retry = recovery.getByRole("button", { name: "Retry creation" });
    await expect(retry).toBeEnabled();
    await capture(page, "creation-timeout");
    stalled.resolve();
    await retry.click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Worker is unavailable" })
    ).toContainText("Worker is unavailable");
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
  } finally {
    stalled.resolve();
  }
});

test("reload during an accepted turn restores the user message and follows the response", async ({
  page,
}) => {
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  const accepted = page.waitForResponse(
    (response: Readonly<Pick<Response, "request" | "url">>) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/eve/v1/session/")
  );
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("slow reload recovery");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const acceptedTurnResponse = await accepted;
  expect(acceptedTurnResponse.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("log")).toContainText("slow reload recovery");
  await expect(
    page.getByText("Verified: slow reload recovery", { exact: true })
  ).toBeVisible();
});

test("reload before acceptance recovers a late message without resending", async ({
  page,
}) => {
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  const dispatched = page.waitForRequest(
    (request: Readonly<Pick<Request, "method" | "url">>) =>
      request.method() === "POST" &&
      request.url().includes("/api/eve/v1/session/")
  );
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("slow early reload");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await dispatched;
  // Let the request body reach the server while admission is still pending.
  await page.waitForTimeout(500);
  await page.reload();
  await expect(
    page.getByText("Verified: slow early reload", { exact: true })
  ).toBeVisible({ timeout: 30_000 });
  await expect(
    page.getByRole("log").getByText("slow early reload", { exact: true })
  ).toHaveCount(1);
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveValue("");
  await capture(page, "reload-recovered");
});

test("reload retains text when the send never reaches the server", async ({
  page,
}) => {
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  const intercepted = Promise.withResolvers<boolean>();
  await page.route("**/api/eve/v1/session/**", async (route) => {
    if (route.request().method() === "POST") {
      intercepted.resolve(true);
      await delay(5000);
      await route.abort().catch(() => {
        /* Ignore abort errors when the route has already completed. */
      });
    } else {
      await route.continue();
    }
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("retained before delivery");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await intercepted.promise;
  await page.reload();
  const recovery = page
    .getByRole("alert")
    .filter({ hasText: "Message delivery is unconfirmed" });
  await expect(recovery).toContainText("Your draft is saved in this tab.");
  await expect(recovery).toContainText("retained before delivery");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  await capture(page, "reload-unconfirmed");
  await recovery
    .getByRole("button", { exact: true, name: "Restore draft" })
    .click();
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveValue("retained before delivery");
  await expect(recovery).not.toBeVisible();
  await expect(page.getByRole("log")).not.toContainText(
    "retained before delivery"
  );
});
