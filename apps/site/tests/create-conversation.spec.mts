import { attachPreviewFile } from "./create-fixtures.mts";
import { test, expect } from "@uiverify/playwright";
import {
  DEFAULT_PRESET_CONFIG,
  encodePreset,
  PRESET_STYLES,
} from "shadcn/preset";

// One conversation contains bubbles, attachment, code, activity, scroller and
// composer. Alternate responsive layouts; the interaction matrix covers all four.
for (const base of ["base"] as const) {
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
      await attachPreviewFile(page);
      await expect(
        page.getByRole("button", { name: "Remove attachment" })
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

test("a pending attachment stays out of a new preview chat", async ({
  page,
  uiVerify,
}) => {
  uiVerify.disableAutoSnapshot();
  await page.setViewportSize({ width: 1000, height: 1100 });
  await page.goto("/create/preview?item=preview-02");
  await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "chatjs:create-installation",
        installation: { gateway: "vercel", plugins: ["attachment-uploads"] },
        mode: "light",
      },
      window.location.origin
    );
    const delayedRead = Promise.withResolvers();
    window.addEventListener(
      "release-preview-file",
      () => {
        delayedRead.resolve(null);
      },
      { once: true }
    );
    File.prototype.arrayBuffer = async function arrayBuffer(this: File) {
      const buffer = await Blob.prototype.arrayBuffer.call(this);
      if (document.body.dataset.previewFile === undefined) {
        document.body.dataset.previewFile = "pending";
        await delayedRead.promise;
      }
      return buffer;
    };
  });
  await expect(
    page.getByText("project-notes.md", { exact: true })
  ).toBeVisible();
  await attachPreviewFile(page);
  await expect(page.locator("body")).toHaveAttribute(
    "data-preview-file",
    "pending"
  );
  await page.getByRole("link", { name: /New Chat/u }).click();
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("release-preview-file"));
  });
  await attachPreviewFile(page);
  await expect(
    page.getByRole("button", { name: "Remove attachment" })
  ).toHaveCount(1);
});
