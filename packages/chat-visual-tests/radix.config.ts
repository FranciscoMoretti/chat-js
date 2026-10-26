import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uiverifyPlugin } from "@uiverify/vitest/plugin";
import { defineConfig } from "vitest/config";
import type { Alias, AliasOptions } from "vite";
import { transformUiSource } from "../registry/ui-source";
import interactions from "../registry/visual/vitest.config";
import pages from "./vitest.config";

const app = process.env.CHATJS_RADIX_APP;
if (app === undefined || !path.isAbsolute(app)) {
  throw new Error(
    "CHATJS_RADIX_APP must identify a generated Radix app by absolute path."
  );
}
const nativeConfig: unknown = JSON.parse(
  readFileSync(path.join(app, "components.json"), "utf-8")
);
const uiBase =
  typeof nativeConfig === "object" &&
  nativeConfig !== null &&
  "style" in nativeConfig &&
  typeof nativeConfig.style === "string" &&
  nativeConfig.style.startsWith("base-")
    ? "base"
    : "radix";
const interactionMode = process.env.CHATJS_RADIX_INTERACTIONS === "1";
const reference = interactionMode ? interactions : pages;
const root = fileURLToPath(new URL("../../", import.meta.url));
const primitives = path.join(app, "components/ui");
const nativeAliases = readdirSync(primitives)
  .filter((name) => name.endsWith(".tsx") && !name.includes("fixture"))
  .map((name) => ({
    find: `@/components/ui/${name.slice(0, -4)}`,
    replacement: path.join(primitives, name),
  }));

const isAliasList = (value: AliasOptions): value is readonly Alias[] =>
  Array.isArray(value);
const referenceAliases: AliasOptions = reference.resolve?.alias ?? {};

// Compare the same routes, state, tokens and capture identities using native
// Radix primitives. Compositions use the exact generator, not a runtime adapter.
export default defineConfig({
  ...reference,
  cacheDir: path.join(root, "node_modules/.vite/chat-radix"),
  resolve: {
    ...reference.resolve,
    // Generated sources and the shared test harness must use one native context.
    dedupe: ["@base-ui/react", ...(reference.resolve?.dedupe ?? [])],
    alias: [
      ...nativeAliases,
      ...(isAliasList(referenceAliases)
        ? referenceAliases
        : Object.entries(referenceAliases).map(([find, replacement]) => ({
            find,
            replacement,
          }))),
    ],
  },
  plugins: [
    {
      name: "chatjs-native-radix-fixture",
      enforce: "pre",
      transform(source, id) {
        if (
          id.endsWith("packages/registry/src/tools/_shared/visual.css") ||
          id.endsWith("apps/chat/tests/visual/sandbox.css")
        ) {
          return `${source}\n@source ${JSON.stringify(path.join(app, "components"))};\n`;
        }
        if (
          id.endsWith(".tsx") &&
          (id.startsWith(path.join(root, "apps/chat")) ||
            id.startsWith(path.join(root, "packages/registry/src")))
        ) {
          return transformUiSource(source, id, uiBase);
        }
        return null;
      },
    },
    uiverifyPlugin({
      outDir:
        process.env.UIVERIFY_ARCHIVE_DIR ??
        fileURLToPath(
          new URL(
            interactionMode
              ? "uiverify-radix-interactions"
              : "uiverify-radix-archive",
            import.meta.url
          )
        ),
    }),
  ],
  test: {
    ...reference.test,
    include: interactionMode
      ? [
          "../../apps/chat/tests/visual/direction.browser.tsx",
          "../../apps/chat/tests/visual/composer-interactions.browser.tsx",
          "../../apps/chat/tests/visual/composer-menu.browser.tsx",
          "../../apps/chat/tests/visual/conversation-native.browser.tsx",
          "../../apps/chat/tests/visual/model-selector.browser.tsx",
          "../../apps/chat/tests/visual/model-selector-actions.browser.tsx",
          "../../apps/chat/tests/visual/reasoning.browser.tsx",
          "../../apps/chat/tests/visual/sidebar-chat-item-sharing.browser.tsx",
          "../../apps/chat/tests/visual/sidebar-sign-out.browser.tsx",
          "../../apps/chat/tests/visual/share-dialog.browser.tsx",
          "../../apps/chat/tests/visual/mcp-settings.browser.tsx",
        ]
      : reference.test?.include,
    setupFiles: interactionMode
      ? interactions.test?.setupFiles
      : ["pages/setup.tsx"],
  },
});
