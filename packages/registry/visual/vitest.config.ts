import type { Page, Route } from "playwright";
import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { registeredProjectsPlugin } from "./registered-projects-plugin";
import { uiverifyPlugin } from "@uiverify/vitest/plugin";

const appRequire = createRequire(
  new URL("../../../apps/chat/package.json", import.meta.url)
);

// Resolve an exported entry so font aliases work with both hoisted and local
// installs. The exports map blocks direct woff2 imports.
const geistFonts = path.join(
  path.dirname(createRequire(import.meta.url).resolve("geist/font")),
  "fonts"
);

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
      "shiki",
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
      "geist-mono.woff2": path.join(
        geistFonts,
        "geist-mono/GeistMono-Variable.woff2"
      ),
      "geist-sans.woff2": path.join(
        geistFonts,
        "geist-sans/Geist-Variable.woff2"
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
        faviconAssets: async ({
          page,
        }: {
          readonly page: Page;
        }): Promise<void> => {
          await page.route(
            /^https:\/\/(?:favicon\.example\.test|www\.google\.com)\//u,
            async (route): Promise<void> => {
              await route.fulfill({
                body: route.request().url().endsWith("/broken.svg")
                  ? "Invalid image"
                  : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" rx="3" fill="#2563eb"/></svg>',
                contentType: "image/svg+xml",
              });
            }
          );
        },
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
      },
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
      viewport: { height: 900, width: 1000 },
    },
    include: [
      "src/tools/*/renderer.visual.tsx",
      "visual/*.browser.test.tsx",
      "../../apps/chat/tests/visual/*.browser.tsx",
    ],
  },
});
