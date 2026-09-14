import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import {
  eveConversation,
  eveFileReference,
  eveStoredFile,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { evePlatformResult } from "../lib/eve/platform-result";
import { keyFromFileUrl } from "../lib/file-url";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
test("native image generation, editing and sharing preserve stored results", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        'Use generateImage exactly once with prompt "A solid blue square on a white background". No other tools.',
      modelId: "openai/gpt-4.1-mini-fast",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
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
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": conversation.ownerId },
    host: env.EVE_INTERNAL_ORIGIN ?? "",
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
  const [result] = results;
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
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-native-image.png",
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page
    .locator('[aria-label="Message"]')
    .fill(
      "Use generateImage exactly once to edit the image you just generated: change the blue square to green and keep the white background."
    );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const images = page.locator('img[src*="/api/files/content?"]');
  await expect(images).toHaveCount(2, { timeout: 150_000 });
  const edited = images.nth(1);
  await expect
    .poll(() =>
      edited.evaluate(
        (element) =>
          element instanceof HTMLImageElement && element.naturalWidth > 0
      )
    )
    .toBe(true);
  const editedSrc = await edited.getAttribute("src");
  expect(editedSrc).not.toBe(src);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.reload();
  await expect(images).toHaveCount(2);
  await expect(images.nth(0)).toHaveAttribute("src", src ?? "");
  await expect(images.nth(1)).toHaveAttribute("src", editedSrc ?? "");
  await expect
    .poll(() =>
      edited.evaluate(
        (element) =>
          element instanceof HTMLImageElement && element.naturalWidth > 0
      )
    )
    .toBe(true);
  await edited.screenshot({
    animations: "disabled",
    path: "tests/eve-results/screenshots/eve-native-image-edited.png",
  });
  const afterEdit = await client.sessions
    .attach(binding.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const imageResults = afterEdit.events.filter(
    (event) =>
      event.type === "action.result" &&
      event.data.result.kind === "tool-result" &&
      event.data.result.toolName === "generateImage"
  );
  expect(imageResults).toHaveLength(2);
  const registered = await db
    .select({ key: eveFileReference.key, ownerId: eveStoredFile.ownerId })
    .from(eveFileReference)
    .innerJoin(eveStoredFile, eq(eveStoredFile.key, eveFileReference.key))
    .where(eq(eveFileReference.conversationId, binding.id));
  expect(registered.map((file) => file.key).toSorted()).toEqual(
    [keyFromFileUrl(src ?? ""), keyFromFileUrl(editedSrc ?? "")].toSorted()
  );
  expect(
    registered.every((file) => file.ownerId === conversation.ownerId)
  ).toBe(true);
  for (const event of imageResults) {
    if (
      event.type !== "action.result" ||
      event.data.result.kind !== "tool-result"
    ) {
      throw new Error("Missing image result");
    }
    expect(
      evePlatformResult.parse(event.data.result.output).usage.costUsd
    ).toBeGreaterThan(0);
  }
  await page.getByRole("button", { exact: true, name: "Share chat" }).click();
  await page.getByRole("button", { exact: true, name: "Share Chat" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Make Private" })
  ).toBeEnabled();
  const anonymous = await browser.newContext();
  try {
    const shared = await anonymous.newPage();
    await shared.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await shared.goto(new URL(`/share/${binding.id}`, page.url()).href);
    const sharedImages = shared.locator('img[src*="/api/files/content?"]');
    await expect(sharedImages).toHaveCount(2);
    await expect
      .poll(() =>
        sharedImages.evaluateAll((elements) =>
          elements.every(
            (element) =>
              element instanceof HTMLImageElement && element.naturalWidth > 0
          )
        )
      )
      .toBe(true);
    await expect(shared.getByTestId("multimodal-input")).toHaveCount(0);
    await expect(sharedImages.nth(1)).toHaveAttribute("src", editedSrc ?? "");
    await page
      .getByRole("button", { exact: true, name: "Make Private" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await shared.reload();
    await expect(
      shared.getByRole("heading", { exact: true, name: "404" })
    ).toBeVisible();
  } finally {
    await db
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, binding.id));
    await anonymous.close();
  }
});
