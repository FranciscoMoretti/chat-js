import type { OxlintConfig } from "oxlint";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (auditedRestrictionRules); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
// Audited policy is shared by the repository and generated apps.
// Reviewed rule conflicts and contract exceptions belong beside the source.
export const auditedRestrictionRules = {
  "capitalized-comments": [
    "error",
    "always",
    { ignoreConsecutiveComments: true },
  ],
  "id-length": "error",
  "import/exports-last": "error",
  "import/extensions": "error",
  "import/group-exports": "error",
  "import/max-dependencies": "error",
  "import/no-anonymous-default-export": "error",
  "import/no-commonjs": "error",
  "import/no-default-export": "error",
  "import/no-dynamic-require": "error",
  // Existing named module contracts explain the conflicting export convention locally.
  "import/no-named-export": "error",
  "import/no-namespace": "error",
  "import/no-nodejs-modules": "error",
  "import/no-relative-parent-imports": "error",
  // Keep required CSS side effects and Next's server-only environment-poisoning marker allowed (#531).
  "import/no-unassigned-import": [
    "error",
    { allow: ["**/*.css", "server-only"] },
  ],
  // Single named bindings retain their reviewed module/API contracts beside the source.
  "import/prefer-default-export": "error",
  "import/unambiguous": "error",
  "init-declarations": "error",
  "jsdoc/require-param": "error",
  "jsdoc/require-param-type": "error",
  "jsdoc/require-returns": "error",
  "jsdoc/require-returns-type": "error",
  "jsx-a11y/no-autofocus": "error",
  "max-depth": "error",
  "max-lines": ["error", { skipComments: true }],
  "max-lines-per-function": ["error", { skipComments: true }],
  "max-params": "error",
  "max-statements": "error",
  // Next route handlers use uppercase names without being constructors (#513).
  "new-cap": ["error", { capIsNew: false }],
  "no-console": "error",
  "no-continue": "error",
  "no-implicit-coercion": "error",
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
  "oxc/no-map-spread": "error",
  // Reviewed nullish access, callback and fallback contracts are explained beside each chain.
  "oxc/no-optional-chaining": "error",
  // Reviewed object composition, omitted keys and snapshot contracts are explained locally.
  "oxc/no-rest-spread-properties": "error",
  "promise/always-return": "error",
  "promise/catch-or-return": "error",
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
  "react/jsx-max-depth": "error",
  // Authored product, legal and fixture copy is reviewed beside its rendering declaration.
  "react/jsx-no-literals": "error",
  "react/jsx-props-no-spreading": "error",
  "react/no-array-index-key": "error",
  "react/no-multi-comp": "error",
  "react/no-unknown-property": "error",
  "react/only-export-components": "error",
  // Components using the automatic JSX runtime explain that compiler contract locally.
  "react/react-in-jsx-scope": "error",
  // Oxfmt leaves import ordering to this rule; evaluation-order exceptions belong at the source.
  "sort-imports": "error",
  "typescript/consistent-type-definitions": "error",
  "typescript/explicit-function-return-type": "error",
  "typescript/explicit-member-accessibility": "error",
  "typescript/explicit-module-boundary-types": "error",
  // Concise callbacks and explicit void discards are deliberate; other void values remain checked.
  "typescript/no-confusing-void-expression": [
    "error",
    { ignoreArrowShorthand: true, ignoreVoidOperator: true },
  ],
  "typescript/no-require-imports": "error",
  "typescript/no-unsafe-type-assertion": "error",
  "typescript/no-var-requires": "error",
  "typescript/prefer-readonly-parameter-types": "error",
  "typescript/promise-function-async": "error",
  "typescript/require-await": "error",
  "typescript/strict-boolean-expressions": "error",
  "typescript/strict-void-return": "error",
  // Default branches intentionally handle unknown/future union members.
  "typescript/switch-exhaustiveness-check": [
    "error",
    { considerDefaultExhaustiveForUnions: true },
  ],
  "unicorn/explicit-length-check": "error",
  "unicorn/max-nested-calls": "error",
  "unicorn/no-array-callback-reference": "error",
  "unicorn/no-nested-ternary": "error",
  "unicorn/no-null": "error",
  "unicorn/no-process-exit": "error",
  // Typed APIs (React refs, Promise resolvers and mocks) can require explicit undefined.
  "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
  "unicorn/number-literal-case": "error",
  "unicorn/prefer-global-this": "error",
  "unicorn/prefer-string-raw": "error",
  "unicorn/prefer-top-level-await": "error",
} satisfies NonNullable<OxlintConfig["rules"]>;
/* oxlint-enable import/prefer-default-export, import/no-named-export */
