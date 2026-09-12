import { expect, test } from "@playwright/test";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("selected Canvas excludes application tools and a later automatic turn restores them", async ({
  page,
}) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const origin = new URL(page.url()).origin;
  const operation = {
    operationId: crypto.randomUUID(),
    modelId: "google/gemini-2.5-flash",
    selectedTool: "createTextDocument",
    message:
      'Use wordCount to count "one two three four", then create a text document titled "Tool selection fixture" containing "Four words". If wordCount is unavailable, create the document directly. Finish briefly.',
  };
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: operation,
  });
  expect(created.status()).toBe(200);
  const binding = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  await expect(
    page.getByRole("button", {
      name: 'Created "Tool selection fixture"',
      exact: true,
    })
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Words", { exact: true })).toHaveCount(0);
  const conflict = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: { ...operation, selectedTool: "webSearch" },
  });
  expect(conflict.status()).toBe(409);
  const replay = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: operation,
  });
  expect(replay.status()).toBe(200);
  expect(conversationBinding.parse(await replay.json())).toEqual(binding);
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: 'Created "Tool selection fixture"',
      exact: true,
    })
  ).toBeVisible();
  const followup = await page.request.post(
    `/api/eve/v1/session/${binding.sessionId}`,
    {
      headers: { origin },
      data: {
        modelId: operation.modelId,
        message:
          'Use wordCount to count "one two three four" and report "4 words". Do not create or edit documents.',
      },
      timeout: 90_000,
    }
  );
  expect(followup.ok()).toBe(true);
  // This command bypassed the composer; reconnect the page to observe its turn.
  await page.reload();
  await expect(page.getByText("Words", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
});
