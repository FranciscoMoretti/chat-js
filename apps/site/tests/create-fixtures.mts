import type { Page, FrameLocator } from "playwright/test";

/** Exercise the production file-input path with a local, disposable fixture. */
export const attachPreviewFile = async (scope: Page | FrameLocator) => {
  await scope.locator('input[type="file"]').setInputFiles({
    name: "project-notes.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
      "base64"
    ),
  });
};

export const selectPreviewTools = async (page: Page) => {
  await page.getByTestId("chat-preview").waitFor();
  await page.evaluate(() => {
    window.postMessage(
      {
        type: "chatjs:create-installation",
        installation: {
          gateway: "vercel",
          plugins: [],
          tools: ["tavily-search"],
        },
        mode: "light",
      },
      window.location.origin
    );
  });
};
