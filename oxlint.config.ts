import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

import { documentedRuleExceptions } from "./apps/chat/oxlint-policy.ts";

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
    // #533: The Forge launcher is CommonJS; Electron declarations augment the global Window namespace.
    // This zero-offset rule does not honor source disable directives.
    {
      files: ["apps/electron/scripts/run-forge.cjs", "apps/chat/electron.d.ts"],
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
  rules: {
    ...documentedRuleExceptions,
    "capitalized-comments": [
      "error",
      "always",
      { ignoreConsecutiveComments: true },
    ],
    "import/extensions": "error",
    "import/no-anonymous-default-export": "error",
    "import/no-commonjs": "error",
    "import/no-dynamic-require": "error",
    // Stylesheets and server-only markers intentionally execute on import (#531).
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
    // Typed APIs (React refs, Promise resolvers and mocks) can require explicit undefined.
    "unicorn/no-process-exit": "error",
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
    "unicorn/number-literal-case": "error",
    "unicorn/prefer-global-this": "error",
    "unicorn/prefer-string-raw": "error",
    "unicorn/prefer-top-level-await": "error",
  },
});
