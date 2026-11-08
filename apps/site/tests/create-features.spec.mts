import type { Page } from "playwright/test";
import { installationSelectionSchema } from "../../../packages/registry/installation";
import { test, expect } from "@uiverify/playwright";

const selectChoice = async (page: Page, label: string, option: string) => {
  await page
    .getByRole("radiogroup", { name: label, exact: true })
    .getByRole("radio", { name: option, exact: true })
    .check();
};
const checkRequirements = async (page: Page) => {
  await page.getByRole("button", { name: "Setup requirements" }).click();
  await expect(page.getByLabel("Installation issues")).toContainText(
    "persistent sandbox"
  );
  await page.keyboard.press("Escape");
};

test("App and Stack share selections, dependencies and the install command", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create");
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  const draft = preview.getByRole("textbox", { name: "Message", exact: true });
  await draft.fill("Keep this while configuring my stack");
  const originalDocument = await preview.locator("body").elementHandle();
  await expect(
    page.getByRole("tablist", { name: "Create workspace" }).getByRole("tab")
  ).toHaveText(["App", "Stack"]);
  await expect(
    page
      .getByRole("tablist", { name: "Configuration category" })
      .getByRole("tab")
  ).toHaveText(["Appearance", "Plugins"]);
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  const panel = page.getByRole("region", { name: "Configure your app" });
  await expect(panel.getByRole("switch")).toHaveCount(11);
  await expect(panel.getByRole("switch", { name: "Langfuse" })).toHaveCount(0);
  await panel
    .getByRole("switch", { name: "Attachment Uploads", exact: true })
    .check();
  await checkRequirements(page);
  await uiVerify.snapshot("design features");
  await page.screenshot({ path: testInfo.outputPath("features-desktop.png") });
  await panel.getByRole("button", { name: "Configure stack" }).click();
  await expect(
    page.getByRole("heading", { name: "Configure your stack." })
  ).toBeVisible();
  await expect(page.locator('iframe[title="Preview"]')).toBeHidden();
  const observability = page.getByRole("region", {
    name: "Observability",
    exact: true,
  });
  await expect(observability.getByRole("checkbox")).toHaveCount(3);
  await observability
    .getByRole("checkbox", { name: "Langfuse", exact: true })
    .check();
  const tools = page.getByRole("region", { name: "AI tools", exact: true });
  await tools
    .getByRole("checkbox", { name: "Deep Research", exact: true })
    .check();
  await expect(
    tools.getByRole("checkbox", { name: "Text Documents", exact: true })
  ).toBeChecked();
  await expect(
    tools.getByRole("checkbox", { name: "Text Documents", exact: true })
  ).toBeDisabled();
  await tools.getByRole("button", { name: "About Text Documents" }).click();
  await expect(
    page.getByText("Required by Deep Research", { exact: true })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await tools
    .getByRole("checkbox", { name: "Deep Research", exact: true })
    .uncheck();
  await expect(
    tools.getByRole("checkbox", { name: "Text Documents", exact: true })
  ).not.toBeChecked();
  await tools.getByRole("textbox", { name: "Search tools" }).fill("weather");
  await expect(tools.getByRole("checkbox")).toHaveCount(1);
  await tools.getByRole("checkbox").check();
  await selectChoice(page, "File storage", "S3");
  await page
    .getByLabel("Storage bucket", { exact: true })
    .fill("my-chat-files");
  await selectChoice(page, "Sandbox", "Daytona");
  await checkRequirements(page);
  await selectChoice(page, "Sandbox", "Vercel Sandbox");
  await expect(
    page.getByRole("complementary", { name: "Your app summary" })
  ).toContainText("Ready to install");
  await page.getByRole("link", { name: "Model gateway", exact: true }).click();
  await uiVerify.snapshot("stack selections");
  await page.screenshot({ path: testInfo.outputPath("stack-desktop.png") });
  await page.getByRole("tab", { name: "App", exact: true }).click();
  expect(
    await originalDocument?.evaluate((element) => element.isConnected)
  ).toBe(true);
  await expect(draft).toHaveText("Keep this while configuring my stack");
  await expect(
    panel.getByRole("switch", { name: "Attachment Uploads", exact: true })
  ).toBeChecked();
  await page.getByRole("tab", { name: "Stack", exact: true }).click();
  await expect(
    tools.getByRole("textbox", { name: "Search tools" })
  ).toHaveValue("weather");
  await tools
    .getByRole("button", { name: "Preview tools", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "App", exact: true })
  ).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/item=preview-tools/u);
  await page.reload();
  const requested = installationSelectionSchema.parse(
    JSON.parse(new URL(page.url()).searchParams.get("installation") ?? "null")
  );
  expect(requested.plugins).toEqual(["attachment-uploads", "langfuse"]);
  expect(requested.tools).toEqual(["get-weather"]);
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  const command = page.getByTestId("create-command");
  await expect(command).toContainText("--installation");
  await expect(command).toContainText(
    '"plugins":["attachment-uploads","langfuse"]'
  );
  await expect(command).toContainText('"sandbox":"vercel"');
  await expect(command).toContainText('"bucket":"my-chat-files"');
  await expect(command).toContainText('"tools":["get-weather"]');
  await page.getByRole("button", { name: "Copy Command", exact: true }).click();
  expect(
    await page.evaluate(async () => await navigator.clipboard.readText())
  ).toContain("--installation");
  expect(errors).toEqual([]);
});

