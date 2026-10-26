import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // These generated indexes have content hashes checked by chat-js sync.
  // Reformatting their bodies invalidates the guard against overwriting user edits.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    // shadcn-installed Code Block dependencies; keep upstream source unchanged.
    "hooks/use-highlighted-code.ts",
    "lib/highlighter.tsx",
    "**/components/{ai-elements,ui}/**",
    "!**/components/{ai-elements,ui}/**/",
    "!**/components/{ai-elements,ui}/extra/**",
    "!**/components/{ai-elements,ui}/**/*.{test,spec}.*",
    "!**/components/{ai-elements,ui}/**/__tests__/**",
    "**/composition/generated/{installed,installed-database,installed-routers,installed-uploads,installed-layout,installed-instrumentation}.ts",
    "**/lib/db/migrations/meta/**",
    "**/composer-icons.generated.ts",
    ".eve/**",
    "tests/eve-results/**",
    // The model catalog is generator-owned; avoid unrelated snapshot churn.
    "lib/ai/models.generated.ts",
    "**/composition/generated/*.ts",
  ],
  // Preserve module evaluation order; lint-policy changes must not reorder imports.
  sortImports: false,
});
