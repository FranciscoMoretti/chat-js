import type { OxlintConfig } from "oxlint";

// These explicit project policies resolve audit findings without changing runtime
// or public contracts merely to satisfy a blanket style restriction.
export const documentedRuleExceptions = {
  // #506: Allow conventional indices, coordinates, and generic type parameters; length alone does not determine a useful name.
  "id-length": "off",
  // #522: Keep exports next to their declarations; moving them to the bottom obscures the public API alongside its implementation.
  "import/exports-last": "off",
  // #523: Use direct declaration exports rather than a separate export inventory that must be maintained in parallel.
  "import/group-exports": "off",
  // #524: Dependency limits require module-boundary design; moving imports behind aggregators would only hide dependencies.
  "import/max-dependencies": "off",
  // #526: Next.js pages, layouts, and tool configuration entrypoints require or conventionally consume default exports.
  "import/no-default-export": "off",
  // #527: Shared packages expose named APIs; forbidding them would require incompatible export and consumer changes.
  "import/no-named-export": "off",
  // #528: React and Radix primitives intentionally group related APIs under namespaces; imports reflect the consumed library interface.
  "import/no-namespace": "off",
  // #529: Server code, CLI tools, Electron, and tests need Node built-ins; browser boundaries must be enforced by runtime scope.
  "import/no-nodejs-modules": "off",
  // #530: Direct imports within packages preserve file boundaries without introducing aliases or aggregation modules.
  "import/no-relative-parent-imports": "off",
  // #532: Use stable named APIs even when a module currently exports one value; adding exports should not force consumer rewrites.
  "import/prefer-default-export": "off",
  // #507: Allow values assigned by control-flow branches; eager undefined initializers obscure definite-assignment intent.
  "init-declarations": "off",
  // #534: Document parameter semantics when useful; TypeScript already describes shape, and placeholder tags add no contract information.
  "jsdoc/require-param": "off",
  // #535: Document meaningful return guarantees rather than requiring redundant tags on every documented function.
  "jsdoc/require-returns": "off",
  // #509: Keep cohesive modules together; splitting files requires ownership and public API decisions, not a line threshold.
  "max-lines": "off",
  // #510: Keep cohesive workflows and test scenarios together; extraction requires domain boundaries rather than a line threshold.
  "max-lines-per-function": "off",
  // #511: Preserve existing callback and public API signatures; switching to options objects changes caller contracts.
  "max-params": "off",
  // #512: Keep ordered workflows and test scenarios explicit; statement counts do not identify safe extraction boundaries.
  "max-statements": "off",
  // #514: CLI output, development tooling, and test diagnostics use console directly; logging policy depends on the runtime.
  "no-console": "off",
  // #515: Loop guard clauses use continue to avoid nesting and keep the successful path readable.
  "no-continue": "off",
  // #517: Protocol values, UI dimensions, and test fixtures need domain-specific naming decisions rather than arbitrary constant extraction.
  "no-magic-numbers": "off",
  // #518: Allow conditional expressions for derived values and JSX; a blanket syntax ban obscures simple alternatives.
  "no-ternary": "off",
  // #519: Typed APIs and missing-value sentinels use explicit undefined; null is not an equivalent replacement.
  "no-undefined": "off",
  // #520: Preserve SDK fields and internal backing-field conventions; renaming them needs contract and ownership review.
  "no-underscore-dangle": "off",
  // #537: Environment loaders, CLI entrypoints, Electron, and test setup read process.env; a global ban cannot express those boundaries.
  "node/no-process-env": "off",
  // #538: Startup configuration, CLI discovery, and synchronous SDK interfaces need synchronous calls; conversion changes lifecycle or API contracts.
  "node/no-sync": "off",
  // #539: Bun scripts and ESM entrypoints await initialization before running dependent code.
  "node/no-top-level-await": "off",
  // #540: Async workflows use await for sequencing and error handling; rewriting them to promise chains would obscure control flow.
  "oxc/no-async-await": "off",
  // #542: Optional chaining intentionally handles absent nested values without duplicating guards or property reads.
  "oxc/no-optional-chaining": "off",
  // #543: Typed object composition and immutable updates rely on rest/spread; mutation is not an equivalent replacement.
  "oxc/no-rest-spread-properties": "off",
  // #555: Elements are part of component composition APIs; memoization depends on actual render cost and ownership.
  "react-perf/jsx-no-jsx-as-prop": "off",
  // #556: Array identity optimization requires profiling and dependency review; unconditional hoisting can share mutable state.
  "react-perf/jsx-no-new-array-as-prop": "off",
  // #557: Event handlers close over current render state; memoization requires correct dependencies and evidence of a consumer identity requirement.
  "react-perf/jsx-no-new-function-as-prop": "off",
  // #558: Prop objects may depend on current render state; hoisting or memoization needs lifecycle and dependency review.
  "react-perf/jsx-no-new-object-as-prop": "off",
  // #545: UI primitives expose className and style as deliberate styling and composition interfaces.
  "react/forbid-component-props": "off",
  // #548: Component extraction must preserve state, accessibility, and layout ownership; JSX nesting alone does not define a component boundary.
  "react/jsx-max-depth": "off",
  // #549: UI copy is written directly in components; introducing message keys requires a localization and copy-management design.
  "react/jsx-no-literals": "off",
  // #550: Typed UI wrappers forward native and library props; enumerating every prop would narrow their composition contracts.
  "react/jsx-props-no-spreading": "off",
  // #552: Compound UI primitives and their private subcomponents are intentionally colocated with shared behavior.
  "react/no-multi-comp": "off",
  // #553: Component modules also expose related typed helpers and configuration; splitting them requires public API and refresh-boundary decisions.
  "react/only-export-components": "off",
  // #554: The automatic JSX runtime does not require a React binding; unused imports would conflict with the compiler model.
  "react/react-in-jsx-scope": "off",
  // #521: Oxfmt owns case-insensitive import sorting and grouping; a second sorter would impose conflicting ordering.
  "sort-imports": "off",
  // #559: Interfaces and object aliases have different declaration-merging and implicit-index assignability; preserve intentional public type contracts.
  "typescript/consistent-type-definitions": "off",
  // #560: Infer implementation return types where useful; imposing annotations requires choosing and maintaining semantic contracts.
  "typescript/explicit-function-return-type": "off",
  // #562: Inferred generic and SDK-derived exports preserve precise types; explicit boundary annotations require public API design.
  "typescript/explicit-module-boundary-types": "off",
  // #565: Deep-readonly parameters change SDK, React, and mutable API assignability; adopting them requires an ownership and public contract migration.
  "typescript/prefer-readonly-parameter-types": "off",
  // #606: Promise-returning APIs preserve synchronous validation and promise identity; adding async changes throw timing and returned promises.
  "typescript/promise-function-async": "off",
  // #610: Existing predicates intentionally combine absent, empty, zero, and false values; choosing separate domain cases requires behavior decisions.
  "typescript/strict-boolean-expressions": "off",
  // #611: TypeScript void callbacks intentionally discard results (push, delete, setters); forcing wrappers does not change the caller contract.
  "typescript/strict-void-return": "off",
  // #568: Expression decomposition needs meaningful intermediate concepts; nesting counts alone do not establish readable boundaries.
  "unicorn/max-nested-calls": "off",
  // #570: Database, wire-protocol, and React APIs distinguish null from absent values; replacing it with undefined changes contracts.
  "unicorn/no-null": "off",
} satisfies NonNullable<OxlintConfig["rules"]>;
