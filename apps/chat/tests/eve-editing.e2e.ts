import { expect, test } from "@playwright/test";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");

test("edit recovery and regeneration create navigable versions inside ChatJS", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin: new URL(page.url()).origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId: "openai/gpt-4.1-mini-fast",
      message: "Reply briefly with amber.",
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await page.getByRole("button", { name: "Edit message", exact: true }).click();
  const editor = page.getByRole("dialog");
  await expect(editor).toContainText("original conversation stays available");
  await editor
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Reply briefly with cobalt.");
  await editor.screenshot({
    path: testInfo.outputPath("edit-dialog.png"),
    animations: "disabled",
  });

  const desktopViewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await editor.screenshot({
    path: testInfo.outputPath("edit-dialog-mobile.png"),
    animations: "disabled",
  });
  if (desktopViewport) {
    await page.setViewportSize(desktopViewport);
  }

  let accepted: ReturnType<typeof conversationBinding.parse> | undefined;
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      const response = await route.fetch();
      accepted = conversationBinding.parse(await response.json());
      await route.abort("failed");
    },
    { times: 1 }
  );
  await editor.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Recover version" })
  ).toBeEnabled({ timeout: 60_000 });
  expect(accepted).toBeDefined();
  await page.reload();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Version creation is unconfirmed" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Recover version" }).click();
  await expect(page).toHaveURL(new RegExp(`/chat/${accepted?.id}$`), {
    timeout: 60_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByRole("log").locator(".is-user")).toContainText(
    "cobalt"
  );
  await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(1);
  await expect(
    page.getByRole("combobox", { name: "Conversation version" })
  ).toContainText("Version 2");
  await page.getByRole("log").screenshot({
    path: testInfo.outputPath("edited-messages.png"),
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Regenerate response", exact: true })
    .click();
  await expect(page).not.toHaveURL(new RegExp(`/chat/${accepted?.id}$`), {
    timeout: 60_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(
    page.getByRole("combobox", { name: "Conversation version" })
  ).toContainText("Version 3");
  await expect(page.getByRole("log").locator(".is-user")).toContainText(
    "cobalt"
  );
  await expect(page.getByRole("log").locator(".is-assistant")).toHaveCount(1);
  await page
    .getByRole("navigation", { name: "Conversation versions" })
    .screenshot({
      path: testInfo.outputPath("version-navigation.png"),
      animations: "disabled",
    });
  await page
    .getByRole("link", { name: "Original conversation", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/chat/${source.id}$`));
  await expect(page.getByRole("log").locator(".is-user")).toContainText(
    "amber"
  );
  await expect(page.getByRole("log")).not.toContainText("cobalt");
  await page.getByRole("button", { name: "Edit message", exact: true }).click();
  await editor
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Keep this edited violet draft.");
  await page.route(
    "**/api/agent-conversations",
    (route) =>
      route.fulfill({ status: 503, json: { error: "Temporary test outage" } }),
    { times: 1 }
  );
  await editor.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Recover version" })
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Conversation version" })
  ).toContainText("Original");
  await expect(
    page.getByRole("button", { name: "Recover version" })
  ).toBeVisible();
  await page.getByRole("region", { name: "Version recovery" }).screenshot({
    path: testInfo.outputPath("retained-edit.png"),
    animations: "disabled",
  });
  await page.route(
    "**/api/agent-conversations",
    (route) =>
      route.fulfill({
        status: 400,
        json: { error: "Test model rejection", creationRejected: true },
      }),
    { times: 1 }
  );
  await page.getByRole("button", { name: "Recover version" }).click();
  await expect(
    editor.getByRole("textbox", { name: "Message", exact: true })
  ).toHaveText("Keep this edited violet draft.");
  await expect(editor).toContainText("Test model rejection");
  let replacement: unknown;
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      replacement = route.request().postDataJSON();
      await route.fulfill({
        status: 400,
        json: { error: "End of test", creationRejected: true },
      });
    },
    { times: 1 }
  );
  await editor.getByRole("button", { name: "Send", exact: true }).click();
  await expect(editor).toContainText("End of test");
  expect(replacement).toMatchObject({
    message: "Keep this edited violet draft.",
    fork: { conversationId: source.id, beforeTurnId: "turn_0" },
  });
});
