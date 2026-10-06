/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { fileURLToPath } from "node:url";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { playwright } from "@vitest/browser-playwright";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line sort-imports -- Oxfmt groups playwright after @vitest/browser-playwright; sort-imports instead requires this multiple-name type declaration before the single-name runtime declaration.
import type { Page, Route } from "playwright";
import { defineConfig } from "vitest/config";

import { registeredProjectsPlugin } from "./registered-projects-plugin";

const appRequire = createRequire(
  new URL("../../../apps/chat/package.json", import.meta.url)
);

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
export default defineConfig({
  css: {
    postcss: fileURLToPath(new URL("../../../apps/chat", import.meta.url)),
  },
  define: { IS_REACT_ACT_ENVIRONMENT: "true", "process.env": "{}" },
  optimizeDeps: {
    include: [
      "@trpc/server/observable",
      "next/dist/shared/lib/app-router-context.shared-runtime",
      "next/dist/shared/lib/hooks-client-context.shared-runtime",
      "next/link",
      "next/navigation",
      "@lexical/react/LexicalPlainTextPlugin",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-switch",
      "cmdk",
      "echarts",
      "nanoid",
      "next/dist/client/image-component",
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom/client",
      "react-dropzone",
      "sonner",
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [registeredProjectsPlugin(), uiverifyPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../../apps/chat", import.meta.url)),
      echarts: createRequire(import.meta.url).resolve("echarts"),
      // Browser optimization wraps the explicit CommonJS subpath as an object;
      // use the package's equivalent published ESM component in this Vite fixture.
      "echarts-for-react/lib/index": createRequire(import.meta.url).resolve(
        "echarts-for-react/esm/index.js"
      ),
      "next/image": fileURLToPath(new URL("next-image.ts", import.meta.url)),
      react: path.dirname(appRequire.resolve("react/package.json")),
      "react-dom": path.dirname(appRequire.resolve("react-dom/package.json")),
    },
    dedupe: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
    ],
  },
  test: {
    browser: {
      commands: {
        /* oxlint-disable oxc/no-async-await -- Install the fixture's external logo response before rendering and await each native Playwright route fulfillment. */
        modelAssets: async ({
          page,
        }: {
          readonly page: Readonly<Pick<Page, "route">>;
        }): Promise<void> => {
          await page.route(
            "https://models.dev/**",
            async (route: Readonly<Pick<Route, "fulfill">>): Promise<void> => {
              await route.fulfill({
                body: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect x="2" y="2" width="12" height="12" fill="currentColor"/></svg>',
                contentType: "image/svg+xml",
              });
            }
          );
        },
        /* oxlint-enable oxc/no-async-await */
      },
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
      viewport: { height: 900, width: 1000 },
    },
    include: [
      "visual/*.browser.test.tsx",
      "../../apps/chat/tests/visual/*.browser.tsx",
    ],
  },
});
/* oxlint-enable import/no-default-export */
