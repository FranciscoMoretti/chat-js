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
    "examples/**",
    // Library-installed components and generator-owned registrations.
    "**/components/{ai-elements,ui}/**",
    "**/features/{installed,installed-routers,installed-uploads,installed-layout,installed-instrumentation}.ts",
    "**/tools/chatjs/{tools,ui,providers,code-executor,workflow-types,tool-availability,document-ui,document-run,installed-features,composer-tools}.ts",
    "**/.eve/**",
    "**/tests/eve-results/**",
  ],
  options: { typeAware: true },
});
