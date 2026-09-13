import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation } from "../lib/db/schema";
import { env } from "../lib/env";
import {
  conversationBinding,
  createConversationInput,
} from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const originalModel = "google/gemini-2.5-flash-lite";
const selectedModel = "google/gemini-2.5-flash";
const answer = /^provenance-ready\.?$/iu;

test("copied responses regenerate with their original model after reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(120_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.request.get("/api/dev-login", { maxRedirects: 0 });
  await page.request.post("/api/chat-model", {
    data: { model: originalModel },
  });
  const { origin } = new URL(z.url().parse(testInfo.project.use.baseURL));
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply exactly provenance-ready. Do not call tools.",
      modelId: originalModel,
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(created.status()).toBe(200);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(page.getByRole("log").getByText(answer)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, source.id));
  const copyInput = {
    modelId: selectedModel,
    operationId: crypto.randomUUID(),
    sourceConversationId: source.id,
  };
  let copied = await page.request.post("/api/agent-conversation-copies", {
    data: copyInput,
    headers: { origin },
  });
  await expect
    .poll(
      async () => {
        if (copied.status() === 503) {
          copied = await page.request.post("/api/agent-conversation-copies", {
            data: copyInput,
            headers: { origin },
          });
        }
        return copied.status();
      },
      { intervals: [1000, 2000, 4000], timeout: 45_000 }
    )
    .toBe(200);
  const destination = conversationBinding.parse(await copied.json());
  await page.request.post("/api/chat-model", {
    data: { model: selectedModel },
  });
  await page.goto(`/chat/${destination.id}`);
  await expect(page.getByRole("log").getByText(answer)).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await expect(page.getByRole("log").getByText(answer)).toBeVisible();
  const regenerate = page.getByRole("button", {
    exact: true,
    name: "Regenerate response",
  });
  await expect(regenerate).toBeEnabled();
  await page.getByRole("log").screenshot({
    animations: "disabled",
    path: testInfo.outputPath("imported-regeneration.png"),
  });
  let regenerated: z.infer<typeof conversationBinding> | undefined;
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      const input = createConversationInput.parse(
        route.request().postDataJSON()
      );
      expect(input.fork).toEqual({
        beforeMessageId: "seed_message_0",
        conversationId: destination.id,
      });
      expect(input.modelId).toBe(originalModel);
      const response = await route.fetch({ timeout: 90_000 });
      expect(response.status()).toBe(200);
      regenerated = conversationBinding.parse(await response.json());
      await route.fulfill({ response });
    },
    { times: 1 }
  );
  await regenerate.click();
  await expect.poll(() => regenerated?.id, { timeout: 95_000 }).toBeTruthy();
  await expect(page).toHaveURL(`${origin}/chat/${regenerated?.id}`);
  await expect(page.getByRole("log").getByText(answer)).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByRole("button", { exact: true, name: "Regenerate response" })
  ).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("log").getByText(answer)).toBeVisible({
    timeout: 30_000,
  });
});