test("invalid links block export and retain a recovery action in both views", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.goto("/create?installation=broken");
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Start a new setup" })
  ).toBeVisible();
  await page.getByRole("tab", { name: "Stack", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Start a new setup" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Copy Command", exact: true })
  ).toBeDisabled();
});

test("namespaced selections and missing providers remain editable", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.goto(
    `/create?installation=${encodeURIComponent(JSON.stringify({ plugins: ["@chatjs/feedback"], tools: [] }))}`
  );
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  const feedback = page.getByRole("switch", { name: "Feedback", exact: true });
  await expect(feedback).toBeChecked();
  await feedback.uncheck();
  await expect(feedback).not.toBeChecked();
  await page.getByRole("tab", { name: "Stack", exact: true }).click();
  const gateway = page.getByRole("radiogroup", { name: "Model gateway" });
  await expect(gateway.getByRole("radio", { checked: true })).toHaveCount(0);
  await selectChoice(page, "Model gateway", "Vercel AI Gateway");
  await expect(
    page.getByRole("complementary", { name: "Your app summary" })
  ).toContainText("Ready to install");
  const storage = page.getByRole("radiogroup", {
    name: "File storage",
    exact: true,
  });
  await expect(storage.getByRole("radio")).toHaveCount(4);
  await page.getByRole("button", { name: /^Show all .* providers$/u }).click();
  await page
    .getByRole("textbox", { name: "Search storage providers" })
    .fill("Azure");
  await expect(storage.getByRole("radio")).toHaveCount(1);
  await storage
    .getByRole("radio", { name: "Azure Blob Storage", exact: true })
    .check();
  await uiVerify.snapshot("custom storage selection");
  await page
    .getByRole("textbox", { name: "Search storage providers" })
    .fill("no matching provider");
  await expect(page.getByRole("status")).toHaveText(
    "No providers match “no matching provider”."
  );
  await uiVerify.snapshot("empty provider search");
  await page.getByRole("button", { name: "Show fewer providers" }).click();
  await expect(
    storage.getByRole("radio", { name: "Azure Blob Storage", exact: true })
  ).toBeChecked();
  await expect(storage.getByRole("radio")).toHaveCount(5);
  // Native radio keyboard behavior and explicit opt-out survive URL serialization.
  await gateway.getByRole("radio", { name: "Vercel AI Gateway" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    gateway.getByRole("radio", { name: "OpenAI", exact: true })
  ).toBeChecked();
  await selectChoice(page, "File storage", "None");
  await expect(
    page
      .getByRole("radiogroup", { name: "File storage" })
      .getByRole("radio", { name: "None" })
  ).toBeChecked();
});

