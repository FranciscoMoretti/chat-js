/* oxlint-disable eslint/no-promise-executor-return -- These Promise executors directly register callback APIs whose return values are ignored. */
/* oxlint-disable eslint/no-shadow -- Nested callback names mirror the protocol fields and transaction APIs under test. */
/* oxlint-disable promise/avoid-new -- These fixtures adapt callback, timer, stream, or browser event APIs into awaited Promises. */
/* oxlint-disable unicorn/prefer-ternary -- Explicit branches make stateful route behavior and cleanup order visible. */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveConversation, eveUsage, user, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

const conversationUrl = /\/chat\/[^/]+$/u;
const failureMessage = /failure|failed/iu;
const connectionFailure = /fetch|failed/iu;

async function capture(page: Page, name: string) {
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  await page.screenshot({
    animations: "disabled",
    path: `tests/eve-results/screenshots/${name}.png`,
    style:
      "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility: hidden !important; }",
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { exact: true, name: "Chat" })
  ).toBeVisible();
});

async function create(page: Page, message: string) {
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(message);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page).toHaveURL(conversationUrl);
}

test("native transcript survives reload; streaming preserves the next draft; cancellation permits another send", async ({
  page,
}) => {
  // This scenario includes four durable turns and reloads over the remote test DB.
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
  await expect(composer).toHaveText("", { timeout: 1000 });
  await composer.fill("my next draft");
  await capture(page, "streaming-desktop");
  await expect(
    page.getByText("Verified: slow response", { exact: true })
  ).toBeVisible();
  await expect(composer).toHaveText("my next draft");
  await composer.fill("slow cancel");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Stop" })
  ).toBeEnabled();
  const cancellation = page.waitForResponse((response) =>
    response.url().endsWith("/cancel")
  );
  await page.getByRole("button", { exact: true, name: "Stop" }).click();
  expect(await (await cancellation).json()).toMatchObject({
    ok: true,
    status: "accepted",
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await composer.fill("after cancellation");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("Verified: after cancellation", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(composer).toHaveText("");
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
});

for (const decision of ["Approve", "Cancel"]) {
  test(`pending tool survives reload and ${decision.toLowerCase()} completes`, async ({
    page,
  }) => {
    await create(page, "confirm release");
    await expect(
      page.getByText("Waiting for your input", { exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Waiting for your input", { exact: true })
    ).toBeVisible();
    await capture(page, `approval-${decision.toLowerCase()}`);
    await page.getByRole("button", { exact: true, name: decision }).click();
    await expect(
      page.getByText("Approval handled.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(
        decision === "Approve" ? "Note confirmed." : "Request declined.",
        { exact: true }
      )
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
  await expect(
    page.getByRole("alert").filter({ hasText: failureMessage })
  ).toBeVisible();
  await expect(composer).toHaveText("fail");
  await capture(page, "failed-turn");
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: failureMessage })
  ).toBeVisible();
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
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page).toHaveURL(`${baseURL}/chat/${acceptedId}`);
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
    page.getByText("Waiting for your input", { exact: true })
  ).toBeVisible();
  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.email, "dev@localhost"));
  if (!owner) {
    throw new Error("Missing development user.");
  }
  const [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, owner.id));
  if (!balance) {
    throw new Error("Missing credit balance.");
  }
  try {
    await db
      .update(userCredit)
      .set({ credits: 0 })
      .where(eq(userCredit.userId, owner.id));
    await page.reload();
    await page.getByRole("button", { exact: true, name: "Cancel" }).click();
    await expect(
      page.getByText("Request declined.", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("cannot start");
    const rejected = page.waitForResponse(
      (response) =>
        response.url().includes("/api/eve/v1/session/") &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    expect((await rejected).status()).toBe(402);
  } finally {
    await db
      .update(userCredit)
      .set({ credits: balance.credits })
      .where(eq(userCredit.userId, owner.id));
  }
});

test("unknown completed usage prevents new admission until its cost is reconciled", async ({
  page,
  baseURL,
}) => {
  await create(page, "known zero-cost fixture");
  await expect(
    page.getByText("Verified: known zero-cost fixture", { exact: true })
  ).toBeVisible();
  const id = new URL(page.url()).pathname.split("/").at(-1);
  if (!id) {
    throw new Error("Missing conversation identity.");
  }
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, id));
  if (!conversation?.sessionId) {
    throw new Error("Missing session binding.");
  }
  const [usage] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.sessionId, conversation.sessionId));
  if (!usage) {
    throw new Error("Missing fixture usage.");
  }
  try {
    await db
      .update(eveUsage)
      .set({ costUsd: null })
      .where(eq(eveUsage.eventId, usage.eventId));
    const response = await page.request.post("/api/agent-conversations", {
      data: {
        message: "blocked until reconciled",
        operationId: crypto.randomUUID(),
      },
      headers: { origin: new URL(baseURL ?? "http://localhost").origin },
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({
      error:
        "Usage reconciliation is unavailable. Try again before starting a new conversation.",
    });
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
  page.on("request", (request) => {
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
  await page
    .getByRole("link", { exact: true, name: "New conversation" })
    .click();
  await expect(page).toHaveURL(new URL("/", conversation).href);
  const search = page.getByRole("textbox", { name: "Search conversations" });
  if (!(await search.isVisible())) {
    const expand = page.getByRole("button", {
      exact: true,
      name: "Expand sidebar",
    });
    if (await expand.isVisible()) {
      await expand.click();
    } else {
      await page
        .getByRole("button", { exact: true, name: "Toggle Sidebar" })
        .click();
    }
  }
  await search.fill("sidebar migration check");
  await capture(page, "sidebar-search");
  await page
    .getByRole("link", { exact: true, name: "sidebar migration check" })
    .and(page.locator(`[href="${new URL(conversation).pathname}"]`))
    .click();
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
  for (const path of [`/chat/${id}`, `/share/${id}`]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  }
  const legacySend = await page.request.post("/api/chat", { data: {} });
  expect(legacySend.status()).toBe(404);
  for (const procedure of [
    "getChatById",
    "getChatMessages",
    "getPublicChat",
    "getPublicChatMessages",
  ]) {
    const response = await page.request.get(`/api/trpc/chat.${procedure}`, {
      params: { input: JSON.stringify({ json: { chatId: id } }) },
    });
    expect(response.status()).toBe(404);
  }
});

test("ChatJS editor supports Enter, multiline drafts and composition", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("keyboard");
  await composer.press("Shift+Enter");
  await composer.press("x");
  await expect(composer).toHaveText("keyboard\nx", { useInnerText: true });
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

test("stalled creation releases the composer and retries the retained operation", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const attempts: unknown[] = [];
  let release: (() => void) | undefined;
  const stalled = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/agent-conversations", async (route) => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) {
      await stalled;
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
    await expect(composer).toBeEditable();
    await expect(composer).toHaveText("retained timeout message");
    await capture(page, "creation-timeout");
    release?.();
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Worker is unavailable" })
    ).toContainText("Worker is unavailable");
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
  } finally {
    release?.();
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
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/eve/v1/session/")
  );
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("slow reload recovery");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  expect((await accepted).ok()).toBe(true);
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
    (request) =>
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
  ).toHaveText("");
  await capture(page, "reload-recovered");
});

test("reload retains text when the send never reaches the server", async ({
  page,
}) => {
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  await page.route("**/api/eve/v1/session/**", async (route) => {
    if (route.request().method() === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await route.abort().catch(() => {
        /* empty */
      });
    } else {
      await route.continue();
    }
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("retained before delivery");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await page.reload();
  await expect(
    page.getByText(
      "Message delivery is unconfirmed. Your text is saved in this tab."
    )
  ).toBeVisible();
  await expect(
    page.getByText("retained before delivery", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  await capture(page, "reload-unconfirmed");
  await page
    .getByRole("button", { exact: true, name: "Restore draft" })
    .click();
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveText("retained before delivery");
  await expect(
    page.getByRole("alert").filter({ hasText: "Delivery is unconfirmed" })
  ).toBeVisible();
});
