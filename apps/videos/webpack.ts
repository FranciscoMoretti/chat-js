/* oxlint-disable import/no-nodejs-modules -- the node:module import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { WebpackOverrideFn } from "@remotion/bundler";
/* oxlint-enable sort-imports */

const require = createRequire(path.resolve("package.json"));
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (webpackOverride); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- webpackOverride: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
// Resolve both peers from this workspace, including imports inside hoisted Remotion packages.
export const webpackOverride: WebpackOverrideFn = (config) => ({
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...config,
  resolve: {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing config.resolve own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...config.resolve,
    alias: {
      // oxlint-disable-next-line typescript/no-misused-spread, oxc/no-rest-spread-properties, oxc/no-optional-chaining -- Remotion supplies an alias map here; converting the alternative webpack array form needs an explicit resolution-precedence policy. Rest/spread: Keep the existing config.resolve?.alias own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Optional chain: Keep the existing nullish guard when reading alias from config.resolve; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      ...config.resolve?.alias,
      react: path.dirname(require.resolve("react/package.json")),
      "react-dom": path.dirname(require.resolve("react-dom/package.json")),
    },
  },
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
