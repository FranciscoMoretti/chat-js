import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const appRequire = createRequire(
  new URL("../../../apps/chat/package.json", import.meta.url)
);

export default defineConfig({
  css: {
    postcss: fileURLToPath(new URL("../../../apps/chat", import.meta.url)),
  },
  define: { IS_REACT_ACT_ENVIRONMENT: "true", "process.env": "{}" },
  optimizeDeps: {
    include: [
      "@radix-ui/react-dialog",
      "sonner",
      "echarts",
      "next/dist/client/image-component",
      "react",
      "react-dom/client",
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
    include: ["visual/*.browser.test.tsx"],
  },
});
