/* oxlint-disable import/no-nodejs-modules -- the node:module import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/sort-imports -- the @remotion/bundler import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import type { WebpackOverrideFn } from "@remotion/bundler";
/* oxlint-enable eslint/sort-imports */

const require = createRequire(path.resolve("package.json"));
/* oxlint-disable import/prefer-default-export -- webpackOverride: Consumers use this named API so adding another export will not require changing existing imports. */
/* oxlint-disable import/no-named-export -- webpackOverride: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable oxc/no-rest-spread-properties -- webpackOverride: Fresh object composition preserves immutable state/configuration and existing override order. */
/* oxlint-disable oxc/no-optional-chaining -- webpackOverride: The guarded lookup intentionally permits missing SDK/state fields; preserve one evaluation of the existing optional access. */
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
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
