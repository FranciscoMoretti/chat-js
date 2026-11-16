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
  tools: ["deep-research", "publish-file"],
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
  await expect(draft).toHaveText("Keep my failed draft");
  await expect(
    app.getByRole("alert").filter({ hasText: "Sample message failed" })
  ).toBeVisible();
});
