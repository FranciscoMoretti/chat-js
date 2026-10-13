import type { WebpackOverrideFn } from "@remotion/bundler";

import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.resolve("package.json"));
const ALIAS_NOT_FOUND = -1;
const peerAliases = {
  react: path.dirname(require.resolve("react/package.json")),
  "react-dom": path.dirname(require.resolve("react-dom/package.json")),
};

// Resolve both peers from this workspace, including imports inside hoisted Remotion packages.
export const webpackOverride: WebpackOverrideFn = (
  config: Readonly<Parameters<WebpackOverrideFn>["0"]>
) => {
  let alias = config.resolve?.alias;
  if (Array.isArray(alias)) {
    // Keep native ordering and exact-only aliases, just as distinct map keys are preserved.
    alias = [...alias];
    for (const [name, target] of Object.entries(peerAliases)) {
      const index = alias.findIndex(
        (option: Readonly<{ name: string; onlyModule?: boolean }>) =>
          option.name === name && option.onlyModule !== true
      );
      if (index === ALIAS_NOT_FOUND) {
        alias.push({ alias: target, name });
      } else {
        alias[index] = { ...alias[index], alias: target };
      }
    }
  } else {
    alias = { ...alias, ...peerAliases };
  }
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias,
    },
  };
};
