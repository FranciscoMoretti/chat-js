import { existsSync, statSync } from "node:fs";
import type { Plugin } from "vitest/config";
import { defineConfig } from "vitest/config";

import path from "node:path";

import { playwright } from "@vitest/browser-playwright";
import { uiverifyPlugin } from "@uiverify/vitest/plugin";

const root = import.meta.dirname;
const dist = path.join(root, "dist");

const serveBuiltDocs = (): Plugin => ({
  configureServer(
    server: Readonly<{
      middlewares: Readonly<{
        use: Parameters<
          Extract<
            NonNullable<Plugin["configureServer"]>,
            (...args: readonly never[]) => unknown
          >
        >["0"]["middlewares"]["use"];
      }>;
    }>
  ) {
    server.middlewares.use((request, _response: unknown, next) => {
      const [pathname = "/", query] = (request.url ?? "/").split("?");

      if (pathname === "/docs" || pathname.startsWith("/docs/")) {
        let publicPath = pathname.slice("/docs".length) || "/";
        const candidate = path.join(dist, publicPath);

        if (existsSync(candidate) && statSync(candidate).isDirectory()) {
          publicPath = `${publicPath.replace(/\/$/u, "")}/index.html`;
        }

        const querySuffix = query && `?${query}`;
        request.url = `${publicPath}${querySuffix ?? ""}`;
      }

      next();
    });
  },
  enforce: "pre",
  name: "serve-built-docs",
});

export default defineConfig({
  plugins: [serveBuiltDocs(), uiverifyPlugin()],
  publicDir: dist,
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
      provider: playwright(),
      viewport: { height: 900, width: 1440 },
    },
    include: ["e2e/**/*.browser.test.ts"],
  },
});
