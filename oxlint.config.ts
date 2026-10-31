import core from "ultracite/oxlint/core";
import { defineConfig } from "oxlint";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";

export default defineConfig({
  extends: [core, react, next, tanstack],
  // Oxlint does not inherit ignorePatterns from extended configs.
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    // shadcn-installed Code Block dependencies; keep upstream source unchanged.
    "apps/chat/hooks/use-highlighted-code.ts",
    "apps/chat/lib/highlighter.tsx",
    "examples/**",
    "apps/site/components/create-preview/ui/**",
    // Vendored MIT shadcn Create source; preserve upstream formatting and patterns.
    "apps/site/vendor/shadcn-create/**",
    "**/chatjs/generated/*.ts",
    // Library-installed components and generator-owned registrations.
    "**/components/{ai-elements,ui}/**",
    "!**/components/{ai-elements,ui}/**/",
    "!**/components/{ai-elements,ui}/extra/**",
    "!**/components/{ai-elements,ui}/**/*.{test,spec}.*",
    "!**/components/{ai-elements,ui}/**/__tests__/**",
    "**/.eve/**",
    "**/tests/eve-results/**",
  ],
  options: { reportUnusedDisableDirectives: "error", typeAware: true },
});
