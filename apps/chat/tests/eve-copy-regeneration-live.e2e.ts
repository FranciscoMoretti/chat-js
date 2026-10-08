/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */

import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.
import type { TestInfo } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable eslint/sort-imports */
import { eveConversation } from "../lib/db/schema";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "../lib/env";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  conversationBinding,
  createConversationInput,
} from "../lib/eve/contracts";
/* oxlint-enable eslint/sort-imports */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
const originalModel = "google/gemini-2.5-flash-lite";
const selectedModel = "google/gemini-2.5-flash";
const answer = /^provenance-ready\.?$/iu;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async --
 * init-declarations (#507): test("copied responses regenerate with their original model after reload") assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-lines-per-function (#510): test("copied responses regenerate with their original model after reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("copied responses regenerate with their original model after reload") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("copied responses regenerate with their original model after reload") uses 300_000, 20_000, 120_000, 200, 503, 1000, 2000, 4000 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("copied responses regenerate with their original model after reload") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.setDefaultTimeout(), page.setDefaultNavigationTimeout(), page.route() on the original Page/locator receiver to change the live browser or route state.
test("copied responses regenerate with their original model after reload", async ({
  page,
}, testInfo: Readonly<{
  project: Readonly<{ use: Readonly<{ baseURL?: string | undefined }> }>;
  outputPath: TestInfo["outputPath"];
}>) => {
  test.setTimeout(300_000);
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(120_000);
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
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
  await expect(
    page.getByText("Ready", { exact: true }).filter({ visible: true })
  ).toBeVisible();
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
  await expect(
    page.getByText("Ready", { exact: true }).filter({ visible: true })
  ).toBeVisible();
  await expect(page.getByRole("log").getByText(answer)).toBeVisible();
  const regenerate = page.getByRole("button", {
    exact: true,
    name: "Retry",
  });
  await expect(regenerate).toBeEnabled();
  await page.getByRole("log").screenshot({
    animations: "disabled",
    path: testInfo.outputPath("imported-regeneration.png"),
  });
  let regenerated: z.infer<typeof conversationBinding> | undefined;
  await page.route(
    "**/api/agent-conversations",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.fetch() and route.fulfill() to resolve the intercepted live request through the original native Route receiver.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from regenerated; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  await expect.poll(() => regenerated?.id, { timeout: 95_000 }).toBeTruthy();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from regenerated; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  await expect(page).toHaveURL(`${origin}/chat/${regenerated?.id}`);
  await expect(page.getByRole("log").getByText(answer)).toBeVisible({
    timeout: 45_000,
  });
  await expect(
    page.getByRole("button", { exact: true, name: "Retry" })
  ).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("log").getByText(answer)).toBeVisible({
    timeout: 30_000,
  });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations, max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async */
