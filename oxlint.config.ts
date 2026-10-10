import { auditedRestrictionRules } from "./apps/chat/oxlint-policy.ts";
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
    "examples/**",
    "**/.eve/**",
    "**/tests/eve-results/**",
  ],
  options: { typeAware: true },
  overrides: [
    // #721: Node executes the Forge launcher as CommonJS; ESM syntax would break it.
    // Oxlint reports at offset zero and ignores source disable directives.
    {
      files: ["apps/electron/scripts/run-forge.cjs"],
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
  ],
  rules: auditedRestrictionRules,
});
