import { createRequire } from "node:module";
import path from "node:path";

import type { WebpackOverrideFn } from "@remotion/bundler";

const require = createRequire(path.resolve("package.json"));
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
