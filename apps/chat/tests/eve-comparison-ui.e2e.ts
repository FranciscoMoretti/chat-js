/* oxlint-disable unicorn/no-await-expression-member -- Each response assertion is tied to its awaited browser action. */
import { expect, test } from "@playwright/test";

import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";

const nano = /GPT-5 Nano/iu;

test("nested comparisons retain both groups, duplicate-model slots and retry attempts under one chat URL", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  const response = await page.request.post("/api/agent-response-groups", {
    data: {
      message: "Do not use tools. Reply with exactly amber.",
      modelIds: ["openai/gpt-5-nano", "openai/gpt-5-nano"],
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
    timeout: 90_000,
  });
  expect(response.ok(), await response.text()).toBe(true);
  const group = eveResponseGroupResult.parse(await response.json());
  const [first] = group.candidates;
  if (first.state !== "bound") {
    throw new Error("First candidate did not bind");
  }
  await page.goto(`/chat/${first.conversationId}`);
  const cards = page.getByRole("log").getByRole("button", { name: nano });
  await expect(cards).toHaveCount(2);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const url = page.url();
  const composer = page.getByRole("group", {
    exact: true,
    name: "Message composer",
  });
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Keep my unsent draft");
  await cards.first().click();
  await cards.last().click();
  expect(page.url()).toBe(url);
  await expect(
    composer.getByRole("textbox", { exact: true, name: "Message" })
  ).toHaveText("Keep my unsent draft");
  await cards.first().click();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const checkpointId = crypto.randomUUID();
  const checkpoint = await page.request.post(
    `/api/agent-conversations/${first.conversationId}/checkpoint`,
    {
      data: { beforeTurnId: "turn_1", checkpointId },
      headers: { origin },
      timeout: 45_000,
    }
  );
  expect(checkpoint.ok(), await checkpoint.text()).toBe(true);
  const later = await page.request.post("/api/agent-response-groups", {
    data: {
      fork: {
        beforeTurnId: "turn_1",
        checkpointId,
        conversationId: first.conversationId,
      },
      message: "Do not use tools. Reply with exactly cobalt.",
      modelIds: ["openai/gpt-5-nano", "openai/gpt-5-nano"],
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
    timeout: 90_000,
  });
  expect(later.ok(), await later.text()).toBe(true);
  await page.reload();
  await expect(cards).toHaveCount(4, { timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("log")).toContainText("exactly cobalt");
  expect(page.url()).toBe(url);
  await composer
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("");
  const retry = page.waitForResponse(
    (value) =>
      value.url().endsWith("/api/agent-conversations") &&
      value.request().method() === "POST"
  );
  await page.getByRole("button", { exact: true, name: "Retry" }).last().click();
  expect((await retry).ok()).toBe(true);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(cards).toHaveCount(4);
  expect(page.url()).toBe(url);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("nested-comparisons.png"),
  });
  await page
    .getByRole("button", { exact: true, name: "Edit message" })
    .last()
    .click();
  const editor = page
    .getByRole("log")
    .getByRole("group", { exact: true, name: "Message composer" });
  await editor
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Do not use tools. Reply with exactly jade.");
  const editedGroup = page.waitForResponse(
    (value) =>
      value.url().endsWith("/api/agent-response-groups") &&
      value.request().method() === "POST"
  );
  await editor.getByRole("button", { exact: true, name: "Send" }).click();
  const edited = await editedGroup;
  expect(edited.ok(), await edited.text()).toBe(true);
  expect(
    eveResponseGroupResult.parse(await edited.json()).candidates
  ).toHaveLength(2);
  await expect(page.getByRole("log")).toContainText("exactly jade");
  await expect(cards).toHaveCount(4);
  expect(page.url()).toBe(url);
});
