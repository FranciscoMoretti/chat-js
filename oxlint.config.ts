import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react, next],
  // Oxlint does not inherit ignorePatterns from extended configs.
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    "examples/**",
    "**/.eve/**",
    "**/tests/eve-results/**",
  ],
  overrides: [
    {
      files: [
        "**/*.{test,spec,test-d,spec-d}.{ts,tsx,js,jsx}",
        "**/__tests__/**/*.{ts,tsx,js,jsx}",
      ],
      rules: { "no-empty-function": "error" },
    },
  ],
  rules: {
    "capitalized-comments": [
      "error",
      "always",
      { ignoreConsecutiveComments: true },
    ],
    "import/no-dynamic-require": "error",
    "max-depth": "error",
    "no-implicit-coercion": "error",
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
    "react/no-unknown-property": "error",
    // The codebase uses interfaces alongside intersection and mapped types.
    "typescript/consistent-type-definitions": "off",
    "typescript/explicit-member-accessibility": "error",
    "unicorn/explicit-length-check": "error",
    "unicorn/no-array-callback-reference": "error",
    // Typed APIs (React refs, Promise resolvers and mocks) can require explicit undefined.
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
    "unicorn/number-literal-case": "error",
    "unicorn/prefer-string-raw": "error",
  },
});
