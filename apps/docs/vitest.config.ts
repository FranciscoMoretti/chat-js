import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig, type Plugin } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist");

function serveBuiltDocs(): Plugin {
  return {
    name: "serve-built-docs",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const [pathname = "/", query] = (request.url ?? "/").split("?");

        if (pathname === "/docs" || pathname.startsWith("/docs/")) {
          let publicPath = pathname.slice("/docs".length) || "/";
          const candidate = join(dist, publicPath);

          if (existsSync(candidate) && statSync(candidate).isDirectory()) {
            publicPath = `${publicPath.replace(/\/$/, "")}/index.html`;
          }

          request.url = `${publicPath}${query ? `?${query}` : ""}`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  publicDir: dist,
  plugins: [serveBuiltDocs(), uiverifyPlugin()],
  test: {
    include: ["e2e/**/*.browser.test.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      viewport: { width: 1440, height: 900 },
    },
  },
});
