/* oxlint-disable import/max-dependencies, import/no-relative-parent-imports --
 * import/max-dependencies (#524): import from "@playwright/test" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options"; "../lib/eve/tool-result" dependency within this package instead of introducing an alias or barrel API.
 */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Client } from "eve/client";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveConversation,
  eveFileReference,
  eveStoredFile,
} from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { toolResultSchema } from "../lib/eve/tool-result";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { keyFromFileUrl } from "../lib/file-url";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies, import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("native image generation, editing and sharing preserve stored results") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("native image generation, editing and sharing preserve stored results") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("native image generation, editing and sharing preserve stored results") uses 300_000, 0, 15_000, 1, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("native image generation, editing and sharing preserve stored results") accepts { page, browser, }; route; element; event; elements; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("native image generation, editing and sharing preserve stored results") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
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
  const image = page.locator('img[src*="/api/files/"]').first();
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
  const client = new Client(getEveConnectionOptions(conversation.ownerId));
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
  const receipt = toolResultSchema.parse(result.data.result.output);
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
  const images = page.locator('img[src*="/api/files/"]');
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
  expect(
    registered
      .map((file) => file.key)
      .toSorted((left, right) => Number(left > right) - Number(left < right))
  ).toEqual(
    [keyFromFileUrl(src ?? ""), keyFromFileUrl(editedSrc ?? "")].toSorted(
      (left, right) =>
        Number(String(left) > String(right)) -
        Number(String(left) < String(right))
    )
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
      toolResultSchema.parse(event.data.result.output).usage.costUsd
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
    const sharedImages = shared.locator('img[src*="/api/files/"]');
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
