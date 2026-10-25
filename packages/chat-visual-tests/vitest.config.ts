import type { Page } from "playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import registry from "../registry/visual/vitest.config";
import { uiverifyPlugin } from "@uiverify/vitest/plugin";

const appIcon = fileURLToPath(
  new URL("../../apps/chat/app/icon.svg", import.meta.url)
);

// The chat app's pages, on the registry's browser setup (aliases, fonts, CSS),
// captured into this repository-only package's archive and UI Verify project.
export default defineConfig({
  ...registry,
  // Pages load their data after mount; tests wait for content instead of wrapping in act().
  define: { ...registry.define, IS_REACT_ACT_ENVIRONMENT: "false" },
  resolve: {
    ...registry.resolve,
    // The app and this workspace must share the testing adapter's context.
    dedupe: [...(registry.resolve?.dedupe ?? []), "nuqs"],
  },
  plugins: [
    uiverifyPlugin({
      outDir: fileURLToPath(new URL("uiverify-archive", import.meta.url)),
    }),
  ],
  test: {
    ...registry.test,
    browser: {
      ...registry.test?.browser,
      commands: {
        ...registry.test?.browser?.commands,
        // Next serves app/icon.svg at /icon.svg, which the sidebar shows as the logo.
        appIcon: async ({ page }: { readonly page: Page }): Promise<void> => {
          const body = await readFile(appIcon, "utf-8");
          await page.route("**/icon.svg", async (route): Promise<void> => {
            await route.fulfill({ body, contentType: "image/svg+xml" });
          });
        },
      },
    },
    include: ["pages/*.browser.tsx"],
    restoreMocks: true,
    setupFiles: ["pages/setup.tsx"],
    unstubGlobals: true,
  },
});
