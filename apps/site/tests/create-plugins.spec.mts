import type { Page } from "playwright/test";
import { test, expect } from "@uiverify/playwright";

const setup = async (page: Page) => {
  await page.goto("/create?item=preview-02");
  await page.getByRole("tab", { name: "Plugins", exact: true }).first().click();
  await page.getByRole("switch", { name: "Feedback", exact: true }).check();
  await page.getByRole("switch", { name: "Projects", exact: true }).check();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(preview.getByTestId("message-upvote")).toBeEnabled();
  return preview;
};

test("live Create shares production plugin controllers", async ({
  page,
  uiVerify,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:trpc|auth)|\/eve\//u.test(request.url())) {
      backendRequests.push(request.url());
    }
  });
  uiVerify.disableAutoSnapshot();
  const preview = await setup(page);
  await preview.getByTestId("message-upvote").click();
  await expect(preview.getByTestId("message-upvote")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await preview.getByTestId("message-downvote").click();
  await expect(preview.getByTestId("message-downvote")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await preview.getByRole("button", { name: /^Chat menu:/u }).click();
  await preview.getByRole("menuitem", { name: "Move to project" }).click();
  await preview
    .getByLabel("Project", { exact: true })
    .selectOption({ label: "Launch plan" });
  await preview.getByRole("button", { name: "Move", exact: true }).click();
  await expect(
    preview.getByRole("dialog", { name: "Move to project" })
  ).toBeHidden();
  await expect(preview.locator('[data-slot="sidebar-content"]')).toContainText(
    "Launch plan"
  );
  await expect(
    preview
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("link", { name: "Launch plan" })
  ).toBeVisible();
  await expect(
    preview.locator("a[data-active]", { hasText: "Launch plan" })
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("integrated.png") });
  const faultUrl = new URL(page.url());
  faultUrl.searchParams.set("__previewScenario", "mutation-error");
  await page.goto(faultUrl.href);
  await expect(preview.locator('[data-slot="sidebar-content"]')).toContainText(
    "Today"
  );
  await expect(preview.getByTestId("message-upvote")).toBeEnabled();
  await preview.getByTestId("message-upvote").click();
  await expect(
    preview.getByText("Failed to upvote response.", { exact: true })
  ).toBeVisible();
  await expect(preview.getByTestId("message-upvote")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  expect(backendRequests).toEqual([]);
});

test("native controls style the open production dialog and Share restores the full installation", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1100 });
  const selection = {
    gateway: "openrouter",
    plugins: ["feedback", "projects"],
    tools: ["get-weather"],
    sandbox: "daytona",
    storage: { source: "s3", options: { bucket: "public-files" } },
  };
  await page.goto(
    `/create?item=preview-02&installation=${encodeURIComponent(JSON.stringify(selection))}&__previewScenario=mutation-error`
  );
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(preview.getByTestId("message-upvote")).toBeEnabled();
  await preview.getByRole("button", { name: /^Chat menu:/u }).click();
  await preview.getByRole("menuitem", { name: "Move to project" }).click();
  const dialog = preview.getByRole("dialog", { name: "Move to project" });
  await expect(dialog).toHaveClass(/cn-dialog-content/u);
  const initialRadius = await dialog.evaluate(
    (element) => getComputedStyle(element).borderRadius
  );
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page.getByRole("button", { name: "Style Nova", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Lyra", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(preview.getByTestId("chat-preview")).toHaveAttribute(
    "data-style",
    "lyra"
  );
  await expect
    .poll(
      async () =>
        await dialog.evaluate(
          (element) => getComputedStyle(element).borderRadius
        )
    )
    .not.toBe(initialRadius);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const shareUrl = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  const shared = new URL(shareUrl);
  expect(JSON.parse(shared.searchParams.get("installation") ?? "null")).toEqual(
    selection
  );
  expect(shared.searchParams.has("scenario")).toBe(false);
  expect(shared.searchParams.has("__previewScenario")).toBe(false);
  expect(shared.searchParams.has("preset")).toBe(true);
  await page.goto(shareUrl);
  await expect(preview.getByTestId("chat-preview")).toHaveAttribute(
    "data-style",
    "lyra"
  );
  await page.getByRole("tab", { name: "Plugins", exact: true }).first().click();
  await expect(
    page.getByRole("switch", { name: "Feedback", exact: true })
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Projects", exact: true })
  ).toBeChecked();
  await expect(
    page.getByRole("tab", { name: "Preview", exact: true })
  ).toHaveCount(0);
  await preview.getByTestId("message-upvote").click();
  await expect(preview.getByTestId("message-upvote")).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.getByRole("switch", { name: "Feedback", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Projects", exact: true }).uncheck();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await expect(preview.getByTestId("message-upvote")).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: /^Chat menu:/u })
  ).toBeVisible();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const disabledUrl = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  await page.goto(disabledUrl);
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  await expect(preview.getByTestId("message-upvote")).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: /^Chat menu:/u })
  ).toBeVisible();
});

