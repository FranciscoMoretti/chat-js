import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

import baseline from "./oxlint-baseline.json" with { type: "json" };

export default defineConfig({
  extends: [core, react, next],
  // Oxlint does not inherit ignorePatterns from extended configs.
  ignorePatterns: core.ignorePatterns,
  // Existing violations only: remove file/rule entries as they are fixed.
  overrides: baseline.overrides.map(({ files, rules }) => ({
    files,
    rules: Object.fromEntries(Object.keys(rules).map((rule) => [rule, "off"])),
  })),
  rules: {
    // The codebase uses interfaces alongside intersection and mapped types.
    "typescript/consistent-type-definitions": "off",
  },
});
