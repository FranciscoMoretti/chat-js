/* oxlint-disable import/no-nodejs-modules -- Vite loads this Node config, which inspects the built docs directory on disk. */
import { existsSync, statSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
import type { Plugin } from "vitest/config";
import { defineConfig } from "vitest/config";

/* oxlint-disable import/no-nodejs-modules -- Vite loads this Node config, which joins filesystem paths for the built docs middleware. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import { playwright } from "@vitest/browser-playwright";
import { uiverifyPlugin } from "@uiverify/vitest/plugin";

const root = import.meta.dirname;
const dist = path.join(root, "dist");

/* oxlint-disable node/no-sync -- serveBuiltDocs: Keep this request-path check synchronous so request.url is rewritten before Connect next reaches Vite's downstream public-file middleware. */
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

          const querySuffix = query && `?${query}`;
          request.url = `${publicPath}${querySuffix ?? ""}`;
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
