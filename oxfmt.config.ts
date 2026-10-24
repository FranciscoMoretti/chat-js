import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // These generated indexes have content hashes checked by chat-js sync.
  // Reformatting their bodies invalidates the guard against overwriting user edits.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "examples/**",
    "**/composition/generated/*.ts",
    "**/components/{ai-elements,ui}/**",
    "!**/components/{ai-elements,ui}/**/",
    "!**/components/{ai-elements,ui}/extra/**",
    "!**/components/{ai-elements,ui}/**/*.{test,spec}.*",
    "!**/components/{ai-elements,ui}/**/__tests__/**",
    "**/lib/db/migrations/meta/**",
    "**/composer-icons.generated.ts",
    "**/.eve/**",
    "**/tests/eve-results/**",
    // The model catalog is generator-owned; avoid unrelated snapshot churn.
    "**/lib/ai/models.generated.ts",
  ],
  // Preserve module evaluation order; lint-policy changes must not reorder imports.
  sortImports: false,
});
