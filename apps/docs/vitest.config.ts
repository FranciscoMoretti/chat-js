/* oxlint-disable import/no-nodejs-modules -- the node:fs import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { existsSync, statSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { uiverifyPlugin } from "@uiverify/vitest/plugin";
/* oxlint-disable eslint/sort-imports -- the @vitest/browser-playwright import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { playwright } from "@vitest/browser-playwright";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- the vitest/config import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { defineConfig } from "vitest/config";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- the vitest/config import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import type { Plugin } from "vitest/config";
/* oxlint-enable eslint/sort-imports */

const root = import.meta.dirname;
const dist = path.join(root, "dist");

/* oxlint-disable node/no-sync -- serveBuiltDocs: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
/* oxlint-disable eslint/no-ternary -- serveBuiltDocs: The expression preserves the existing fallback/derived-value contract within this operation. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- serveBuiltDocs: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const serveBuiltDocs = (): Plugin => ({
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
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
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
