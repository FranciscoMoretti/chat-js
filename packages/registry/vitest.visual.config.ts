/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { fileURLToPath } from "node:url";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { playwright } from "@vitest/browser-playwright";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { defineConfig } from "vitest/config";
/* oxlint-enable eslint/sort-imports */

const appRequire = createRequire(
  new URL("../../apps/chat/package.json", import.meta.url)
);

// The `geist` package's exports map blocks deep woff2 imports, so resolve the
// variable font files by path and alias them (see _shared/visual.tsx).
const geistFonts = fileURLToPath(
  new URL("node_modules/geist/dist/fonts", import.meta.url)
);

/* oxlint-disable import/no-default-export -- The framework or tool loader consumes this default export by convention. */
export default defineConfig({
  css: {
    postcss: fileURLToPath(new URL("../../apps/chat", import.meta.url)),
  },
  define: { IS_REACT_ACT_ENVIRONMENT: "true", "process.env": "{}" },
  optimizeDeps: {
    include: [
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
      "react-dom/client",
      "react-dropzone",
      "shiki",
      "sonner",
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [uiverifyPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../apps/chat", import.meta.url)),
      echarts: createRequire(import.meta.url).resolve("echarts"),
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
    dedupe: ["react", "react-dom"],
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
      viewport: { height: 900, width: 1000 },
    },
    include: [
      "src/tools/*/renderer.visual.tsx",
      "../../apps/chat/tests/visual/*.browser.tsx",
    ],
  },
});
/* oxlint-enable import/no-default-export */
