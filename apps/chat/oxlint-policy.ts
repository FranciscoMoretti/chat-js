import type { OxlintConfig } from "oxlint";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (auditedRestrictionRules); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
// Audited policy is shared by the repository and generated apps.
// Reviewed rule conflicts and contract exceptions belong beside the source.
export const auditedRestrictionRules = {
  "id-length": "error",
  "import/exports-last": "error",
  "import/group-exports": "error",
  "import/max-dependencies": "error",
  "import/no-default-export": "error",
  // Existing named module contracts explain the conflicting export convention locally.
  "import/no-named-export": "error",
  "import/no-namespace": "error",
  "import/no-nodejs-modules": "error",
  "import/no-relative-parent-imports": "error",
  // Single named bindings retain their reviewed module/API contracts beside the source.
  "import/prefer-default-export": "error",
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
  // Guard returns are preferred; conflicts with prefer-ternary are explained at each value-selection site.
  "no-ternary": "error",
  "no-undefined": "error",
  "no-underscore-dangle": "error",
  "node/no-process-env": "error",
  "node/no-sync": "error",
  // ESM command and test initialization exceptions are documented at their source.
  "node/no-top-level-await": "error",
  // Reviewed native async and iterator contracts are explained at their source.
  "oxc/no-async-await": "error",
  // Reviewed nullish access, callback and fallback contracts are explained beside each chain.
  "oxc/no-optional-chaining": "error",
  // Reviewed object composition, omitted keys and snapshot contracts are explained locally.
  "oxc/no-rest-spread-properties": "error",
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
  // Oxfmt leaves import ordering to this rule; evaluation-order exceptions belong at the source.
  "sort-imports": "error",
  "typescript/consistent-type-definitions": "error",
  "typescript/explicit-function-return-type": "error",
  "typescript/explicit-module-boundary-types": "error",
  "typescript/no-unsafe-type-assertion": "error",
  "typescript/prefer-readonly-parameter-types": "error",
  "typescript/promise-function-async": "error",
  "typescript/strict-boolean-expressions": "error",
  "typescript/strict-void-return": "error",
  "unicorn/max-nested-calls": "error",
  "unicorn/no-null": "error",
} satisfies NonNullable<OxlintConfig["rules"]>;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
