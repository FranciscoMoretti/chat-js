import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import {
  chat,
  eveConversation,
  eveUsage,
  message,
  part,
  project,
  user,
  userCredit,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

const conversationUrl = /\/chat\/[^/]+$/;
const failureMessage = /failure|failed/i;
const connectionFailure = /fetch|failed/i;

async function capture(page: Page, name: string) {
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  await page.screenshot({
    path: `tests/eve-results/screenshots/${name}.png`,
    animations: "disabled",
    style:
      "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility: hidden !important; }",
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Chat", exact: true })
  ).toBeVisible();
});

async function create(page: Page, message: string) {
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
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
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("slow response");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Responding…", { exact: true })).toBeVisible();
  await composer.fill("my next draft");
  await capture(page, "streaming-desktop");
  await expect(
    page.getByText("Verified: slow response", { exact: true })
  ).toBeVisible();
  await expect(composer).toHaveText("my next draft");
  await composer.fill("slow cancel");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true })
  ).toBeEnabled();
  const cancellation = page.waitForResponse((response) =>
    response.url().endsWith("/cancel")
  );
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  expect(await (await cancellation).json()).toMatchObject({
    ok: true,
    status: "accepted",
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await composer.fill("after cancellation");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Verified: after cancellation", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(composer).toHaveText("");
  await capture(page, "conversation-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
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
    await page.getByRole("button", { name: decision, exact: true }).click();
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
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("fail");
  await page.getByRole("button", { name: "Send", exact: true }).click();
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
  await page.getByRole("button", { name: "Send", exact: true }).click();
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
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("retained intent");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: connectionFailure })
  ).toBeVisible();
  await capture(page, "creation-interrupted");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/chat/${acceptedId}`);
  await expect(
    page.getByText("Verified: retained intent", { exact: true })
  ).toBeVisible();

  const origin = new URL(baseURL ?? "http://localhost").origin;
  const rawCreate = await page.request.post("/api/eve/v1/session", {
    headers: { origin },
    data: { message: "bypass" },
  });
  expect(rawCreate.status()).toBe(404);
  const foreign = await page.request.get(
    "/api/eve/v1/session/foreign/stream?includeTailIndex=1"
  );
  expect(foreign.status()).toBe(404);
  const crossOrigin = await page.request.post("/api/agent-conversations", {
    headers: { origin: "https://evil.test" },
    data: { operationId: crypto.randomUUID(), message: "bypass" },
  });
  expect(crossOrigin.status()).toBe(403);
  const invalid = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: { operationId: crypto.randomUUID(), message: " " },
  });
  expect(invalid.status()).toBe(400);
  const anonymous = await browser.newContext({ baseURL });
  try {
    const denied = await anonymous.request.post("/api/agent-conversations", {
      headers: { origin },
      data: { operationId: crypto.randomUUID(), message: "bypass" },
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
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(
      page.getByText("Request declined.", { exact: true })
    ).toBeVisible();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill("cannot start");
    const rejected = page.waitForResponse(
      (response) =>
        response.url().includes("/api/eve/v1/session/") &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
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
      headers: { origin: new URL(baseURL ?? "http://localhost").origin },
      data: {
        operationId: crypto.randomUUID(),
        message: "blocked until reconciled",
      },
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
    .getByRole("link", { name: "New conversation", exact: true })
    .click();
  await expect(page).toHaveURL(new URL("/", conversation).href);
  const search = page.getByRole("textbox", { name: "Search conversations" });
  if (!(await search.isVisible())) {
    const expand = page.getByRole("button", {
      name: "Expand sidebar",
      exact: true,
    });
    if (await expand.isVisible()) {
      await expand.click();
    } else {
      await page
        .getByRole("button", { name: "Toggle Sidebar", exact: true })
        .click();
    }
  }
  await search.fill("sidebar migration check");
  await capture(page, "sidebar-search");
  await page
    .getByRole("link", { name: "sidebar migration check", exact: true })
    .and(page.locator(`[href="${new URL(conversation).pathname}"]`))
    .click();
  await expect(page).toHaveURL(conversation);
  await expect(
    page.getByText("Verified: sidebar migration check", { exact: true })
  ).toBeVisible();
  expect(legacyRequests).toEqual([]);
});

test("existing conversation stays readable without an active legacy runtime", async ({
  page,
}) => {
  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.email, "dev@localhost"));
  if (!owner) {
    throw new Error("Missing development user");
  }
  const id = crypto.randomUUID();
  const messageId = crypto.randomUUID();
  const projectId = crypto.randomUUID();
  await db.insert(project).values({
    id: projectId,
    userId: owner.id,
    name: "Archived project fixture",
  });
  await db.insert(chat).values({
    id,
    userId: owner.id,
    title: "Archived migration fixture",
    projectId,
    createdAt: new Date(),
  });
  await db.insert(message).values({
    id: messageId,
    chatId: id,
    role: "user",
    attachments: [],
    createdAt: new Date(),
  });
  await db.insert(part).values({
    messageId,
    type: "text",
    text_text: "Preserved historical message",
  });
  try {
    await page.goto(`/chat/${id}`);
    await expect(
      page.getByText("Preserved historical message", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Message", exact: true })
    ).toHaveCount(0);
    await capture(page, "archived-conversation");
    await page.goto(`/project/${projectId}/chat/${id}`);
    await expect(page).toHaveURL(new RegExp(`/chat/${id}$`));
    await expect(
      page.getByText("Preserved historical message", { exact: true })
    ).toBeVisible();
    expect((await page.request.post("/api/chat", { data: {} })).status()).toBe(
      410
    );
    await page.goto(`/project/${projectId}`);
    await expect(
      page.getByRole("heading", {
        name: "Archived project fixture",
        exact: true,
      })
    ).toBeVisible();
    await capture(page, "archived-project");
  } finally {
    await db.delete(chat).where(eq(chat.id, id));
    await db.delete(project).where(eq(project.id, projectId));
  }
});

test("ChatJS editor supports Enter, multiline drafts and composition", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("keyboard");
  await composer.press("Shift+Enter");
  await composer.press("x");
  await expect(composer).toHaveText("keyboard\nx", { useInnerText: true });
  await composer.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    isComposing: true,
    bubbles: true,
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
        status: 503,
        json: { error: "Worker is unavailable. Please retry." },
      });
    }
  });
  try {
    const composer = page.getByRole("textbox", {
      name: "Message",
      exact: true,
    });
    await composer.fill("retained timeout message");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "The request timed out" })
    ).toContainText("The request timed out", { timeout: 35_000 });
    await expect(composer).toBeEditable();
    await expect(composer).toHaveText("retained timeout message");
    await capture(page, "creation-timeout");
    release?.();
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Worker is unavailable" })
    ).toContainText("Worker is unavailable");
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toEqual(attempts[0]);
  } finally {
    release?.();
  }
});
