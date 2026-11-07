import type { Page } from "playwright/test";
import { installationSelectionSchema } from "../../../packages/registry/installation";
import { test, expect } from "@uiverify/playwright";

const selectChoice = async (page: Page, label: string, option: string) => {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const checkRequirements = async (page: Page) => {
  await page.getByRole("button", { name: "Setup requirements" }).click();
  await expect(page.getByLabel("Installation issues")).toContainText(
    "persistent sandbox"
  );
  await page.keyboard.press("Escape");
};

test("Features resolve the full installation and preserve explicit choices", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  await expect(
    page.frameLocator("iframe").getByTestId("chat-preview")
  ).toBeVisible();
  await expect(
    page.getByRole("tab", { name: "App", exact: true })
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page
      .getByRole("tablist", { name: "Configuration category" })
      .getByRole("tab")
  ).toHaveText(["App", "Appearance"]);
  const panel = page.getByRole("region", { name: "Configure your app" });
  await expect(panel.getByRole("tab")).toHaveText([
    "Plugins",
    "Tools",
    "Providers",
  ]);
  await expect(panel.getByRole("switch")).toHaveCount(15);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const previewFrame = page.locator('iframe[title="Preview"]');
  await expect(previewFrame).toBeInViewport();
  const desktopPreviewBounds = await previewFrame.boundingBox();
  expect(desktopPreviewBounds?.height).toBeGreaterThan(200);
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Style Nova", exact: true })
  ).toBeVisible();
  await page.getByRole("tab", { name: "App", exact: true }).click();
  await panel.getByRole("switch", { name: "Langfuse", exact: true }).check();
  await expect(panel).toContainText("Server only");
  await page.addStyleTag({
    content:
      "iframe, nextjs-portal { visibility: hidden !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
  });
  await uiVerify.snapshot("desktop plugins");
  await page.screenshot({ path: testInfo.outputPath("plugins.png") });
  await panel.getByRole("tab", { name: "Tools", exact: true }).click();
  await panel
    .getByRole("switch", { name: "Deep Research", exact: true })
    .check();
  await expect(
    panel.getByRole("switch", { name: "Text Documents", exact: true })
  ).toBeChecked();
  await expect(
    panel.getByRole("switch", { name: "Text Documents", exact: true })
  ).toBeDisabled();
  await expect(panel).toContainText("Required by Deep Research");
  await uiVerify.snapshot("desktop dependencies");
  await panel
    .getByRole("switch", { name: "Deep Research", exact: true })
    .uncheck();
  await expect(
    panel.getByRole("switch", { name: "Text Documents", exact: true })
  ).not.toBeChecked();
  await panel.getByRole("tab", { name: "Plugins", exact: true }).click();
  await panel
    .getByRole("switch", { name: "Attachment Uploads", exact: true })
    .check();
  await checkRequirements(page);
  await panel.getByRole("tab", { name: "Providers", exact: true }).click();
  await selectChoice(page, "Sandbox provider", "Daytona");
  await checkRequirements(page);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await panel.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true);
  await expect(previewFrame).toBeInViewport();
  const mobilePreviewBounds = await previewFrame.boundingBox();
  expect(mobilePreviewBounds?.height).toBeGreaterThan(200);
  await panel.getByLabel("Sandbox provider").scrollIntoViewIfNeeded();
  await expect(panel.getByLabel("Sandbox provider")).toBeInViewport();
  await uiVerify.snapshot("mobile provider requirement");
  await page.screenshot({ path: testInfo.outputPath("providers-mobile.png") });
  await selectChoice(page, "Sandbox provider", "Vercel Sandbox");
  await expect(panel).toContainText("Ready to install");
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  const requested = installationSelectionSchema.parse(
    JSON.parse(new URL(page.url()).searchParams.get("installation") ?? "null")
  );
  expect(requested.plugins).toEqual(["langfuse", "attachment-uploads"]);
  expect(requested.tools).toEqual([]);
  await page.reload();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const command = page.getByTestId("create-command");
  await expect(command).toContainText("--installation");
  await expect(command).toContainText(
    '"plugins":["langfuse","attachment-uploads"]'
  );
  await expect(command).toContainText('"sandbox":"vercel"');
  await expect(command).toContainText('"tools":[]');
  await expect(command).not.toContainText("scenario");
  await page.getByRole("button", { name: "Copy Command", exact: true }).click();
  expect(
    await page.evaluate(async () => await navigator.clipboard.readText())
  ).toContain("--installation");
  expect(errors).toEqual([]);
});

test("invalid links block export and retain a recovery action", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.goto("/create?installation=broken");
  await page.getByRole("tab", { name: "App", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Start a new setup" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Copy Command", exact: true })
  ).toBeDisabled();
});

test("namespaced plugin selections can be removed and missing providers can be chosen", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.goto(
    `/create?installation=${encodeURIComponent(JSON.stringify({ plugins: ["@chatjs/feedback"], tools: [] }))}`
  );
  await page.getByRole("tab", { name: "App", exact: true }).click();
  const panel = page.getByRole("region", { name: "Configure your app" });
  await expect(
    panel.getByRole("switch", { name: "Feedback", exact: true })
  ).toBeChecked();
  await panel.getByRole("switch", { name: "Feedback", exact: true }).uncheck();
  await expect(
    panel.getByRole("switch", { name: "Feedback", exact: true })
  ).not.toBeChecked();
  await panel.getByRole("tab", { name: "Providers", exact: true }).click();
  await expect(
    panel.getByRole("combobox", { name: "Model gateway" })
  ).toContainText("Choose a provider");
  await selectChoice(page, "Model gateway", "Vercel AI Gateway");
  await expect(panel).toContainText("Ready to install");
});

