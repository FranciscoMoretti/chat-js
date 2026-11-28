import { encodeAppPreset } from "../../../packages/registry/app-preset";
import { installationSelectionSchema } from "../../../packages/registry/installation";
import { test, expect } from "playwright/test";

const installation = {
  gateway: "vercel",
  plugins: [
    "projects",
    "feedback",
    "search",
    "credits",
    "model-preferences",
    "attachment-uploads",
  ],
  tools: ["deep-research", "attach-workspace-file"],
  storage: { source: "vercel-blob" },
  sandbox: "vercel",
};
for (const rtl of [false, true]) {
  test(`shared application controls ${rtl ? "RTL" : "LTR"}`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    const backend: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (
        /\/api\//u.test(request.url()) &&
        request.frame().parentFrame() !== null
      ) {
        backend.push(request.url());
      }
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `/create?item=preview-02&rtl=${rtl}&app=${encodeAppPreset(installationSelectionSchema.parse(installation))}`
    );
    const app = page.frameLocator("iframe");
    await expect(
      app.getByRole("button", { name: "New project", exact: true })
    ).toBeVisible();
    await expect(
      app.getByRole("link", { name: "Models", exact: true })
    ).toBeVisible();
    await expect(
      app.getByRole("button", { name: /Search chats/u })
    ).toBeVisible();
    await app
      .getByRole("button", {
        name: "Chat menu: Help me build a small app people will",
      })
      .click();
    await app.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await app
      .getByRole("textbox", { name: "Chat title", exact: true })
      .fill("Renamed locally");
    await app
      .getByRole("textbox", { name: "Chat title", exact: true })
      .press("Enter");
    await expect(
      app.getByRole("link", { name: "Renamed locally", exact: true })
    ).toBeVisible();
    await app
      .getByRole("button", { name: "Chat menu: Renamed locally" })
      .click();
    await app.getByRole("menuitem", { name: "Pin", exact: true }).click();
    await expect(app.getByText("Pinned", { exact: true })).toBeVisible();
    await app.getByRole("button", { name: "New project", exact: true }).click();
    await expect(app.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: info.outputPath("shared-project-dialog.png"),
    });
    await page.keyboard.press("Escape");
    await app
      .getByRole("button", { name: "Composer options", exact: true })
      .click();
    await expect(
      app.getByRole("menuitem", { name: "Attach files", exact: true })
    ).toBeVisible();
    await expect(
      app.getByRole("menuitemcheckbox", { name: "Deep Research", exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(app.getByRole("menu")).toBeHidden();
    await expect(
      app.getByRole("button", { name: /GPT-5 nano/u })
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath("shared-application.png") });
    expect(errors).toEqual([]);
    expect(backend).toEqual([]);
  });
}