// The archive renderer cannot replay nested documents. Capture the same iframe
// route directly; the tests above verify its real parent, controls and transport.
for (const mobile of [false, true]) {
  test(`production plugin surfaces ${mobile ? "mobile dark RTL" : "desktop light"}`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    const { encodePreset, DEFAULT_PRESET_CONFIG } =
      await import("shadcn/preset");
    await page.setViewportSize({
      width: mobile ? 390 : 1000,
      height: mobile ? 1000 : 1050,
    });
    const mode = mobile ? "dark" : "light";
    await page.emulateMedia({ colorScheme: mode });
    const preset = encodePreset({
      ...DEFAULT_PRESET_CONFIG,
      style: mobile ? "rhea" : "lyra",
      theme: "rose",
    });
    await page.goto(
      `/create/preview?item=preview-02&rtl=${mobile}&preset=${preset}`
    );
    await expect(page.getByTestId("chat-preview")).toBeVisible();
    await page.evaluate(
      (data) => {
        window.postMessage(
          {
            type: "chatjs:create-installation",
            mode: data.mode,
            scenario: data.mobile ? "mutation-error" : "ready",
            installation: {
              gateway: "vercel",
              plugins: ["feedback", "projects", "credits", "search"],
              tools: [],
            },
          },
          location.origin
        );
      },
      { mode, mobile }
    );
    await expect(page.getByTestId("message-upvote")).toBeEnabled();
    await page.evaluate(async () => await document.fonts.ready);
    await page.addStyleTag({
      content:
        "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
    });
    await page.getByTestId("message-upvote").click();
    if (mobile) {
      await expect(
        page.getByText("Failed to upvote response.", { exact: true })
      ).toBeVisible();
      await expect(page.getByTestId("message-upvote")).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    } else {
      await expect(page.getByTestId("message-upvote")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    }
    await page.getByRole("button", { name: /^Chat menu:/u }).click();
    await page.getByRole("menuitem", { name: "Move to project" }).click();
    await page
      .getByLabel("Project", { exact: true })
      .selectOption({ label: "Launch plan" });
    if (mobile) {
      await page.getByRole("button", { name: "Move", exact: true }).click();
      await expect(page.getByRole("alert")).toHaveText(
        "Could not move the conversation. Try again."
      );
    }
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
      timeout: 10_000,
    });
    await uiVerify.snapshot(mobile ? "failed-move" : "move-dialog");
    await page.screenshot({ path: testInfo.outputPath("dialog.png") });
    if (mobile) {
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
      await expect(
        page.locator('a[data-active="true"]', { hasText: "Launch plan" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: "Launch plan", exact: true })
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Move", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Move to project" })
      ).toBeHidden();
      await expect(page.locator('[data-slot="sidebar-content"]')).toContainText(
        "Launch plan"
      );
      await expect(
        page.locator("a[data-active]", { hasText: "Launch plan" })
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await page
        .getByRole("navigation", { name: "breadcrumb" })
        .getByRole("link", { name: "Launch plan" })
        .click();
      await expect(page).toHaveURL(/\/create\/preview/u);
    }
    await expect(page.locator('[data-slot="sidebar-footer"]')).toContainText(
      "25.00"
    );
    await uiVerify.snapshot(mobile ? "unassigned-sidebar" : "assigned");
    await page.screenshot({ path: testInfo.outputPath("sidebar.png") });
    await page.getByRole("button", { name: /Search chats/u }).click();
    await expect(
      page.getByRole("option", { name: "Building something good", exact: true })
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Search conversations" })
      .fill("useful");
    await expect(
      page.getByRole("option", { name: /Building something good/u })
    ).toContainText("useful conversation");
    await uiVerify.snapshot("search results");
    await page.screenshot({ path: testInfo.outputPath("search.png") });
    await page
      .getByRole("combobox", { name: "Search conversations" })
      .fill("no-match");
    await expect(
      page.getByText("No chats found. Try different words.")
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Search conversations" })
      .fill("Building");
    await page
      .getByRole("option", { name: /Building something good/u })
      .click();
    await expect(page).toHaveURL(/\/create\/preview/u);
    await expect(
      page.getByRole("dialog", { name: "Search chats", exact: true })
    ).toBeHidden();
    uiVerify.disableAutoSnapshot();
  });
}