for (const width of [1440, 390]) {
  test(`configuration stays anchored while interacting at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/create?item=preview-02");
    const frame = page.locator('iframe[title="Preview"]');
    const preview = page.frameLocator('iframe[title="Preview"]');
    await expect(preview.getByTestId("chat-preview")).toBeVisible();
    await page.evaluate(async () => await document.fonts.ready);
    const initialFrame = await frame.boundingBox();
    const categories = page.getByRole("tablist", {
      name: "Configuration category",
      includeHidden: true,
    });
    const initialCategories = await categories.boundingBox();
    const getCode = page
      .getByRole("region", {
        name: "Create app",
        exact: true,
        includeHidden: true,
      })
      .getByRole("button", {
        name: "Get Code",
        exact: true,
        includeHidden: true,
      });
    await expect(getCode).toBeEnabled();
    await expect(getCode).toBeInViewport();
    const initialGetCode = await getCode.boundingBox();
    await page.screenshot({
      path: testInfo.outputPath("app-code-action.png"),
      animations: "disabled",
    });
    await getCode.click();
    await expect(
      page.getByRole("dialog", { name: "Create your ChatJS app" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    const unchangedFrame = async () => {
      expect(await frame.boundingBox()).toEqual(initialFrame);
      expect(await categories.boundingBox()).toEqual(initialCategories);
      expect(await getCode.boundingBox()).toEqual(initialGetCode);
    };
    await page.getByRole("tab", { name: "App", exact: true }).click();
    await unchangedFrame();
    const panel = page.getByRole("region", { name: "Configure your app" });
    const feedback = panel.getByRole("switch", {
      name: "Feedback",
      exact: true,
    });
    await feedback.scrollIntoViewIfNeeded();
    const before = await feedback.boundingBox();
    await feedback.check();
    expect(await feedback.boundingBox()).toEqual(before);
    await expect(preview.getByTestId("message-upvote")).toBeVisible();
    await unchangedFrame();
    await page.getByRole("tab", { name: "Providers", exact: true }).click();
    await unchangedFrame();
    await page.getByRole("combobox", { name: "Model gateway" }).click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Setup requirements" }).click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await page.getByRole("tab", { name: "Tools", exact: true }).click();
    await unchangedFrame();
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    await unchangedFrame();
    await page.screenshot({
      path: testInfo.outputPath("appearance-code-action.png"),
      animations: "disabled",
    });
    await expect(
      page
        .getByRole("tabpanel")
        .getByRole("button", { name: "Get Code", exact: true })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Style Nova", exact: true }).click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await getCode.click();
    await expect(page.getByTestId("create-command")).toContainText(
      '"plugins":["feedback"]'
    );
    await unchangedFrame();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  });
}

test("Get Code selects either library without replacing the preview", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/create?installation=${encodeURIComponent(
      JSON.stringify({ gateway: "vercel", plugins: ["feedback"], tools: [] })
    )}`
  );
  const preview = page.frameLocator("iframe");
  const draft = preview.getByRole("textbox", { name: "Message", exact: true });
  await draft.fill("Keep this draft");
  const originalDocument = await preview.locator("body").elementHandle();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Create your ChatJS app" });
  const command = dialog.getByTestId("create-command");
  await expect(
    dialog.getByRole("button", { name: "Base UI", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(command).toContainText("--base base");
  await expect(dialog.getByRole("switch")).toHaveAccessibleName(
    "Use pointer on buttons"
  );
  await expect(dialog.getByText("React Aria", { exact: true })).toHaveCount(0);
  await expect(
    dialog.getByRole("group", { name: "Template", exact: true })
  ).toHaveCount(0);
  await uiVerify.snapshot("get code base");
  await page.screenshot({ path: testInfo.outputPath("get-code-base.png") });
  await dialog.getByRole("button", { name: "Radix UI", exact: true }).click();
  await dialog.getByRole("switch", { name: "Use pointer on buttons" }).check();
  await expect(command).toContainText("--base radix --no-rtl --pointer");
  await expect(command).toContainText('"plugins":["feedback"]');
  await dialog
    .getByRole("button", { name: "Copy Command", exact: true })
    .click();
  expect(
    await page.evaluate(async () => await navigator.clipboard.readText())
  ).toContain("--base radix");
  await uiVerify.snapshot("get code radix");
  await page.screenshot({ path: testInfo.outputPath("get-code-radix.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeInViewport();
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true);
  await uiVerify.snapshot("get code mobile");
  await page.screenshot({ path: testInfo.outputPath("get-code-mobile.png") });
  await page.keyboard.press("Escape");
  expect(
    await originalDocument?.evaluate((element) => element.isConnected)
  ).toBe(true);
  await expect(draft).toHaveText("Keep this draft");
  await expect(preview.getByTestId("chat-preview")).toHaveAttribute(
    "data-base",
    "base"
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const shared = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  expect(new URL(shared).searchParams.get("base")).toBe("radix");
  await page.goto(shared);
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(
    dialog.getByRole("button", { name: "Radix UI", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(command).toContainText("--base radix");
  await dialog.getByRole("button", { name: "Base UI", exact: true }).click();
  await expect(command).toContainText("--base base");
});
