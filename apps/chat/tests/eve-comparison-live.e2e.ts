import { expect, test } from "@playwright/test";

import { env } from "../lib/env";
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
  expect(first.sessionId).not.toBe(second.sessionId);
  await page.context().addCookies([
    {
      name: "chat-model",
      url: new URL(page.url()).origin,
      value: "openai/gpt-5-mini",
    },
  ]);
  await page.goto(`/chat/${first.conversationId}`);
  await expect(page.getByTestId("model-selector")).toContainText("GPT-5 mini");
  await expect(page.getByText(marker, { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("log").getByText(message, { exact: true })
  ).toHaveCount(1);
  await page
    .getByLabel("Message", { exact: true })
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
  await expect(page.getByText(marker, { exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("log").getByText(message, { exact: true })
  ).toHaveCount(1);
  await expect(page.getByLabel("Message", { exact: true })).toHaveText(
    "Keep this unsent comparison follow-up"
  );
  await expect(page.getByTestId("model-selector")).toContainText(
    "Gemini 2.5 Flash Lite"
  );
  await page.reload();
  await expect(page.getByTestId("model-selector")).toContainText(
    "Gemini 2.5 Flash Lite"
  );
  await expect(page.getByText(marker, { exact: true })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Message", { exact: true })).toHaveText(
    "Keep this unsent comparison follow-up"
  );
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("native-comparison.png"),
  });
  await page.getByLabel("Message", { exact: true }).fill("");
});
