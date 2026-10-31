/* eslint-disable no-await-in-loop -- Each case updates the same interactive composer. */
import { test, expect } from "@uiverify/playwright";
import { composerDraftCases } from "../../../packages/chat-visual-tests/contracts/composer";

for (const base of ["base", "radix"] as const) {
  for (const width of [1000, 390]) {
    for (const rtl of [false, true]) {
      test(`${base} app composer and navigation ${width} ${rtl ? "rtl" : "ltr"}`, async ({
        page,
        uiVerify,
      }) => {
        uiVerify.disableAutoSnapshot();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({
          colorScheme: width === 390 ? "dark" : "light",
        });
        await page.goto(`/create/preview?base=${base}&item=preview&rtl=${rtl}`);
        const editor = page.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        const send = page.getByRole("button", { name: "Send", exact: true });
        await expect(editor).toHaveAttribute("contenteditable", "true");
        await expect(
          page.getByRole("heading", { name: "How can I help you today?" })
        ).toBeVisible();
        await expect(send).toBeDisabled();
        await expect(page.locator("html")).toHaveAttribute(
          "dir",
          rtl ? "rtl" : "ltr"
        );
        if (rtl === (width === 390)) {
          await page.evaluate(async () => await document.fonts.ready);
          await page.addStyleTag({
            content: "nextjs-portal { display: none !important; }",
          });
          await uiVerify.snapshot("app welcome and composer");
        }
        await editor.fill("Keep this draft");
        await editor.press(width === 390 ? "Enter" : "Shift+Enter");
        await expect(editor).toContainText("Keep this draft");
        await expect(
          page.getByText("This is a local preview.", { exact: false })
        ).toBeHidden();
        await editor.dispatchEvent("keydown", {
          key: "Enter",
          code: "Enter",
          isComposing: true,
          bubbles: true,
        });
        await expect(editor).toContainText("Keep this draft");
        await editor.fill("x".repeat(16_001));
        await expect(send).toBeDisabled();
        await expect(
          page.getByRole("alert").filter({ hasText: "16,000" })
        ).toBeVisible();
        await editor.fill("A native composer message");
        await expect(send).toBeEnabled();
        await editor.press(width === 390 ? "Control+Enter" : "Enter");
        await expect(
          page.getByText("A native composer message", { exact: true })
        ).toBeVisible();
        await expect(editor).toHaveText("");
        await expect(editor).toBeFocused();
        await page.keyboard.type("A follow-up without clicking");
        await expect(editor).toHaveText("A follow-up without clicking");
        await page.keyboard.press("ControlOrMeta+A");
        await page.keyboard.press("Backspace");
        await expect(editor).toHaveText("");
        await expect(send).toBeDisabled();

        await page.evaluate(() => {
          window.postMessage(
            {
              type: "chatjs:create-installation",
              installation: {
                gateway: "vercel",
                storage: { source: "vercel-blob" },
                plugins: ["attachment-uploads"],
                sandbox: "vercel",
              },
              mode: "light",
            },
            window.location.origin
          );
        });
        await page.getByRole("button", { name: "Attach sample file" }).click();
        await expect(send).toBeEnabled();
        await page
          .getByRole("button", { name: "Remove sample attachment" })
          .click();
        await expect(send).toBeDisabled();
        await page.getByRole("button", { name: "Attach sample file" }).click();
        await send.click();
        await expect(
          page
            .locator('[data-role="user"]')
            .getByText("project-notes.md", { exact: true })
        ).toBeVisible();
        await expect(
          page
            .locator('[data-role="assistant"]')
            .last()
            .getByText("This is a local preview.", { exact: false })
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Remove sample attachment" })
        ).toBeHidden();
        await expect(send).toBeDisabled();

        for (const state of composerDraftCases) {
          const remove = page.getByRole("button", {
            name: "Remove sample attachment",
          });
          if (state.hasAttachments && !(await remove.isVisible())) {
            await page
              .getByRole("button", { name: "Attach sample file" })
              .click();
          } else if (!state.hasAttachments && (await remove.isVisible())) {
            await remove.click();
          }
          await editor.fill(state.draft);
          await (state.canSend
            ? expect(send).toBeEnabled()
            : expect(send).toBeDisabled());
        }

        const toggle = page.getByRole("button", {
          name: "Toggle Sidebar",
          exact: true,
        });
        if (width === 1000) {
          await toggle.click();
          await expect(
            page.locator('[data-slot="sidebar"][data-state="collapsed"]')
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: "Weekend reading list" })
          ).toBeHidden();
          await toggle.click();
          await expect(
            page.getByRole("button", { name: "Weekend reading list" })
          ).toBeVisible();
        }
        if (width === 390) {
          await toggle.click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toBeHidden();
          await expect(toggle).toBeFocused();
          await toggle.click();
          if (rtl) {
            await uiVerify.snapshot("native mobile sidebar");
          }
        }
        await page
          .getByRole("button", { name: "New chat", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "How can I help you today?" })
        ).toBeVisible();
        await expect(page.getByRole("dialog")).toBeHidden();
        await expect(editor).toHaveText("");
        await expect(send).toBeDisabled();
        if (width === 390) {
          await toggle.click();
          await expect(page.getByRole("dialog")).toBeVisible();
        }
        await page
          .getByRole("button", { name: "Building something good", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeHidden();
        await expect(
          page.getByRole("heading", {
            name: "A small start. A great experience.",
          })
        ).toBeVisible();
        if (width === 390 && rtl) {
          await uiVerify.snapshot("conversation after mobile selection");
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
}