for (const width of [1440, 390]) {
  test(`configuration stays anchored and switches views at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/create?item=preview-02");
    const frame = page.locator('iframe[title="Preview"]');
    const preview = page.frameLocator('iframe[title="Preview"]');
    await expect(preview.getByTestId("chat-preview")).toBeVisible();
    await page.evaluate(async () => await document.fonts.ready);
    const initialFrame = await frame.boundingBox();
    expect(initialFrame?.height).toBeGreaterThan(200);
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
    const unchangedFrame = async () => {
      expect(await frame.boundingBox()).toEqual(initialFrame);
      expect(await categories.boundingBox()).toEqual(initialCategories);
      expect(await getCode.boundingBox()).toEqual(initialGetCode);
    };
    await page.getByRole("tab", { name: "Plugins", exact: true }).click();
    await unchangedFrame();
    const feedback = page.getByRole("switch", {
      name: "Feedback",
      exact: true,
    });
    const before = await feedback.boundingBox();
    await feedback.check();
    expect(await feedback.boundingBox()).toEqual(before);
    await expect(preview.getByTestId("message-upvote")).toBeVisible();
    await unchangedFrame();
    await page
      .getByRole("button", { name: "About Feedback", exact: true })
      .click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Setup requirements" }).click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: testInfo.outputPath("design.png"),
      animations: "disabled",
    });
    await uiVerify.snapshot("design");
    await page.getByRole("tab", { name: "Stack", exact: true }).click();
    await selectChoice(page, "Model gateway", "OpenRouter");
    await expect(
      page.getByRole("button", { name: "Get Code", exact: true }).first()
    ).toBeInViewport();
    await uiVerify.snapshot("stack");
    await page.screenshot({
      path: testInfo.outputPath("stack.png"),
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    await page
      .getByRole("link", { name: "Observability", exact: true })
      .click();
    const observability = page.getByRole("region", {
      name: "Observability",
      exact: true,
    });
    await expect(observability.getByRole("heading")).toBeInViewport();
    await observability
      .getByRole("checkbox", { name: "Langfuse", exact: true })
      .check();
    await uiVerify.snapshot("observability");
    await page.screenshot({
      path: testInfo.outputPath("observability.png"),
      animations: "disabled",
    });
    await page.getByRole("tab", { name: "App", exact: true }).click();
    await unchangedFrame();
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    await unchangedFrame();
    await page.getByRole("button", { name: "Style Nova", exact: true }).click();
    await unchangedFrame();
    await page.keyboard.press("Escape");
    await getCode.click();
    await expect(page.getByTestId("create-command")).toContainText(
      '"plugins":["feedback","langfuse"]'
    );
    await unchangedFrame();
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

/* eslint-disable no-await-in-loop -- Exercise dependent selections sequentially to measure each layout change. */
// Dependency explanations and validation status must not move selection targets.
for (const width of [1440, 1024, 390]) {
  test(`stack selections keep card geometry and scroll position at ${width}px`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 950 });
    const installation = {
      gateway: "vercel",
      plugins: [],
      tools: [],
      storage: { source: "s3", options: {} },
      sandbox: "vercel",
    };
    await page.goto(
      `/create?installation=${encodeURIComponent(JSON.stringify(installation))}`
    );
    await expect(
      page.frameLocator('iframe[title="Preview"]').getByTestId("chat-preview")
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Get Code", exact: true }).first()
    ).toBeEnabled();
    await expect(
      page.getByText("Loading preview…", { exact: true })
    ).toBeHidden();
    await page.getByRole("tab", { name: "Stack", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Configure your stack." })
    ).toBeVisible();
    await page.evaluate(async () => await document.fonts.ready);
    const tools = page.getByRole("region", { name: "AI tools", exact: true });
    const scroll = page.getByTestId("stack-scroll");
    const summary = page.getByRole("complementary", {
      name: "Your app summary",
    });
    const geometry = async () =>
      await tools.locator('label[for^="feature-"]').evaluateAll((cards) =>
        cards.map((card) => {
          const rect = card.getBoundingClientRect();
          const container = card.closest('[data-testid="stack-scroll"]');
          return {
            x: rect.x,
            y: rect.y + (container?.scrollTop ?? 0),
            width: rect.width,
            height: rect.height,
          };
        })
      );
    const summaryGeometry = async () =>
      await summary.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return {
          height: bounds.height,
          controls: [...element.querySelectorAll("button")].map((button) => {
            const rect = button.getBoundingClientRect();
            return {
              x: rect.x - bounds.x,
              y: rect.y - bounds.y,
              width: rect.width,
              height: rect.height,
            };
          }),
        };
      });
    const beforeSummary = await summaryGeometry();
    await expect(summary).toContainText("Setup needed");
    await page
      .getByLabel("Storage bucket", { exact: true })
      .fill("preview-files");
    await expect(summary).toContainText("Ready to install");
    expect(await summaryGeometry()).toEqual(beforeSummary);
    const before = await geometry();
    // Each click is explicitly brought into view before measuring: browser scrolling
    // to reach an offscreen control is distinct from a selection shifting the layout.
    for (const checked of [true, false]) {
      const names = [
        "Text Documents",
        "Sheet Documents",
        "Delete Document",
        "Deep Research",
      ];
      for (const name of checked ? names : names.toReversed()) {
        const control = tools.getByRole("checkbox", { name, exact: true });
        await control.scrollIntoViewIfNeeded();
        const scrollBefore = await scroll.evaluate(
          (element) => element.scrollTop
        );
        await control.setChecked(checked);
        await expect(control).toBeChecked({ checked });
        expect(await geometry()).toEqual(before);
        expect(await scroll.evaluate((element) => element.scrollTop)).toBe(
          scrollBefore
        );
        expect(await summaryGeometry()).toEqual(beforeSummary);
      }
      await tools
        .getByRole("button", { name: "About Read Document", exact: true })
        .click();
      if (checked) {
        await expect(
          page.getByText(/^Required by .*Text Documents/u)
        ).toBeVisible();
      }
      await page.screenshot({
        path: testInfo.outputPath(`dependencies-${checked}.png`),
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      expect(await geometry()).toEqual(before);
    }
    expect(errors).toEqual([]);
  });
}

/* eslint-enable no-await-in-loop */
