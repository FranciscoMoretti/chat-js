import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // These generated indexes have content hashes checked by chat-js sync.
  // Reformatting their bodies invalidates the guard against overwriting user edits.
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    // shadcn-installed Code Block dependencies; keep upstream source unchanged.
    "apps/chat/hooks/use-highlighted-code.ts",
    "apps/chat/lib/highlighter.tsx",
    "examples/**",
    "apps/site/components/create-preview/ui/**",
    // Vendored MIT shadcn Create source; preserve upstream formatting and patterns.
    "apps/site/vendor/shadcn-create/**",
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
