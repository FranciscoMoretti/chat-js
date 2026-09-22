import { expect, test } from "@playwright/test";

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
  const binding = await response.json();
  const gate = Promise.withResolvers<undefined>();
  await page.route("**/api/trpc/*", async (route) => {
    if (route.request().url().includes("eve.branches")) {
      await gate.promise;
    }
    await route.continue();
  });
  try {
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
