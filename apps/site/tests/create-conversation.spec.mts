import { test, expect } from "@uiverify/playwright";
import {
  DEFAULT_PRESET_CONFIG,
  encodePreset,
  PRESET_STYLES,
} from "shadcn/preset";

// One conversation contains bubbles, attachment, code, activity, scroller and
// composer. Alternate responsive layouts; the interaction matrix covers all four.
for (const base of ["base", "radix"] as const) {
  for (const [index, style] of PRESET_STYLES.entries()) {
    test(`${base} ${style} conversation with attachment`, async ({
      page,
      uiVerify,
    }) => {
      const mobile = index % 2 === 1;
      const mode = mobile ? "dark" : "light";
      await page.setViewportSize({
        width: mobile ? 390 : 1000,
        height: mobile ? 1400 : 1100,
      });
      await page.emulateMedia({ colorScheme: mode });
      const preset = encodePreset({ ...DEFAULT_PRESET_CONFIG, style });
      await page.goto(
        `/create/preview?base=${base}&preset=${preset}&rtl=${mobile}&item=preview-02`
      );
      await expect(
        page.getByRole("textbox", { name: "Message" })
      ).toBeVisible();
      await page.evaluate(
        (data) => {
          window.postMessage(data, window.location.origin);
        },
        {
          type: "chatjs:create-installation",
          installation: {
            gateway: "vercel",
            storage: { source: "vercel-blob" },
            plugins: ["attachment-uploads"],
            sandbox: "vercel",
          },
          mode,
        }
      );
      await expect(
        page.getByText("project-notes.md", { exact: true })
      ).toBeVisible();
      await expect(page.getByTestId("chat-preview")).toHaveAttribute(
        "data-style",
        style
      );
      await page.evaluate(async () => await document.fonts.ready);
      await page.addStyleTag({
        content:
          "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
      });
      await uiVerify.snapshot("conversation");
      await page.getByRole("button", { name: "Attach sample file" }).click();
      await expect(
        page.getByRole("button", { name: "Remove sample attachment" })
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Message" })
        .fill("Test the composer");
      await page.getByRole("button", { name: "Send" }).click();
      await expect(
        page.getByText("Test the composer", { exact: true })
      ).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Message" })).toHaveText(
        ""
      );
      uiVerify.disableAutoSnapshot();
    });
  }
}