test("local adapters drive project creation and model selection", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/create?item=preview-tools&app=${encodeAppPreset(installationSelectionSchema.parse(installation))}`
  );
  const app = page.frameLocator("iframe");
  await app.getByRole("button", { name: "New project", exact: true }).click();
  await app.getByPlaceholder("Project name").fill("Created locally");
  await app.getByRole("button", { name: "Create", exact: true }).click();
  await expect(
    app.getByRole("link", { name: "Created locally", exact: true })
  ).toBeVisible();
  await expect(app.getByRole("dialog")).toBeHidden();
  await app.getByRole("button", { name: /GPT-5 nano/u }).click();
  await app.getByRole("option", { name: /Claude Sonnet 4/u }).click();
  await expect(
    app.getByRole("button", { name: /Claude Sonnet 4/u })
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("local-project-and-model.png"),
  });
  expect(errors).toEqual([]);
});

test("shared message editor and deletion use local effects", async ({
  page,
}) => {
  await page.goto(
    `/create?item=preview-02&app=${encodeAppPreset(installationSelectionSchema.parse(installation))}`
  );
  const app = page.frameLocator("iframe");
  await app.getByRole("button", { name: "Edit message", exact: true }).click();
  const inlineEditor = app.locator('[data-role="user"]');
  await inlineEditor
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Edited locally");
  await inlineEditor.getByRole("button", { name: "Send", exact: true }).click();
  await expect(inlineEditor).toContainText("Edited locally");
  await expect(inlineEditor.getByRole("textbox")).toBeHidden();
  await expect(app.getByTestId("message-assistant-loading")).toBeHidden();
  await app.getByRole("button", { name: /^Chat menu:/u }).click();
  await app.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await app
    .getByRole("dialog")
    .getByRole("button", { name: /Delete conversation/u })
    .click();
  await expect(
    app.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(
    app.getByRole("link", {
      name: "Help me build a small app people will",
      exact: true,
    })
  ).toBeHidden();
});

test("a failed local submission keeps the new-chat draft and shows the shared error", async ({
  page,
}) => {
  await page.goto("/create?item=preview&__previewScenario=mutation-error");
  const app = page.frameLocator("iframe");
  const draft = app.getByRole("textbox", { name: "Message", exact: true });
  await draft.fill("Keep my failed draft");
  await app.getByRole("button", { name: "Send", exact: true }).click();
  await expect(draft).toHaveValue("Keep my failed draft");
  await expect(
    app.getByRole("alert").filter({ hasText: "Sample message failed" })
  ).toBeVisible();
});

test("Parallel Responses previews the model picker and each turn's replies", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/create?item=preview-02&app=${encodeAppPreset(installationSelectionSchema.parse({ plugins: [], gateway: "vercel", tools: [] }))}`
  );
  const app = page.frameLocator('iframe[title="Preview"]');
  const picker = app.getByTestId("model-selector");
  const popup = app
    .locator('[data-slot="popover-content"]')
    .filter({ has: app.getByRole("listbox") });
  await picker.click();
  await expect(
    app.getByRole("option", { selected: true })
  ).toHaveAccessibleName("GPT-5 nano");
  await popup.screenshot({ path: info.outputPath("single-model-picker.png") });
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Plugins", exact: true }).first().click();
  const mode = page.getByRole("combobox", { name: "Model selection" });
  await expect(mode).toHaveText("Single model");
  await expect(
    page.getByText("Choose one model per turn.", { exact: true })
  ).toBeHidden();
  await page.getByRole("region", { name: "Configure your app" }).screenshot({
    path: info.outputPath("model-selection-field.png"),
  });
  await mode.click();
  await expect(
    page.getByRole("option", { name: "Single model", exact: true })
  ).toHaveAccessibleDescription("Choose one model per turn.");
  await page
    .getByRole("listbox")
    .screenshot({ path: info.outputPath("model-selection-choices.png") });
  await page
    .getByRole("option", { name: "Parallel Responses", exact: true })
    .click();
  await expect(mode).toHaveText("Parallel Responses");
  const originalTurn = app.locator('[data-eve-message-id="sample-user"]');
  const claude = originalTurn.getByRole("button", { name: /Claude Sonnet 4/u });
  await claude.click();
  await expect(claude).toHaveAttribute("aria-pressed", "true");
  await expect(
    app.getByRole("heading", { name: "Build around one real task" })
  ).toBeVisible();
  await app
    .getByTestId("chat-preview")
    .screenshot({ path: info.outputPath("parallel-messages.png") });

  await picker.click();
  await app.getByRole("switch", { name: "Use Multiple Models" }).check();
  await app.getByRole("option", { name: /GPT-5 nano/u }).click();
  await expect(app.getByRole("option", { selected: true })).toHaveCount(2);
  await popup.screenshot({
    path: info.outputPath("parallel-model-picker.png"),
  });
  await page.keyboard.press("Escape");
  await app
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Compare these replies");
  await app.getByRole("button", { name: "Send", exact: true }).click();
  const sentTurn = app.locator('[data-eve-message-id="preview-user-0"]');
  await sentTurn.getByRole("button", { name: /Claude Sonnet 4/u }).click();
  await expect(
    app.getByText(/sample response \d from Claude Sonnet 4/u)
  ).toBeVisible();
  await expect(claude).toHaveAttribute("aria-pressed", "true");
  const followUp = app.getByText("Continue the Claude reply", { exact: true });
  const message = app.getByRole("textbox", { name: "Message", exact: true });
  const send = app.getByRole("button", { name: "Send", exact: true });
  await expect(picker).toContainText("Claude Sonnet 4");
  await message.fill("Continue the Claude reply");
  await send.click();
  await expect(followUp).toBeVisible();
  await expect(
    app.locator('[data-eve-message-id="preview-user-1"] button[aria-pressed]')
  ).toHaveCount(0);
  await sentTurn.getByRole("button", { name: /GPT-5 nano/u }).click();
  await expect(followUp).toHaveCount(0);
  await expect(picker).toContainText("GPT-5 nano");
  await message.fill("Continue the GPT reply");
  await send.click();
  const sibling = app.getByText("Continue the GPT reply", { exact: true });
  await expect(sibling).toBeVisible();
  await sentTurn.getByRole("button", { name: /Claude Sonnet 4/u }).click();
  await expect(sibling).toHaveCount(0);
  await expect(followUp).toBeVisible();
  await originalTurn.getByRole("button", { name: /GPT-5 nano/u }).click();
  await expect(sentTurn).toHaveCount(0);
  await expect(followUp).toHaveCount(0);
  await claude.click();
  await expect(sentTurn).toBeVisible();
  await expect(followUp).toBeVisible();
  await app
    .getByRole("log")
    .screenshot({ path: info.outputPath("parallel-continuation.png") });
  await mode.click();
  await page.getByRole("option", { name: "Single model", exact: true }).click();
  await expect(claude).toHaveCount(0);
  await expect(followUp).toBeVisible();
  await expect(sibling).toHaveCount(0);
  await mode.click();
  await page.getByRole("option", { name: "No picker", exact: true }).click();
  await expect(followUp).toBeVisible();
  await expect(picker).toHaveCount(0);
  await expect(claude).toHaveCount(0);
  await app.getByRole("log").screenshot({
    path: info.outputPath("continuation-without-picker.png"),
  });
  await expect(
    app.getByRole("heading", { name: "A small start. A great experience." })
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "Plugins", exact: true }).first().click();
  await expect(mode).toHaveText("No picker");
  await expect(picker).toHaveCount(0);
  await message.fill("Use the default model");
  await send.click();
  await expect(
    app.getByText("Use the default model", { exact: true })
  ).toBeVisible();
  await app
    .getByTestId("chat-preview")
    .screenshot({ path: info.outputPath("default-model-no-picker.png") });
  await mode.click();
  await page.getByRole("option", { name: "Single model", exact: true }).click();
  await expect(picker).toBeVisible();
});