test("Credits and Search toggle live without backend calls or leaving Create", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:trpc|auth)|\/eve\//u.test(request.url())) {
      requests.push(request.url());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/create?item=preview");
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  await page.getByRole("switch", { name: "Credits", exact: true }).check();
  await page.getByRole("switch", { name: "Search", exact: true }).check();
  await expect(preview.locator('[data-slot="sidebar-footer"]')).toContainText(
    "25.00"
  );
  await preview.getByRole("button", { name: /Search chats/u }).click();
  await preview
    .getByRole("combobox", { name: "Search conversations" })
    .fill("useful");
  await preview
    .getByRole("option", { name: /Building something good/u })
    .click();
  await expect(
    preview.getByRole("heading", {
      name: "A small start. A great experience.",
      exact: true,
    })
  ).toBeVisible();
  await expect(
    preview.getByRole("dialog", { name: "Search chats", exact: true })
  ).toBeHidden();
  await preview.getByRole("button", { name: /Search chats/u }).focus();
  await page.keyboard.press("Control+k");
  await expect(
    preview.getByRole("dialog", { name: "Search chats", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Command Palette", exact: true })
  ).toBeHidden();
  await preview
    .getByRole("button", { name: "Close search", exact: true })
    .click();
  await page.getByRole("switch", { name: "Credits", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Search", exact: true }).uncheck();
  await expect(
    preview.getByRole("button", { name: /Search chats/u })
  ).toHaveCount(0);
  await expect(
    preview.locator('[data-slot="sidebar-footer"]')
  ).not.toContainText("25.00");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("plugin toggles mount real MCP, sharing and follow-up UI without backends", async ({
  page,
  uiVerify,
}, testInfo) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1440, height: 1100 });
  const backendRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/api\/(?:trpc|auth)|\/eve\/|https:\/\/example\.invalid\//u.test(
        request.url()
      )
    ) {
      backendRequests.push(request.url());
    }
  });
  await page.goto(
    `/create?item=preview-02&installation=${encodeURIComponent(JSON.stringify({ gateway: "vercel", plugins: [], tools: [] }))}`
  );
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  await expect(
    preview.getByRole("button", { name: "Composer options" })
  ).toHaveCount(0);
  await page.getByRole("switch", { name: "Mcp", exact: true }).check();
  const openConnectors = async () => {
    await preview.getByRole("button", { name: "Composer options" }).click();
    await preview
      .getByRole("menuitem", { name: "Connectors", exact: true })
      .click();
  };
  await openConnectors();
  const connector = preview.getByRole("menuitemcheckbox", {
    name: "Project knowledge",
  });
  await expect(connector).toBeChecked();
  await connector.click();
  await expect(connector).not.toBeChecked();
  await page.screenshot({ path: testInfo.outputPath("mcp.png") });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("switch", { name: "Mcp", exact: true }).uncheck();
  await expect(
    preview.getByRole("button", { name: "Composer options" })
  ).toHaveCount(0);
  await page.getByRole("switch", { name: "Mcp", exact: true }).check();
  await openConnectors();
  await expect(connector).not.toBeChecked();
  await preview.getByRole("menuitem", { name: "Manage connectors" }).click();
  await expect(
    preview.getByText(
      "This destination is not previewed yet. It is available in the generated app."
    )
  ).toBeVisible();
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  await page.getByRole("switch", { name: "Sharing", exact: true }).check();
  await preview
    .getByRole("button", { name: "Share chat", exact: true })
    .click();
  const dialog = preview.getByRole("dialog", {
    name: "Share chat",
    exact: true,
  });
  await expect(dialog).toContainText("Sample sharing only");
  await dialog.getByRole("button", { name: "Share Chat", exact: true }).click();
  const link = dialog.getByRole("textbox", { name: "Link", exact: true });
  await expect(link).toBeVisible();
  expect(new URL(await link.inputValue()).pathname).toBe("/create");
  await dialog.getByRole("button", { name: "Copy", exact: true }).click();
  expect(
    await page.evaluate(async () => await navigator.clipboard.readText())
  ).toBe(await link.inputValue());
  await page.screenshot({ path: testInfo.outputPath("sharing.png") });
  await dialog
    .getByRole("button", { name: "Make Private", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await page.getByRole("switch", { name: "Sharing", exact: true }).uncheck();
  await expect(
    preview.getByRole("button", { name: "Share chat", exact: true })
  ).toHaveCount(0);
  await page
    .getByRole("switch", { name: "Followup Suggestions", exact: true })
    .check();
  const suggestion = preview
    .getByRole("group", { name: "Related questions" })
    .getByRole("button", {
      name: "What should I build first?",
      exact: true,
    });
  await expect(suggestion).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("followups.png") });
  await suggestion.click();
  await expect(preview.locator('[data-role="user"]').last()).toContainText(
    "What should I build first?"
  );
  await page
    .getByRole("switch", { name: "Followup Suggestions", exact: true })
    .uncheck();
  await expect(suggestion).toHaveCount(0);
  expect(backendRequests).toEqual([]);
});

