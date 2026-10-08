import type { WebpackOverrideFn } from "@remotion/bundler";

/* oxlint-disable import/no-nodejs-modules -- the node:module import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

const require = createRequire(path.resolve("package.json"));
const ALIAS_NOT_FOUND = -1;
const peerAliases = {
  react: path.dirname(require.resolve("react/package.json")),
  "react-dom": path.dirname(require.resolve("react-dom/package.json")),
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (webpackOverride); the enabled import/no-default-export convention rejects the default-export alternative. */
// Resolve both peers from this workspace, including imports inside hoisted Remotion packages.
export const webpackOverride: WebpackOverrideFn = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- This function reads config but returns its whole spread; a ReadonlyDeep compiler control makes nested config arrays readonly and fails the actual Configuration return receiver (TS2322), so keep the native nested return contract.
  config: Readonly<Parameters<WebpackOverrideFn>["0"]>
) => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Webpack permits an absent resolve section; retain the nullish guard while reading its alias contract.
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
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Preserve the first broad alias entry's own fields while replacing its target; prefer-object-spread rejects Object.assign.
        alias[index] = { ...alias[index], alias: target };
      }
    }
  } else {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Compose the narrowed alias map with peer targets in the existing override order; prefer-object-spread rejects Object.assign.
    alias = { ...alias, ...peerAliases };
  }
  return {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Preserve config own keys and the resolve override; prefer-object-spread rejects Object.assign.
    ...config,
    resolve: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Preserve resolve own keys and the alias override; prefer-object-spread rejects Object.assign.
      ...config.resolve,
      alias,
    },
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
