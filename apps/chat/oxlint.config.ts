import { auditedRestrictionRules } from "./oxlint-policy.ts";
import core from "ultracite/oxlint/core";
import { defineConfig } from "oxlint";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

// oxlint-disable-next-line import/no-default-export -- Oxlint loads its configuration through this required default export.
export default defineConfig({
  extends: [core, react, next],
  // Oxlint does not inherit ignorePatterns from extended configs.
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ".eve/**",
    "tests/eve-results/**",
  ],
  overrides: [
    // #721: Node executes the Forge launcher as CommonJS; ESM syntax would break it.
    // Oxlint reports at offset zero and ignores source disable directives.
    {
      // The generated single-app layout copies apps/electron to electron/.
      files: ["electron/scripts/run-forge.cjs"],
      rules: { "import/unambiguous": "off" },
    },
    {
      files: [
        "**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}",
        "**/__tests__/**/*.{ts,tsx,js,jsx}",
      ],
      rules: {
        "no-empty-function": "error",
        "promise/prefer-await-to-then": "error",
      },
    },
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
  rules: auditedRestrictionRules,
});
