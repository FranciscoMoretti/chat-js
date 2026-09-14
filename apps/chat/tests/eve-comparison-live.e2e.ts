import { expect, test } from "@playwright/test";

import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { eveResponseGroupResult } from "../lib/eve/response-group-contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);

test("two cheap native responses bind, render, and preserve an unsent draft while switching", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const marker = `comparison-${crypto.randomUUID().slice(0, 8)}`;
  const message = `Reply with exactly ${marker}. Do not call tools.`;
  const response = await page.request.post("/api/agent-response-groups", {
    data: {
      message,
      modelIds: [
        "google/gemini-2.5-flash-lite",
        "google/gemini-2.5-flash-lite",
      ],
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
    timeout: 90_000,
  });
  expect(response.status()).toBe(200);
  const group = eveResponseGroupResult.parse(await response.json());
  expect(group.candidates.map((candidate) => candidate.state)).toEqual([
    "bound",
    "bound",
  ]);
  const [first, second] = group.candidates;
  if (first.state !== "bound" || second.state !== "bound") {
    throw new Error("Native comparison did not bind both candidates.");
  }
  try {
    expect(first.sessionId).not.toBe(second.sessionId);
    await page.context().addCookies([
      {
        name: "chat-model",
        url: new URL(page.url()).origin,
        value: "openai/gpt-5-mini",
      },
    ]);
    await page.goto(`/chat/${first.conversationId}`);
    const activeChat = page.locator(
      'a[data-sidebar="menu-button"][data-active="true"]'
    );
    await expect(activeChat).toHaveCount(1);
    const chatHref = await activeChat.getAttribute("href");
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText("GPT-5 mini");
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
    await page
      .getByLabel("Message", { exact: true })
      .filter({ visible: true })
      .fill("Keep this unsent comparison follow-up");
    await page
      .getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
      .click();
    await expect(page).toHaveURL(
      new URL(`/chat/${second.conversationId}`, page.url()).href
    );
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible({
      timeout: 60_000,
    });
    await expect(
      page.getByRole("log").getByText(message, { exact: true })
    ).toHaveCount(1);
    await expect(
      page.getByLabel("Message", { exact: true }).filter({ visible: true })
    ).toHaveText("Keep this unsent comparison follow-up");
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText("Gemini 2.5 Flash Lite");
    await expect(activeChat).toHaveCount(1);
    await expect(activeChat).toHaveAttribute("href", chatHref ?? "");
    await page.reload();
    await expect(
      page.getByTestId("model-selector").filter({ visible: true })
    ).toContainText("Gemini 2.5 Flash Lite");
    await expect(
      page.getByText(marker, { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(
      page.getByLabel("Message", { exact: true }).filter({ visible: true })
    ).toHaveText("Keep this unsent comparison follow-up");
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("native-comparison.png"),
    });
    await page
      .getByLabel("Message", { exact: true })
      .filter({ visible: true })
      .fill("");
    // Retry belongs to the same model card even though EVE creates another session.
    const regenerationResponse = page.waitForResponse(
      (result) =>
        result.url().endsWith("/api/agent-conversations") &&
        result.request().method() === "POST"
    );
    await page
      .getByRole("log")
      .getByRole("button", { exact: true, name: "Retry" })
      .click();
    const regeneration = await regenerationResponse;
    expect(regeneration.ok()).toBe(true);
    expect(regeneration.request().postDataJSON().forkKind).toBe("regenerate");
    const retry = conversationBinding.parse(await regeneration.json());
    await expect(page).toHaveURL(new URL(`/chat/${retry.id}`, page.url()).href);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    const userRow = page.getByRole("log").locator(".is-user");
    await expect(
      userRow.getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
    ).toHaveCount(1);
    await userRow
      .getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
      .click();
    await expect(page).toHaveURL(
      new URL(`/chat/${first.conversationId}`, page.url()).href
    );
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await userRow
      .getByRole("button", {
        exact: true,
        name: "Gemini 2.5 Flash Lite Open response",
      })
      .click();
    await expect(page).toHaveURL(new URL(`/chat/${retry.id}`, page.url()).href);
    await expect(
      page.getByText("Ready", { exact: true }).filter({ visible: true })
    ).toBeVisible();
    await expect(userRow).toHaveCount(1);
    await expect(
      page.getByRole("button", { exact: true, name: "Previous version" })
    ).toHaveCount(0);
  } finally {
    testInfo.setTimeout(testInfo.timeout + 150_000);
    // Both comparison roots belong to one logical chat and are deleted together.
    await expect
      .poll(
        async () => {
          const deletion = await page.request.delete(
            `/api/agent-conversations/${first.conversationId}`,
            {
              headers: { origin: new URL(page.url()).origin },
              timeout: 30_000,
            }
          );
          expect([200, 202]).toContain(deletion.status());
          return deletion.status();
        },
        { intervals: [1000, 2000], timeout: 120_000 }
      )
      .toBe(200);
  }
});
