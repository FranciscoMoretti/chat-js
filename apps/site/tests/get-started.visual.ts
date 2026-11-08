import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

// Run with the site dev server and PORT supplied by worktree-env.
const browser = await chromium.launch();
const output = fileURLToPath(
  new URL("../uiverify-screenshots/get-started/", import.meta.url)
);
await mkdir(output, { recursive: true });
const command = "npx chat-js@alpha create my-app";

const captureViewport = async (width: number): Promise<void> => {
  const page = await browser.newPage({
    permissions: ["clipboard-read", "clipboard-write"],
    reducedMotion: "reduce",
    viewport: { height: 900, width },
  });
  await page.goto(`http://localhost:${process.env.PORT}`, {
    waitUntil: "domcontentloaded",
  });
  const section = page.locator(".hero-cli");
  await section.waitFor();
  await page.evaluate(async () => await document.fonts.ready);
  assert.equal(await section.locator("code").textContent(), command);
  await section.screenshot({
    animations: "disabled",
    path: `${output}${width}-default.png`,
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  await section.getByRole("button", { name: "Copy create command" }).click();
  await section.getByText("Copied", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(async () => await navigator.clipboard.readText()),
    command
  );
  await section.screenshot({
    animations: "disabled",
    path: `${output}${width}-copied.png`,
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  assert.equal(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth
    ),
    true,
    "The install command does not cause horizontal page overflow"
  );
  await page.close();
};

try {
  await captureViewport(1440);
  await captureViewport(390);
  console.log(
    `CLI install command and clipboard verified; captures in ${output}`
  );
} finally {
  await browser.close();
}
