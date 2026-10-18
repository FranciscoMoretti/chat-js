import { expect, test } from "@playwright/test";
import {
  createConversationInput,
  conversationBinding,
} from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";
import type { Page, Response } from "@playwright/test";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

const prompt = (word: string): string =>
  `Reply with exactly ${word}. Do not use tools.`;
const users = (page: Page) => page.getByRole("log").locator(".is-user");
const assistants = (page: Page) =>
  page.getByRole("log").locator(".is-assistant");
const ready = async (page: Page): Promise<void> => {
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByText("Creating response…", { exact: true })
  ).toHaveCount(0);
};
const send = async (page: Page, word: string): Promise<void> => {
  const composer = page
    .getByRole("group", { name: "Message composer", exact: true })
    .last();
  await composer
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(prompt(word));
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(assistants(page).last()).toContainText(word, {
    timeout: 60_000,
  });
  await ready(page);
};
const edit = async (
  page: Page,
  index: number,
  word: string
): Promise<Response> => {
  await page
    .getByRole("button", { name: "Edit message", exact: true })
    .nth(index)
    .click();
  const editor = page
    .getByRole("log")
    .getByRole("group", { name: "Message composer", exact: true });
  await editor
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(prompt(word));
  const accepted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/agent-conversations") &&
      response.request().method() === "POST"
  );
  await editor.getByRole("button", { name: "Send", exact: true }).click();
  const response = await accepted;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(assistants(page).last()).toContainText(word, {
    timeout: 60_000,
  });
  await ready(page);
  return response;
};

test("branch boundaries survive edits, regeneration, reload and multiple tabs without idle stream starvation", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", {
    data: { model: "openai/gpt-4.1-mini" },
  });
  await page.goto("/");
  await send(page, "amber");
  await send(page, "cobalt");
  await send(page, "violet");
  const url = page.url();
  await edit(page, 2, "indigo");
  await expect(users(page)).toHaveCount(3);
  await expect(users(page).nth(1)).toContainText("cobalt");
  await expect(page.getByRole("log")).not.toContainText("violet");
  await edit(page, 1, "jade");
  await expect(users(page)).toHaveCount(2);
  await expect(users(page).first()).toContainText("amber");
  await expect(page.getByRole("log")).not.toContainText("cobalt");
  await expect(page.getByRole("log")).not.toContainText("violet");
  await expect(
    users(page)
      .nth(1)
      .getByRole("button", { name: "Previous version", exact: true })
  ).toBeEnabled();
  await users(page)
    .nth(1)
    .getByRole("button", { name: "Previous version", exact: true })
    .click();
  await expect(users(page)).toHaveCount(3);
  await expect(users(page).last()).toContainText("indigo");
  await users(page)
    .nth(1)
    .getByRole("button", { name: "Next version", exact: true })
    .click();
  await expect(users(page)).toHaveCount(2);
  await page
    .getByRole("button", { name: "Regenerate response", exact: true })
    .first()
    .click();
  await expect(users(page)).toHaveCount(1, { timeout: 60_000 });
  await ready(page);
  await expect(assistants(page)).toHaveCount(1);
  await expect(
    assistants(page)
      .first()
      .getByRole("button", { name: "Previous version", exact: true })
  ).toBeEnabled();
  await page.reload();
  await ready(page);
  await expect(users(page)).toHaveCount(1);
  const other = await context.newPage();
  await other.goto(url);
  await ready(other);
  await edit(page, 0, "saffron");
  await expect(users(page)).toHaveCount(1);
  await expect(page.getByRole("log")).not.toContainText("amber");
  const accepted = await edit(page, 0, "silver");
  const operation = createConversationInput.parse(
    accepted.request().postDataJSON()
  );
  const binding = conversationBinding.parse(await accepted.json());
  const headers = { origin: new URL(page.url()).origin };
  const replay = await page.request.post("/api/agent-conversations", {
    headers,
    data: operation,
  });
  expect(conversationBinding.parse(await replay.json())).toEqual(binding);
  const changed = await page.request.post("/api/agent-conversations", {
    headers,
    data: {
      ...operation,
      fork: { ...operation.fork, beforeMessageId: "different-message" },
    },
  });
  expect(changed.status()).toBe(409);
  await expect(users(page)).toHaveCount(1);
  expect(page.url()).toBe(url);
  await page.reload();
  await ready(page);
  await expect(users(page).first()).toContainText("silver");
  await other.close();
  await page
    .getByRole("button", { name: "Edit message", exact: true })
    .first()
    .click();
  const editor = page
    .getByRole("log")
    .getByRole("group", { name: "Message composer", exact: true });
  await editor
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(prompt("recovered"));
  let lostBinding: ReturnType<typeof conversationBinding.parse> | undefined;
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      lostBinding = conversationBinding.parse(await response.json());
      await route.abort("failed");
    },
    { times: 1 }
  );
  await editor.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Recover version", exact: true })
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Recover version", exact: true })
  ).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("button", { name: "Recover version", exact: true })
    .click();
  await expect(assistants(page).last()).toContainText("recovered", {
    timeout: 60_000,
  });
  await ready(page);
  await expect(users(page)).toHaveCount(1);
  expect(lostBinding).toBeDefined();
});
