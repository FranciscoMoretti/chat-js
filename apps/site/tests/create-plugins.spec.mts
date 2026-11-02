import type { Page } from "playwright/test";
import { test, expect } from "@uiverify/playwright";

const setup = async (page: Page) => {
  await page.goto("/create?item=preview-02");
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await page.getByRole("switch", { name: "Feedback", exact: true }).check();
  await page.getByRole("switch", { name: "Projects", exact: true }).check();
  await page.getByRole("button", { name: "Close", exact: true }).click();
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
  await preview.getByRole("button", { name: "Conversation actions" }).click();
  await preview.getByRole("menuitem", { name: "Move to project" }).click();
  await preview
    .getByLabel("Project", { exact: true })
    .selectOption({ label: "Launch plan" });
  await preview.getByRole("button", { name: "Move", exact: true }).click();
  await expect(
    preview.getByRole("dialog", { name: "Move to project" })
  ).toBeHidden();
  await expect(preview.getByTestId("sample-history")).toContainText(
    "Launch plan conversations"
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
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Preview scenario", { exact: true })
    .selectOption("mutation-error");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(preview.getByTestId("sample-history")).toContainText("Today");
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
    `/create?item=preview-02&installation=${encodeURIComponent(JSON.stringify(selection))}&scenario=mutation-error`
  );
  const preview = page.frameLocator('iframe[title="Preview"]');
  await expect(preview.getByTestId("message-upvote")).toBeEnabled();
  await preview.getByRole("button", { name: "Conversation actions" }).click();
  await preview.getByRole("menuitem", { name: "Move to project" }).click();
  const dialog = preview.getByRole("dialog", { name: "Move to project" });
  await expect(dialog).toHaveClass(/cn-dialog-content/u);
  const initialRadius = await dialog.evaluate(
    (element) => getComputedStyle(element).borderRadius
  );
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
  expect(shared.searchParams.get("scenario")).toBe("mutation-error");
  expect(shared.searchParams.has("preset")).toBe(true);
  await page.goto(shareUrl);
  await expect(preview.getByTestId("chat-preview")).toHaveAttribute(
    "data-style",
    "lyra"
  );
  await page
    .getByRole("button", { name: "Get Code", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("switch", { name: "Feedback", exact: true })
  ).toBeChecked();
  await expect(
    page.getByRole("switch", { name: "Projects", exact: true })
  ).toBeChecked();
  await expect(
    page.getByLabel("Preview scenario", { exact: true })
  ).toHaveValue("mutation-error");
  await expect(page.getByLabel("CLI limitations")).toContainText(
    "Plugin feedback: not represented"
  );
  await expect(page.getByLabel("CLI limitations")).toContainText(
    "Tool get-weather: not represented"
  );
  await expect(page.getByTestId("create-command")).toContainText("--projects");
  await page
    .getByRole("switch", { name: "Attachment uploads", exact: true })
    .check();
  await expect(
    page.getByRole("switch", { name: "Feedback", exact: true })
  ).toBeChecked();
  await page.getByRole("switch", { name: "Feedback", exact: true }).uncheck();
  await page.getByRole("switch", { name: "Projects", exact: true }).uncheck();
  await expect(page.getByTestId("create-command")).toContainText(
    "--no-projects"
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(preview.getByTestId("message-upvote")).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Conversation actions" })
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  const disabledUrl = await page.evaluate(
    async () => await navigator.clipboard.readText()
  );
  await page.goto(disabledUrl);
  await expect(preview.getByTestId("chat-preview")).toBeVisible();
  await expect(preview.getByTestId("message-upvote")).toHaveCount(0);
  await expect(
    preview.getByRole("button", { name: "Conversation actions" })
  ).toHaveCount(0);
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
              plugins: ["feedback", "projects"],
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
    await page.getByRole("button", { name: "Conversation actions" }).click();
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
      await expect(page.getByTestId("sample-history")).not.toContainText(
        "Launch plan conversations"
      );
      await expect(
        page.getByRole("link", { name: "Launch plan", exact: true })
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Move", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Move to project" })
      ).toBeHidden();
      await expect(page.getByTestId("sample-history")).toContainText(
        "Launch plan conversations"
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
    await uiVerify.snapshot(mobile ? "unassigned-sidebar" : "assigned");
    await page.screenshot({ path: testInfo.outputPath("sidebar.png") });
    uiVerify.disableAutoSnapshot();
  });
}
