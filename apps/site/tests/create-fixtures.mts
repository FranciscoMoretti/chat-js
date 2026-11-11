import { decodeAppPreset } from "../../../packages/registry/app-preset";
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
  const mode = await page.getByTestId("chat-preview").getAttribute("data-mode");
  await page.evaluate((theme) => {
    window.postMessage(
      {
        type: "chatjs:create-installation",
        installation: {
          gateway: "vercel",
          plugins: [],
          tools: ["tavily-search"],
        },
        mode: theme,
      },
      window.location.origin
    );
  }, mode);
};

/** Decode built-in choices from the CLI output; public config stays explicit. */
export const commandAppPreset = (command: string | null) => {
  const code = /--app-preset (?<code>a[0-9A-Za-z]+)/u.exec(command ?? "")
    ?.groups?.code;
  if (code === undefined) {
    throw new Error("Missing App preset in command");
  }
  return decodeAppPreset(code);
};
