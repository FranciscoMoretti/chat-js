/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveConversation, eveGuest } from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { ANONYMOUS_LIMITS } from "../lib/types/anonymous";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("guest edits, regenerates and deletes its complete conversation family", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-5-nano" },
  });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toBeVisible();
  const { origin } = new URL(page.url());
  const principal = await page.request.post("/api/eve-guest", {
    headers: { origin },
  });
  const { ownerId } = await principal.json();
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply with the single word amber.",
      modelId: "openai/gpt-5-nano",
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(created.status(), await created.text()).toBe(200);
  const source = conversationBinding.parse(await created.json());
  try {
    await page.goto(`/chat/${source.id}`);
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
      "amber"
    );
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .click();
    const editor = page.getByRole("dialog");
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill("Reply with the single word cobalt.");
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page).not.toHaveURL(
      new URL(`/chat/${source.id}`, origin).href,
      {
        timeout: 60_000,
      }
    );
    const editedUrl = page.url();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
      "cobalt"
    );
    await expect(
      page.getByRole("combobox", { name: "Conversation version" })
    ).toContainText("Version 2");
    await page.reload();
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await page
      .getByRole("button", { exact: true, name: "Regenerate response" })
      .click();
    await expect(page).not.toHaveURL(editedUrl, { timeout: 60_000 });
    await expect(page.getByText("Ready", { exact: true })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
      "cobalt"
    );
    await expect(
      page.getByRole("combobox", { name: "Conversation version" })
    ).toContainText("Version 3");
    const family = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.ownerId, ownerId));
    expect(family).toHaveLength(3);
    const [guest] = await db
      .select()
      .from(eveGuest)
      .where(eq(eveGuest.ownerId, ownerId));
    expect(guest.remainingMessages).toBe(ANONYMOUS_LIMITS.CREDITS - 3);
    const outsider = await browser.newContext();
    try {
      await outsider.request.post(`${origin}/api/eve-guest`, {
        headers: { origin },
      });
      expect(
        (
          await outsider.request.delete(
            `${origin}/api/agent-conversations/${source.id}`,
            { headers: { origin } }
          )
        ).status()
      ).toBe(404);
    } finally {
      await outsider.close();
    }
    await page
      .getByRole("link", { exact: true, name: "Original conversation" })
      .click();
    await expect(page.getByRole("log")).toContainText("amber");
    await expect(page.getByRole("log")).not.toContainText("cobalt");
    await page.request.post("/api/trpc/eve.rename", {
      data: { json: { id: source.id, title: "Guest lifecycle" } },
    });
    await page.reload();
    const expand = page.getByRole("button", {
      exact: true,
      name: "Expand sidebar",
    });
    if (await expand.isVisible()) {
      await expand.click();
    }
    const row = page.locator("li").filter({
      has: page.getByRole("link", { exact: true, name: "Guest lifecycle" }),
    });
    await row.hover();
    await row.getByRole("button", { exact: true, name: "More" }).click();
    await page.getByRole("menuitem", { exact: true, name: "Delete" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("all its branches");
    await dialog.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("guest-family-delete.png"),
    });
    const deleted = page.waitForResponse(
      (response) =>
        response.request().method() === "DELETE" &&
        response.url().endsWith(`/api/agent-conversations/${source.id}`),
      { timeout: 90_000 }
    );
    await dialog
      .getByRole("button", {
        exact: true,
        name: "Delete conversation and branches",
      })
      .click();
    expect((await deleted).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(
      page.getByRole("link", { exact: true, name: "Guest lifecycle" })
    ).toHaveCount(0);
    const removed = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.ownerId, ownerId));
    expect(removed).toHaveLength(3);
    expect(removed.every((entry) => entry.state === "deleted")).toBe(true);
    for (const conversation of family) {
      expect(
        (
          await page.request.get(
            `/api/eve/v1/session/${conversation.sessionId}/stream`
          )
        ).status()
      ).toBe(404);
    }
  } finally {
    testInfo.setTimeout(testInfo.timeout + 90_000);
    await expect
      .poll(
        async () => {
          const response = await page.request.delete(
            `/api/agent-conversations/${source.id}`,
            { headers: { origin }, timeout: 15_000 }
          );
          return [200, 404].includes(response.status());
        },
        {
          intervals: [1000, 2000, 5000],
          message: "Guest fixture family cleanup must complete",
          timeout: 90_000,
        }
      )
      .toBe(true);
  }
});
