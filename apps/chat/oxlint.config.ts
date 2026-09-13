import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

import baseline from "./oxlint-baseline.json" with { type: "json" };

export default defineConfig({
  extends: [core, react, next],
  // Oxlint does not inherit ignorePatterns from extended configs.
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ".eve/**",
    "tests/eve-results/**",
  ],
  // Existing violations only: remove file/rule entries as they are fixed.
  overrides: [
    // EVE derives the public tool name from this filename.
    {
      files: [
        "agent/tools/confirm_note.ts",
        "tests/eve-fixture/agent/tools/confirm_note.ts",
      ],
      rules: { "unicorn/filename-case": "off" },
    },
    ...baseline.overrides.map(({ files, rules }) => ({
      files,
      rules: Object.fromEntries(
        Object.keys(rules).map((rule) => [rule, "off" as const])
      ),
    })),
  ],
  rules: {
    // Keep anonymous React callbacks consistent with prefer-arrow-callback.
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "arrow-function",
        unnamedComponents: "arrow-function",
      },
    ],
    // The codebase uses interfaces alongside intersection and mapped types.
    "typescript/consistent-type-definitions": "off",
    // Typed APIs (React refs, Promise resolvers and mocks) can require explicit undefined.
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
  },
});
