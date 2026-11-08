import { attachPreviewFile, selectPreviewTools } from "./create-fixtures.mts";
/* eslint-disable no-await-in-loop -- Verify each scene in the same host session. */
import { test, expect } from "playwright/test";

// Protect the integration seam: local data must use the production transcript,
// keep its composer visible, and retain working controls after scene changes.
for (const width of [1280, 390]) {
  for (const rtl of [false, true]) {
    test(`shared conversation ${width} ${rtl ? "rtl" : "ltr"}`, async ({
      page,
    }, testInfo) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/create/preview?item=preview&rtl=${rtl}`);
      await page.addStyleTag({
        content: "nextjs-portal { display: none !important; }",
      });
      const editor = page.getByRole("textbox", {
        name: "Message",
        exact: true,
      });
      const send = page.getByRole("button", { name: "Send", exact: true });
      await expect(
        page.getByRole("heading", { name: "How can I help you today?" })
      ).toBeVisible();
      await expect(send).toBeDisabled();
      await editor.fill("Test the shared conversation");
      await editor.press(width === 390 ? "Control+Enter" : "Enter");
      await expect(page.locator('[data-role="user"]')).toContainText(
        "Test the shared conversation"
      );
      await expect(
        page.locator('[data-role="assistant"][data-eve-message-id]')
      ).toContainText("This is a local preview.");
      await expect(editor).toBeFocused();
      await expect(page.getByTestId("message-assistant-loading")).toBeHidden();
      await expect(editor).toHaveText("");
      await expect(send).toBeInViewport();

      await page.evaluate(() => {
        window.postMessage(
          {
            type: "chatjs:create-installation",
            installation: {
              gateway: "vercel",
              plugins: ["attachment-uploads"],
              storage: { source: "vercel-blob" },
              sandbox: "vercel",
            },
            mode: "light",
          },
          window.location.origin
        );
      });
      await attachPreviewFile(page);
      await expect(send).toBeEnabled();
      await page.getByRole("button", { name: "Remove attachment" }).click();
      await expect(send).toBeDisabled();
      await attachPreviewFile(page);
      await send.click();
      await expect(
        page.locator('[data-role="user"]').last().getByText("project-notes.png")
      ).toBeVisible();

      await page.goto(`/create/preview?item=preview-02&rtl=${rtl}`);
      await expect(
        page.getByRole("heading", {
          name: "A small start. A great experience.",
        })
      ).toBeAttached();
      await page
        .getByRole("button", { name: "Copy Code", exact: true })
        .click();
      expect(
        await page.evaluate(async () => {
          const text = await navigator.clipboard.readText();
          return text.trim();
        })
      ).toBe("bunx @chat-js/cli@beta create my-chat");
      await expect(
        page
          .locator('[data-role="assistant"]')
          .getByRole("button", { name: "Copy", exact: true })
      ).toBeVisible();
      await expect(send).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath("conversation.png") });

      await page.goto(`/create/preview?item=preview-tools&rtl=${rtl}`);
      await selectPreviewTools(page);
      await expect(
        page.getByRole("alert").filter({ hasText: "No external tool runs" })
      ).toBeVisible();
      if (width === 390) {
        const toggle = page.getByRole("button", { name: "Toggle Sidebar" });
        await toggle.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(toggle).toBeFocused();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test("host configuration does not cover the shared composer or reset its draft", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/create");
  const frame = page.frameLocator("iframe");
  const editor = frame.getByRole("textbox", { name: "Message", exact: true });
  await editor.fill("Keep this draft");
  const bounds = await page.locator("iframe").boundingBox();
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  await page.getByRole("switch", { name: "Feedback", exact: true }).check();
  await expect(
    frame.getByRole("button", { name: "Upvote Response", exact: true })
  ).toBeVisible();
  await expect(editor).toHaveText("Keep this draft");
  expect(await page.locator("iframe").boundingBox()).toEqual(bounds);
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await frame.getByRole("button", { name: "Send", exact: true }).click();
  await expect(frame.locator('[data-role="user"]').last()).toContainText(
    "Keep this draft"
  );
  const scenes = page.getByRole("group", {
    name: "Preview scene",
    exact: true,
  });
  for (const scene of [
    { button: "New chat", title: "" },
    { button: "Tools", title: "Building something good" },
    { button: "Chat", title: "Building something good" },
  ]) {
    await scenes
      .getByRole("button", { name: scene.button, exact: true })
      .click();
    await expect(
      scenes.getByRole("button", { name: scene.button, exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await (scene.title
      ? expect(
          frame.getByRole("navigation", { name: "breadcrumb" })
        ).toContainText(scene.title)
      : expect(
          frame.getByRole("heading", { name: "How can I help you today?" })
        ).toBeVisible());
    await expect(
      frame.getByRole("button", { name: "Preview scenario" })
    ).toHaveCount(0);
    expect(await page.locator("iframe").boundingBox()).toEqual(bounds);
  }
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  expect(errors).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("scene-toolbar-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(scenes).toBeInViewport();
  await expect(
    scenes.getByRole("button", { name: "Tools", exact: true })
  ).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("scene-toolbar-mobile.png"),
  });
});
