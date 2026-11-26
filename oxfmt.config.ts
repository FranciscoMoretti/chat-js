import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // These generated indexes have content hashes checked by chat-js sync.
  // Reformatting their bodies invalidates the guard against overwriting user edits.
  ignorePatterns: [
    // Generated from the typed brand sources.
    "packages/brand/assets/runtime/*.js",
    ...(ultracite.ignorePatterns ?? []),
    // shadcn-installed Code Block dependencies; keep upstream source unchanged.
    "apps/chat/hooks/use-highlighted-code.ts",
    "apps/chat/lib/highlighter.tsx",
    "examples/**",
    "apps/site/components/create-preview/ui/**",
    // Vendored MIT shadcn Create source; preserve upstream formatting and patterns.
    "apps/site/vendor/shadcn-create/**",
    "**/chatjs/generated/*.ts",
    "**/components/{ai-elements,ui}/**",
    "!**/components/{ai-elements,ui}/**/",
    "!**/components/{ai-elements,ui}/extra/**",
    "!**/components/{ai-elements,ui}/**/*.{test,spec}.*",
    "!**/components/{ai-elements,ui}/**/__tests__/**",
    "**/lib/db/migrations/meta/**",
    "**/composer-icons.generated.ts",
    "**/.eve/**",
    "**/tests/eve-results/**",
  ],
  // Preserve module evaluation order; lint-policy changes must not reorder imports.
  sortImports: false,
});
