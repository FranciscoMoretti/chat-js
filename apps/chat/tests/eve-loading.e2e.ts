import { expect, test } from "@playwright/test";

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-statements (#512): test("restoring a saved chat shows a loader without runtime wording") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("restoring a saved chat shows a loader without runtime wording") uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("restoring a saved chat shows a loader without runtime wording") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("restoring a saved chat shows a loader without runtime wording") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("restoring a saved chat shows a loader without runtime wording") accepts { page, }; testInfo; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("restoring a saved chat shows a loader without runtime wording") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("restoring a saved chat shows a loader without runtime wording", async ({
  page,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const response = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Do not use tools. Reply with just the number 7.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(response.ok()).toBe(true);
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- The fixture creation endpoint supplies the conversation ID used by this loading-state scenario.
  const binding = await response.json();
  const gate = Promise.withResolvers<undefined>();
  await page.route("**/api/trpc/*", async (route) => {
    if (route.request().url().includes("eve.branches")) {
      await gate.promise;
    }
    await route.continue();
  });
  try {
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- The fixture creation endpoint supplies the conversation ID used by this loading-state scenario.
    await page.goto(`/chat/${binding.id}`);
    await expect(
      page.getByRole("status", { name: "Loading conversation" })
    ).toBeVisible();
    await expect(
      page.getByText("Restoring conversation", { exact: false })
    ).toHaveCount(0);
    await page.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("conversation-loader.png"),
      style:
        "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility:hidden !important; }",
    });
  } finally {
    gate.resolve(undefined);
  }
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading conversation" })
  ).toHaveCount(0);
});
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
