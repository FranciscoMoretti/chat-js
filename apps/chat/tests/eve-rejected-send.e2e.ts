import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveConversation, userCredit } from "../lib/db/schema";
import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("rejected send survives reload as an unsent draft and can be restored and sent once", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply only with ready.",
      modelId: "openai/gpt-4.1-mini-fast",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const [balance] = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, conversation.ownerId));
  expect(balance).toBeDefined();
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  const unsent = "Reply only with recovered-message-73.";
  try {
    await db
      .update(userCredit)
      .set({ credits: 0 })
      .where(eq(userCredit.userId, conversation.ownerId));
    await composer.fill(unsent);
    const rejected = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/eve/v1/session/${binding.sessionId}`)
    );
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    const response = await rejected;
    expect(response.status()).toBe(402);
    expect(await response.json()).toMatchObject({
      code: "chatjs_command_rejected",
    });
    await expect(
      page.getByText("Message was not sent:", { exact: false })
    ).toBeVisible();
    await expect(
      page.getByText("Message delivery is unconfirmed.", { exact: false })
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { exact: true, name: "Reconnect" })
    ).toHaveCount(0);
    await expect(page.getByRole("log")).not.toContainText(unsent);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("rejected-send.png"),
      style: "nextjs-portal { display: none !important; }",
    });
    await page.reload();
    await expect(
      page.getByText("Message was not sent:", { exact: false })
    ).toBeVisible();
    await expect(page.getByRole("log")).not.toContainText(unsent);
    await expect(
      page.getByRole("button", { exact: true, name: "Reconnect" })
    ).toHaveCount(0);
    await page
      .getByRole("button", { exact: true, name: "Restore draft" })
      .click();
    await expect(composer).toHaveText(unsent);
    await expect(
      page.getByRole("button", { exact: true, name: "Send" })
    ).toBeEnabled();
  } finally {
    await db
      .update(userCredit)
      .set({ credits: balance.credits })
      .where(eq(userCredit.userId, conversation.ownerId));
  }
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page.getByRole("log")).toContainText("recovered-message-73", {
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.getByRole("log").getByText(unsent, { exact: true })
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { exact: true, name: "Restore draft" })
  ).toHaveCount(0);

  // An unmarked upstream error is ambiguous even when its HTTP status is 4xx.
  const commandUrl = new URL(
    `/api/eve/v1/session/${binding.sessionId}`,
    page.url()
  ).href;
  await page.route(commandUrl, (route) =>
    route.fulfill({
      body: JSON.stringify({ error: "Upstream response failed" }),
      contentType: "application/json",
      status: 400,
    })
  );
  await composer.fill("Retain ambiguous delivery");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("Message delivery is unconfirmed.", { exact: false })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Reconnect" })
  ).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("uncertain-send.png"),
    style: "nextjs-portal { display: none !important; }",
  });

  const failedRead = await page.request.get(
    "/api/eve/v1/session/nonexistent-session/stream"
  );
  expect(failedRead.status()).toBe(404);
  expect(await failedRead.json()).not.toHaveProperty("code");
});
