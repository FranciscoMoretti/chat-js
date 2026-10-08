import { defineConfig } from "oxlint";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import core from "ultracite/oxlint/core";
/* oxlint-enable sort-imports */
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { auditedRestrictionRules } from "./oxlint-policy.ts";
/* oxlint-enable sort-imports */

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
    // EVE derives the public tool name from this filename.
    // Oxlint reports this rule at offset zero and cannot honor source directives.
    {
      files: [
        "agent/tools/deepResearch.ts",
        "agent/subagents/researcher/tools/webSearch.ts",
        "tests/eve-fixture/agent/tools/confirm_note.ts",
      ],
      rules: { "unicorn/filename-case": "off" },
    },
  ],
  rules: {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing auditedRestrictionRules own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...auditedRestrictionRules,
    "capitalized-comments": [
      "error",
      "always",
      { ignoreConsecutiveComments: true },
    ],
    "import/extensions": "error",
    "import/no-anonymous-default-export": "error",
    "import/no-commonjs": "error",
    "import/no-dynamic-require": "error",
    // Keep required CSS side effects and Next's server-only environment-poisoning marker allowed (#531).
    "import/no-unassigned-import": [
      "error",
      { allow: ["**/*.css", "server-only"] },
    ],
    "import/unambiguous": "error",
    "jsx-a11y/no-autofocus": "error",
    "max-depth": "error",
    // Next route handlers use uppercase names without being constructors (#513).
    "new-cap": ["error", { capIsNew: false }],
    "no-implicit-coercion": "error",
    "oxc/no-map-spread": "error",
    "promise/always-return": "error",
    "promise/catch-or-return": "error",
    "react/forward-ref-uses-ref": "error",
    // Keep anonymous React callbacks consistent with prefer-arrow-callback.
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "arrow-function",
        unnamedComponents: "arrow-function",
      },
    ],
    "react/jsx-boolean-value": "error",
    // Both TypeScript and JavaScript JSX modules use explicit JSX extensions.
    "react/jsx-filename-extension": ["error", { extensions: [".tsx", ".jsx"] }],
    "react/no-array-index-key": "error",
    "react/no-unknown-property": "error",
    "typescript/explicit-member-accessibility": "error",
    // Concise callbacks and explicit void discards are deliberate; other void values remain checked.
    "typescript/no-confusing-void-expression": [
      "error",
      { ignoreArrowShorthand: true, ignoreVoidOperator: true },
    ],
    "typescript/no-require-imports": "error",
    "typescript/no-var-requires": "error",
    "typescript/require-await": "error",
    // Default branches intentionally handle unknown/future union members.
    "typescript/switch-exhaustiveness-check": [
      "error",
      { considerDefaultExhaustiveForUnions: true },
    ],
    "unicorn/explicit-length-check": "error",
    "unicorn/no-array-callback-reference": "error",
    "unicorn/no-nested-ternary": "error",
    "unicorn/no-process-exit": "error",
    // Typed APIs (React refs, Promise resolvers and mocks) can require explicit undefined.
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
    "unicorn/number-literal-case": "error",
    "unicorn/prefer-global-this": "error",
    "unicorn/prefer-string-raw": "error",
    "unicorn/prefer-top-level-await": "error",
  },
});