for (const scenario of ["ready", "mutation-error"] as const) {
  test(`new plugin surfaces on mobile RTL: ${scenario}`, async ({
    page,
    uiVerify,
  }, testInfo) => {
    uiVerify.disableAutoSnapshot();
    await page.setViewportSize({ width: 390, height: 950 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/create/preview?item=preview-02&rtl=true");
    await expect(page.getByTestId("chat-preview")).toBeVisible();
    await page.evaluate((previewScenario) => {
      window.postMessage(
        {
          type: "chatjs:create-installation",
          mode: "dark",
          scenario: previewScenario,
          installation: {
            gateway: "vercel",
            plugins: ["mcp", "sharing", "followup-suggestions"],
            tools: [],
          },
        },
        location.origin
      );
    }, scenario);
    await expect(
      page.getByRole("group", { name: "Related questions" })
    ).toBeVisible();
    await page.getByRole("button", { name: "Composer options" }).click();
    await page
      .getByRole("menuitem", { name: "Connectors", exact: true })
      .click();
    const connector = page.getByRole("menuitemcheckbox", {
      name: "Project knowledge",
    });
    await expect(connector).toBeChecked();
    await connector.click();
    if (scenario === "mutation-error") {
      await expect(
        page.getByText("Failed to update connector", { exact: true })
      ).toBeVisible();
      await expect(connector).toBeChecked();
    } else {
      await expect(connector).not.toBeChecked();
    }
    await page.screenshot({ path: testInfo.outputPath("mcp-mobile-rtl.png") });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^Chat menu:/u }).click();
    await page.getByRole("menuitem", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Share chat",
      exact: true,
    });
    await dialog
      .getByRole("button", { name: "Share Chat", exact: true })
      .click();
    if (scenario === "mutation-error") {
      await expect(
        page.getByText("Sample mutation failure", { exact: true })
      ).toBeVisible();
      await expect(dialog.getByText("Private", { exact: true })).toBeVisible();
    } else {
      await expect(
        dialog.getByRole("textbox", { name: "Link", exact: true })
      ).toBeVisible();
    }
    await page.screenshot({
      path: testInfo.outputPath("sharing-mobile-rtl.png"),
    });
    expect(errors).toEqual([]);
  });
}
