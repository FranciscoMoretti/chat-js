import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";
import { db } from "../lib/db/client";
import { eveConversation } from "../lib/db/schema";
import { env } from "../lib/env";
import { evePlatformResult } from "../lib/eve/platform-result";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
test("native image generation renders the stored image and survives reload", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin: new URL(page.url()).origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-4.1-mini-fast",
      message:
        'Use generateImage exactly once with prompt "A solid blue square on a white background". No other tools.',
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  await page.goto(`/chat/${binding.id}`);
  const image = page.locator('img[src*="/api/files/content?"]').first();
  await expect(image).toBeVisible({ timeout: 150_000 });
  await expect
    .poll(() =>
      image.evaluate(
        (element) =>
          element instanceof HTMLImageElement && element.naturalWidth > 0
      )
    )
    .toBe(true);
  const src = await image.getAttribute("src");
  await page.reload();
  await expect(image).toHaveAttribute("src", src ?? "");
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (element) =>
          element instanceof HTMLImageElement && element.naturalWidth > 0
      )
    )
    .toBe(true);
  const [conversation] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, binding.id));
  const client = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": conversation.ownerId },
  });
  const snapshot = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const results = snapshot.events.filter(
    (event) =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "generateImage"
  );
  expect(results).toHaveLength(1);
  const result = results[0];
  if (
    result.type !== "action.result" ||
    result.data.result.kind !== "tool-result"
  ) {
    throw new Error("Missing native image result");
  }
  const receipt = evePlatformResult.parse(result.data.result.output);
  expect(receipt.output).toMatchObject({ imageUrl: src });
  expect(receipt.usage.costUsd).toBeGreaterThan(0);
  await image.screenshot({
    path: "tests/eve-results/screenshots/eve-native-image.png",
    animations: "disabled",
  });
});
