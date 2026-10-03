/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { fileURLToPath } from "node:url";
/* oxlint-enable import/no-nodejs-modules */

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

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
      "sonner",
    ],
  },
  oxc: { jsx: { runtime: "automatic" } },
  plugins: [uiverifyPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../../apps/chat", import.meta.url)),
      echarts: createRequire(import.meta.url).resolve("echarts"),
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
      "visual/*.browser.test.tsx",
      "../../apps/chat/tests/visual/*.browser.tsx",
    ],
  },
});
/* oxlint-enable import/no-default-export */