test("a reply chooses the continuation model while new chats remember the picker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/create?item=preview-02&app=${encodeAppPreset(installationSelectionSchema.parse({ plugins: ["parallel-responses"], gateway: "vercel", tools: [] }))}`
  );
  const app = page.frameLocator('iframe[title="Preview"]');
  const picker = app.getByTestId("model-selector");
  await picker.click();
  await app.getByRole("option", { name: /Claude Sonnet 4/u }).click();
  await expect(picker).toContainText("Claude Sonnet 4");
  await app
    .locator('[data-eve-message-id="sample-user"]')
    .getByRole("button", { name: /GPT-5 nano/u })
    .click();
  await expect(picker).toContainText("GPT-5 nano");
  await app
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Continue on this branch");
  await app.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    app.getByText("Continue on this branch", { exact: true })
  ).toBeVisible();
  const original = app.locator('[data-eve-message-id="sample-user"]');
  const edit = original.getByRole("button", {
    name: "Edit message",
    exact: true,
  });
  const inlinePicker = original.getByTestId("model-selector");
  await edit.click();
  await inlinePicker.click();
  await expect(app.getByRole("option", { selected: true })).toHaveCount(2);
  await app.getByRole("option", { name: /Claude Sonnet 4/u }).click();
  await app.getByRole("button", { name: /^1× /u }).click();
  await app.getByRole("menuitem", { name: "2x", exact: true }).click();
  await page.keyboard.press("Escape");
  await original.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    original.getByRole("button", { name: /GPT-5 nano/u })
  ).toHaveCount(2);
  await original
    .getByRole("button", { name: /GPT-5 nano/u })
    .last()
    .click();
  await edit.click();
  await inlinePicker.click();
  await expect(app.getByRole("button", { name: /^2× /u })).toBeVisible();
  await page.keyboard.press("Escape");
  await original
    .getByRole("button", { name: "Cancel edit", exact: true })
    .click();
  await app.getByRole("link", { name: /New Chat/u }).click();
  await expect(
    app.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(picker).toContainText("Claude Sonnet 4");
});
