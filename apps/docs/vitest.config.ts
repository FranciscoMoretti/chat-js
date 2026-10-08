/* oxlint-disable import/no-nodejs-modules -- the node:fs import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { existsSync, statSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { playwright } from "@vitest/browser-playwright";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { Plugin } from "vitest/config";
/* oxlint-enable sort-imports */
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;
const dist = path.join(root, "dist");

/* oxlint-disable node/no-sync -- serveBuiltDocs: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
const serveBuiltDocs = (): Plugin => ({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Vite's native server owns the middleware registry; this plugin registers the Connect callback through its mutable use() API.
  configureServer(server) {
    server.middlewares.use(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- The callback rewrites request.url to serve built documentation paths; Connect requires a writable incoming request.
      (request, _response: unknown, next) => {
        const [pathname = "/", query] = (request.url ?? "/").split("?");

        if (pathname === "/docs" || pathname.startsWith("/docs/")) {
          let publicPath = pathname.slice("/docs".length) || "/";
          const candidate = path.join(dist, publicPath);

          if (existsSync(candidate) && statSync(candidate).isDirectory()) {
            publicPath = `${publicPath.replace(/\/$/u, "")}/index.html`;
          }

          // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          request.url = `${publicPath}${query ? `?${query}` : ""}`;
        }

        next();
      }
    );
  },
  enforce: "pre",
  name: "serve-built-docs",
});
/* oxlint-enable node/no-sync */

/* oxlint-disable import/no-default-export -- vitest.config.ts: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
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
/* oxlint-enable import/no-default-export */
