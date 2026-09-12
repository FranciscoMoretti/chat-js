import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { Plugin } from "vitest/config";

const root = import.meta.dirname;
const dist = path.join(root, "dist");

function serveBuiltDocs(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const [pathname = "/", query] = (request.url ?? "/").split("?");

        if (pathname === "/docs" || pathname.startsWith("/docs/")) {
          let publicPath = pathname.slice("/docs".length) || "/";
          const candidate = path.join(dist, publicPath);

          if (existsSync(candidate) && statSync(candidate).isDirectory()) {
            publicPath = `${publicPath.replace(/\/$/u, "")}/index.html`;
          }

          request.url = `${publicPath}${query ? `?${query}` : ""}`;
        }

        next();
      });
    },
    enforce: "pre",
    name: "serve-built-docs",
  };
}

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
