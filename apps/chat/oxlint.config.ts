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
    // Library-installed components and generator-owned registrations.
    "**/components/{ai-elements,ui}/**",
    "**/features/{installed,installed-routers,installed-uploads,installed-layout,installed-instrumentation}.ts",
    "**/tools/chatjs/{tools,ui,providers,code-executor,workflow-types,tool-availability,document-ui,document-run,installed-features,composer-tools}.ts",
    ".eve/**",
    "tests/eve-results/**",
  ],
  overrides: [
    // EVE uses discovered tool filenames verbatim as IDs for deepResearch and webSearch; confirm_note is preserved by its explicit map key.
    // Oxlint 1.82 reports filename-case at offset zero and ignores source directives; a native probe reproduced this for both remaining exceptions.
    {
      files: [
        "agent/tools/deepResearch.ts",
        "agent/subagents/researcher/tools/webSearch.ts",
      ],
      rules: { "unicorn/filename-case": "off" },
    },
  ],
});
