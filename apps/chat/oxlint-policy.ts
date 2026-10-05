import type { OxlintConfig } from "oxlint";

// Audited policy is shared by the repository and generated apps.
// Deliberate policy exclusions are documented here; retained-rule exceptions belong beside the source.
export const auditedRestrictionRules = {
  "id-length": "error",
  "import/exports-last": "error",
  "import/group-exports": "error",
  "import/max-dependencies": "error",
  "import/no-default-export": "error",
  // Named exports are the documented package and application API convention.
  "import/no-named-export": "off",
  "import/no-namespace": "error",
  "import/no-nodejs-modules": "error",
  "import/no-relative-parent-imports": "error",
  // A single named export preserves the same API convention as multi-export modules.
  "import/prefer-default-export": "off",
  "init-declarations": "error",
  "jsdoc/require-param": "error",
  "jsdoc/require-param-type": "error",
  "jsdoc/require-returns": "error",
  "jsdoc/require-returns-type": "error",
  "max-lines": ["error", { skipComments: true }],
  "max-lines-per-function": ["error", { skipComments: true }],
  "max-params": "error",
  "max-statements": "error",
  "no-console": "error",
  "no-continue": "error",
  "no-magic-numbers": "error",
  "no-restricted-properties": "error",
  // Value-selecting ternaries are allowed; no-nested-ternary still limits nesting.
  "no-ternary": "off",
  "no-undefined": "error",
  "no-underscore-dangle": "error",
  "node/no-process-env": "error",
  "node/no-sync": "error",
  // ESM command and test initialization exceptions are documented at their source.
  "node/no-top-level-await": "error",
  // Reviewed native async and iterator contracts are explained at their source.
  "oxc/no-async-await": "error",
  // Optional chaining is required by the application coding guidance and supported by the target runtimes.
  "oxc/no-optional-chaining": "off",
  // Modern targets support typed object composition; no-map-spread still prevents accumulator copying.
  "oxc/no-rest-spread-properties": "off",
  "react-perf/jsx-no-jsx-as-prop": "error",
  // Native DOM props do not form component memoization boundaries; custom components remain checked.
  "react-perf/jsx-no-new-array-as-prop": ["error", { nativeAllowList: "all" }],
  "react-perf/jsx-no-new-function-as-prop": [
    "error",
    { nativeAllowList: "all" },
  ],
  "react-perf/jsx-no-new-object-as-prop": ["error", { nativeAllowList: "all" }],
  // Reviewed component styling contracts are documented beside the affected props.
  "react/forbid-component-props": "error",
  "react/jsx-max-depth": "error",
  // Authored product, legal and fixture copy is reviewed beside its rendering declaration.
  "react/jsx-no-literals": "error",
  "react/jsx-props-no-spreading": "error",
  "react/no-multi-comp": "error",
  "react/only-export-components": "error",
  // Components using the automatic JSX runtime explain that compiler contract locally.
  "react/react-in-jsx-scope": "error",
  // Conflicting declaration ordering is reviewed locally; named members remain sorted.
  "sort-imports": "error",
  "typescript/consistent-type-definitions": "error",
  "typescript/explicit-function-return-type": "error",
  "typescript/explicit-module-boundary-types": "error",
  "typescript/prefer-readonly-parameter-types": "error",
  "typescript/promise-function-async": "error",
  "typescript/strict-boolean-expressions": "error",
  "typescript/strict-void-return": "error",
  "unicorn/max-nested-calls": "error",
  "unicorn/no-null": "error",
} satisfies NonNullable<OxlintConfig["rules"]>;
