/* oxlint-disable import/no-nodejs-modules -- the node:module import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import type { WebpackOverrideFn } from "@remotion/bundler";

const require = createRequire(path.resolve("package.json"));
/* oxlint-disable typescript/prefer-readonly-parameter-types -- webpackOverride: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
// Resolve both peers from this workspace, including imports inside hoisted Remotion packages.
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      // oxlint-disable-next-line typescript/no-misused-spread -- Remotion supplies an alias map here; converting the alternative webpack array form needs an explicit resolution-precedence policy.
      ...config.resolve?.alias,
      react: path.dirname(require.resolve("react/package.json")),
      "react-dom": path.dirname(require.resolve("react-dom/package.json")),
    },
  },
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
