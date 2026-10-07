# Practical lint policy

The completion target is every rule in the pinned Ultracite core, React and Next presets enabled, with practical violations fixed and remaining exceptions justified beside the affected source. Minimal file-specific configuration exceptions are allowed only when Oxlint cannot honor source directives. Enabling a rule while suppressing its findings does not establish completion: each exception still needs review against the actual contract.

All 681 rules in the effective repository and standalone-app configurations are enabled. This is a configuration milestone; inherited source exceptions still need individual review. The inherited `jsdoc/require-param-type`, `jsdoc/require-returns-type`, and `no-restricted-properties` rules are enabled explicitly. JSDoc types follow actual declarations. `no-restricted-properties` has no project-specific restriction list, so enabling it does not claim an additional property-access restriction.

## Conditional value selections

`no-ternary` is enabled. Practical direct returns and callback guards were fixed before adoption. The remaining 943 canonical expression sites have local comments identifying their actual value-selection context and the pinned `unicorn/prefer-ternary` conflict with equivalent if/else assignment. These are convention exceptions, not claims that every expression is architecturally irreducible. `unicorn/no-nested-ternary` remains enabled.

Comments target the actual line, condition prefix or bounded JSX expression/tag trivia. Exact scope ledgers exclude unreviewed nested conditions, and compiler checks preserve emitted JavaScript, rendered child strings and JSDoc attachment. The native policy regression runs actual root and standalone configurations without forcing the rule on the command line; disabled-policy and overbroad nested-callback controls fail. These proofs do not sign off unrelated existing suppressions.

## Node runtime boundaries

`import/no-nodejs-modules` is enforced in every directory, including CLI code, repository scripts, and Electron main/packaging. The previous directory-wide overrides have been removed from both the repository and standalone-app configurations.

Reviewed Node/Bun imports have statement-level comments explaining the filesystem, process, package-resolution or desktop contract they serve. New native imports in those same files remain checked. Browser code, renderer/preload code and generated app payloads receive no directory-wide permission. Scaffolded Electron files carry the reviewed source comments into the generated application.

The runtime-policy test loads the actual repository and standalone configurations from multiple working directories. Unannotated imports report errors in every tested path, including formerly exempt CLI and Electron paths. Separate annotated probes verify that local comments suppress their intended imports. The probes disable type-aware execution only for their temporary fixture projects; repository lint and type checks verify the real sources separately.

## UI scopes and performance options

`react/jsx-props-no-spreading` is enforced in every directory. The former primitive and AI-element directory exemptions have been removed from both configurations. Each retained forwarding expression explains the typed native, Radix, React Hook Form, Streamdown or other component contract that requires it. A finite TypeScript prop interface does not alone justify dropping unknown runtime keys: structurally assignable callers can still supply event handlers or data attributes. Singleton object spreads that did not forward a prop contract were replaced with explicit attributes.

The three `react-perf/jsx-no-new-{function,object,array}-as-prop` rules remain errors with `nativeAllowList: "all"`. Native DOM props do not establish custom component memoization boundaries. Custom component callbacks, arrays and objects remain checked; this batch adds no memoization and does not relax `jsx-no-jsx-as-prop`. Options are documented for [functions](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-function-as-prop), [objects](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-object-as-prop) and [arrays](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-array-as-prop).

The earlier UI totals recorded removals achieved partly through directory exemptions; those totals are historical and do not describe the current source adoption. Current reviewed counts and validation are recorded in `docs/oxlint-cleanup-progress.md`.

`react/react-in-jsx-scope` is enabled. Components compiled with the automatic JSX runtime retain declaration-level comments where the rule expects a classic-runtime React binding. Each changed module was checked against its actual compiler/bundler settings, and its emitted automatic-runtime JavaScript remains identical. No unused React imports were added.

`react/forbid-component-props` is enabled. Reviewed `className` and `style` attributes explain their recipient's styling or layout contract. Most exceptions cover one attribute; bounded composition scopes preserve JSX text boundaries or existing directive attachment where an inline comment would change them. Compiler prop checks and source review verify the recipient contracts, and the annotation-only changes retain equivalent emitted JavaScript.

`react/jsx-no-literals` is enabled. All 854 findings were reviewed as authored interface/legal/marketing/demo/fixture text or intentional punctuation and glyphs. There is no translation-layer contract in these modules. The 754 canonical findings use 182 declaration/statement scopes; 100 installed findings inherit 27 generated scopes. Nested named render helpers receive their own scopes. Text is neither wrapped in expressions nor moved into constants merely to bypass this rule. Every affected canonical and installed TSX file emits byte-identical JavaScript, preserving JSX child and whitespace semantics.

## Export contracts

`import/no-named-export` and `import/prefer-default-export` are enabled. Declaration-local comments identify actual named bindings and their conflict with the retained `import/no-default-export` convention. Application guidance also requires named exports within `apps/chat`; it is not claimed as a rule for unrelated subtrees. Framework HTTP handlers/metadata and manifest-confirmed package entry bindings retain their named APIs. These convention reviews do not establish that every exported declaration has a caller; independently verified unused code is removed separately.

The CLI registration emitter adds comments to the actual named export statements it generates. Single-value, grouped-value, type-only, mixed, namespace and re-export forms use the native rule's actual export counting; defaults receive no named-export comments. Observability plans pass through this same emitter when written, avoiding duplicate comments in intermediate templates. Native generated-output checks reject both export violations and unused directives. Regeneration updates installed copies rather than patching them by hand.

## Import ordering

`sort-imports` is enabled. Named specifiers are sorted by their local binding without changing the imported symbol or module evaluation order. Erased type declarations move where the pinned formatter and existing directive scopes allow a real reduction in findings. Inline type merges conflict with the separately enforced `import/consistent-type-specifier-style`, so they are not used to trade one exception for another.

Remaining declaration exceptions cover one import and explain either runtime module order or the combined constraints of separate type declarations, formatter grouping and runtime order. They do not disable member ordering elsewhere. Tool generators sort same-module bindings by their already assigned aliases and retain only the required ordered module groups. Multi-export and alias-rollover fixtures verify the generated bindings and registrations.

## Module initialization

`node/no-top-level-await` is enabled. Reviewed Bun/ESM command entrypoints and test initialization statements explain why they await configuration, mocks, fixture data, build output or child completion before continuing. They do not expose a synchronous `require(esm)` contract. The ordered Playwright executable retains one bounded scenario exception, including its `finally` browser disposal; browser launch and output initialization have separate line exceptions. A redundant dynamic test import and unused mock scaffolding were removed instead of annotated.

## Native async contracts

`oxc/no-async-await` is enabled. The pinned rule rejects async functions and generators for legacy-engine compatibility, while the configured Node/Bun/browser targets support them. Statement/method exceptions preserve actual awaited sequencing, rejection behavior and async iteration. All 96 findings without their own await were reviewed separately: Promise-based fixture/hooks, the durable `"use step"` compiler contract and async-generator overloads require their existing async shape. Replacing those with `Promise.resolve` also conflicts with the retained `typescript/promise-function-async` rule. No unrelated Promise safety rules were relaxed.

The 2,728 findings map to 2,054 canonical scopes and 132 generated scopes. Emitted JavaScript tokens, parser diagnostics and JSDoc attachment remain unchanged. These new policy exceptions do not sign off unrelated pre-existing suppressions in the same functions.

## Object composition contracts

`oxc/no-rest-spread-properties` is enabled. Object compositions retain local exceptions for the opposing `eslint/prefer-object-spread` convention, ordered overrides, fresh snapshots and conditional key omission. Object bindings name the keys they exclude before forwarding the remaining properties. Twenty-five redundant sole-rest UI parameter copies were previously removed; three retain verified getter/hook/member-resolution ordering contracts. Exceptions target individual source lines or inline object/binding expressions; existing next-line rules are combined to preserve their targets. Generator templates own the two installed/custom registry composition comments. These syntax-contract reviews do not establish exhaustive dynamic caller analysis or finish unrelated existing suppression reviews.

## Optional access contracts

`oxc/no-optional-chaining` is enabled. Local comments identify the guarded receiver or callback and its short-circuit/fallback behavior. Application guidance preferring optional chaining is cited only in its actual `apps/chat` scope. Proven redundant guards are removed separately; inferred non-nullability alone does not prove runtime presence for database/array results, optional installations or SDK events. This adoption inventory is not a claim that every remaining chain is irreducible.

Most exceptions cover individual source lines. Existing next-line directives retain their targets, and JSX expressions or tag trivia accommodate comments without changing rendered children. Where narrower placement changes compiled children, a bounded rendering expression retains the exception. Compiler checks preserve executable structure; documented raw JSX indentation differences preserve every other TypeScript node and the emitted output. CLI static generator templates contain no optional chains; copied canonical modules carry their comments through regeneration.

## File-level directive limitations

Pinned Oxlint 1.82 reports `import/unambiguous` and `unicorn/filename-case` at offset zero, even when the file starts with a matching disable comment. A native three-file probe confirms this for an ambient declaration, CommonJS entry and underscore-named tool. Keep the existing exact-file configuration exceptions for Electron's ambient/Forge boundaries and EVE's filename-derived public tool names; do not widen them to directories. Source directives remain the default elsewhere.

## Acceptance criteria

1. Resolve contradictory policies in shared root and standalone-app configuration.
2. Enable every rule in the pinned presets. Give each remaining violation an individually reviewed source exception, allowing a minimal file-specific configuration exception only for a verified directive limitation.
3. Fix mechanical findings and remove obsolete waiver names without changing runtime/API contracts.
4. Link genuinely nontrivial deferred work to concrete ownership, affected contracts and verification; do not describe general preservation comments as completed reviews.
5. Track active suppression memberships by rule in [the Oxlint exception review](https://github.com/FranciscoMoretti/chat-js/issues/669). The issue inventory is a review queue, not acceptance of each existing reason or an automated check for new scopes.
6. Synchronize registry/templates and generated applications, run repository lint, types and relevant tests, and verify the integrated checkout before claiming completion.

## Exception review

During adoption, globally disabled rules remain unfinished work and are not source-exception entries. For an enforced rule, a valid contract exception names the exact framework, external API or intentional test behavior and covers the smallest relevant line/declaration. A waiver that merely says “preserve existing behavior,” “keep inference,” or “avoid migration” remains unreviewed. Link deferred refactoring or bug work when that is the real reason.

Count source suppressions, diagnostics and reviewed exceptions separately. Multiple rules can report one expression, and one block waiver can cover many findings; none is a bug count. The audit tables are historical evidence, not the current backlog. The inventory's enforced status describes configuration, not exception acceptance or absence of defects.

Keep suppression reasons beside their directives. Remove obsolete rule names and empty disable/enable comments. Regenerate registry outputs from canonical sources instead of independently editing generated copies.

There is no automated suppression-count baseline. Review additions and scope changes in source alongside [the per-rule issue queue](https://github.com/FranciscoMoretti/chat-js/issues/669); a passing `bun lint` checks the active lint configuration but does not certify the reasons or detect every newly added suppression.

## Ownership and deferred work

Review remaining waivers by coherent ownership groups rather than replaying a repository-wide mechanical rewrite:

| Group | Review boundary and useful verification |
| --- | --- |
| Server | Routes, auth, environment, persistence, streams and agent runtimes. Review promise timing, null/sentinel states and SDK type boundaries; use targeted unit/integration tests. |
| UI | Components, hooks and React state. Review contextual inference, prop forwarding and identity-sensitive performance with browser/visual evidence before refactors. |
| Registry | Canonical registry modules and portable public contracts. Check standalone type resolution, generated mirrors and fresh scaffold installations. |
| CLI | Commands, prompts, generators and subprocess lifecycle. Distinguish command output/startup I/O from application request-path restrictions; run CLI/scaffold tests. |
| Shared tooling | Published shared packages, configuration and scripts. Review public return contracts and formatter ownership; run package types/unit tests and template checks. |

Current ownership review: [Other apps, scripts and prototypes #618](https://github.com/FranciscoMoretti/chat-js/issues/618), [Chat core, routes, server and tests #619](https://github.com/FranciscoMoretti/chat-js/issues/619), [Chat UI #620](https://github.com/FranciscoMoretti/chat-js/issues/620), [CLI and generators #621](https://github.com/FranciscoMoretti/chat-js/issues/621), [Other shared packages #622](https://github.com/FranciscoMoretti/chat-js/issues/622), [Registry sources and tests #623](https://github.com/FranciscoMoretti/chat-js/issues/623). These track retained exceptions for review, not confirmed bugs.

Each deferred issue should name affected files/rules, the contract at risk, intended change, owner group and acceptance checks. Removing a waiver is complete only after its relevant behavior is verified. This plan does not itself certify retained waivers or close their original audit issues.

## Inventory of 110 audited rules

`Enforced` means the rule remains an error in the effective policy, subject to existing options and scoped exceptions. Original issues retain audit provenance even when their original enable-all resolution needs qualification.

| Rule | Status | Original issue |
| --- | --- | --- |
| `capitalized-comments` | Enforced | [#505](https://github.com/FranciscoMoretti/chat-js/issues/505) |
| `id-length` | Enforced | [#506](https://github.com/FranciscoMoretti/chat-js/issues/506) |
| `import/exports-last` | Enforced | [#522](https://github.com/FranciscoMoretti/chat-js/issues/522) |
| `import/group-exports` | Enforced | [#523](https://github.com/FranciscoMoretti/chat-js/issues/523) |
| `import/max-dependencies` | Enforced | [#524](https://github.com/FranciscoMoretti/chat-js/issues/524) |
| `import/no-commonjs` | Enforced | [#525](https://github.com/FranciscoMoretti/chat-js/issues/525) |
| `import/no-default-export` | Enforced | [#526](https://github.com/FranciscoMoretti/chat-js/issues/526) |
| `import/no-named-export` | Enforced | [#527](https://github.com/FranciscoMoretti/chat-js/issues/527) |
| `import/no-namespace` | Enforced | [#528](https://github.com/FranciscoMoretti/chat-js/issues/528) |
| `import/no-nodejs-modules` | Enforced outside reviewed Node/Bun boundaries | [#529](https://github.com/FranciscoMoretti/chat-js/issues/529) |
| `import/no-relative-parent-imports` | Enforced | [#530](https://github.com/FranciscoMoretti/chat-js/issues/530) |
| `import/no-unassigned-import` | Enforced | [#531](https://github.com/FranciscoMoretti/chat-js/issues/531) |
| `import/prefer-default-export` | Enforced | [#532](https://github.com/FranciscoMoretti/chat-js/issues/532) |
| `import/unambiguous` | Enforced | [#533](https://github.com/FranciscoMoretti/chat-js/issues/533) |
| `init-declarations` | Enforced | [#507](https://github.com/FranciscoMoretti/chat-js/issues/507) |
| `jsdoc/require-param` | Enforced | [#534](https://github.com/FranciscoMoretti/chat-js/issues/534) |
| `jsdoc/require-returns` | Enforced | [#535](https://github.com/FranciscoMoretti/chat-js/issues/535) |
| `jsx-a11y/no-autofocus` | Enforced | [#536](https://github.com/FranciscoMoretti/chat-js/issues/536) |
| `max-depth` | Enforced | [#508](https://github.com/FranciscoMoretti/chat-js/issues/508) |
| `max-lines` | Enforced | [#509](https://github.com/FranciscoMoretti/chat-js/issues/509) |
| `max-lines-per-function` | Enforced | [#510](https://github.com/FranciscoMoretti/chat-js/issues/510) |
| `max-params` | Enforced | [#511](https://github.com/FranciscoMoretti/chat-js/issues/511) |
| `max-statements` | Enforced | [#512](https://github.com/FranciscoMoretti/chat-js/issues/512) |
| `new-cap` | Enforced | [#513](https://github.com/FranciscoMoretti/chat-js/issues/513) |
| `no-console` | Enforced | [#514](https://github.com/FranciscoMoretti/chat-js/issues/514) |
| `no-continue` | Enforced | [#515](https://github.com/FranciscoMoretti/chat-js/issues/515) |
| `no-empty-function` | Enforced | [#575](https://github.com/FranciscoMoretti/chat-js/issues/575) |
| `no-implicit-coercion` | Enforced | [#516](https://github.com/FranciscoMoretti/chat-js/issues/516) |
| `no-magic-numbers` | Enforced | [#517](https://github.com/FranciscoMoretti/chat-js/issues/517) |
| `no-ternary` | Enforced — local value-selection convention | [#518](https://github.com/FranciscoMoretti/chat-js/issues/518) |
| `no-undefined` | Enforced | [#519](https://github.com/FranciscoMoretti/chat-js/issues/519) |
| `no-underscore-dangle` | Enforced | [#520](https://github.com/FranciscoMoretti/chat-js/issues/520) |
| `node/no-process-env` | Enforced | [#537](https://github.com/FranciscoMoretti/chat-js/issues/537) |
| `node/no-sync` | Enforced | [#538](https://github.com/FranciscoMoretti/chat-js/issues/538) |
| `node/no-top-level-await` | Enforced; reviewed ESM command/test exceptions | [#539](https://github.com/FranciscoMoretti/chat-js/issues/539) |
| `oxc/no-map-spread` | Enforced | [#541](https://github.com/FranciscoMoretti/chat-js/issues/541) |
| `oxc/no-optional-chaining` | Enforced — local access contracts | [#542](https://github.com/FranciscoMoretti/chat-js/issues/542) |
| `oxc/no-rest-spread-properties` | Enforced — local composition contracts | [#543](https://github.com/FranciscoMoretti/chat-js/issues/543) |
| `promise/always-return` | Enforced | [#544](https://github.com/FranciscoMoretti/chat-js/issues/544) |
| `promise/prefer-await-to-then` | Enforced | [#576](https://github.com/FranciscoMoretti/chat-js/issues/576) |
| `react-perf/jsx-no-jsx-as-prop` | Enforced | [#555](https://github.com/FranciscoMoretti/chat-js/issues/555) |
| `react-perf/jsx-no-new-array-as-prop` | Enforced for custom components; native props allowed | [#556](https://github.com/FranciscoMoretti/chat-js/issues/556) |
| `react-perf/jsx-no-new-function-as-prop` | Enforced for custom components; native props allowed | [#557](https://github.com/FranciscoMoretti/chat-js/issues/557) |
| `react-perf/jsx-no-new-object-as-prop` | Enforced for custom components; native props allowed | [#558](https://github.com/FranciscoMoretti/chat-js/issues/558) |
| `react/forbid-component-props` | Enforced | [#545](https://github.com/FranciscoMoretti/chat-js/issues/545) |
| `react/jsx-boolean-value` | Enforced | [#546](https://github.com/FranciscoMoretti/chat-js/issues/546) |
| `react/jsx-filename-extension` | Enforced | [#547](https://github.com/FranciscoMoretti/chat-js/issues/547) |
| `react/jsx-max-depth` | Enforced | [#548](https://github.com/FranciscoMoretti/chat-js/issues/548) |
| `react/jsx-props-no-spreading` | Enforced; reviewed forwarding expressions | [#550](https://github.com/FranciscoMoretti/chat-js/issues/550) |
| `react/no-array-index-key` | Enforced | [#551](https://github.com/FranciscoMoretti/chat-js/issues/551) |
| `react/no-multi-comp` | Enforced | [#552](https://github.com/FranciscoMoretti/chat-js/issues/552) |
| `react/only-export-components` | Enforced | [#553](https://github.com/FranciscoMoretti/chat-js/issues/553) |
| `react/react-in-jsx-scope` | Enforced; automatic-runtime component exceptions | [#554](https://github.com/FranciscoMoretti/chat-js/issues/554) |
| `sort-imports` | Enforced | [#521](https://github.com/FranciscoMoretti/chat-js/issues/521) |
| `typescript/await-thenable` | Enforced | [#579](https://github.com/FranciscoMoretti/chat-js/issues/579) |
| `typescript/consistent-return` | Enforced | [#580](https://github.com/FranciscoMoretti/chat-js/issues/580) |
| `typescript/consistent-type-definitions` | Enforced | [#559](https://github.com/FranciscoMoretti/chat-js/issues/559) |
| `typescript/explicit-function-return-type` | Enforced | [#560](https://github.com/FranciscoMoretti/chat-js/issues/560) |
| `typescript/explicit-member-accessibility` | Enforced | [#561](https://github.com/FranciscoMoretti/chat-js/issues/561) |
| `typescript/explicit-module-boundary-types` | Enforced | [#562](https://github.com/FranciscoMoretti/chat-js/issues/562) |
| `typescript/no-base-to-string` | Enforced | [#581](https://github.com/FranciscoMoretti/chat-js/issues/581) |
| `typescript/no-confusing-void-expression` | Enforced | [#582](https://github.com/FranciscoMoretti/chat-js/issues/582) |
| `typescript/no-deprecated` | Enforced | [#583](https://github.com/FranciscoMoretti/chat-js/issues/583) |
| `typescript/no-floating-promises` | Enforced | [#584](https://github.com/FranciscoMoretti/chat-js/issues/584) |
| `typescript/no-misused-promises` | Enforced | [#585](https://github.com/FranciscoMoretti/chat-js/issues/585) |
| `typescript/no-misused-spread` | Enforced | [#586](https://github.com/FranciscoMoretti/chat-js/issues/586) |
| `typescript/no-redundant-type-constituents` | Enforced | [#587](https://github.com/FranciscoMoretti/chat-js/issues/587) |
| `typescript/no-require-imports` | Enforced | [#563](https://github.com/FranciscoMoretti/chat-js/issues/563) |
| `typescript/no-unnecessary-boolean-literal-compare` | Enforced | [#588](https://github.com/FranciscoMoretti/chat-js/issues/588) |
| `typescript/no-unnecessary-template-expression` | Enforced | [#589](https://github.com/FranciscoMoretti/chat-js/issues/589) |
| `typescript/no-unnecessary-type-arguments` | Enforced | [#590](https://github.com/FranciscoMoretti/chat-js/issues/590) |
| `typescript/no-unnecessary-type-assertion` | Enforced | [#591](https://github.com/FranciscoMoretti/chat-js/issues/591) |
| `typescript/no-unnecessary-type-conversion` | Enforced | [#592](https://github.com/FranciscoMoretti/chat-js/issues/592) |
| `typescript/no-unnecessary-type-parameters` | Enforced | [#593](https://github.com/FranciscoMoretti/chat-js/issues/593) |
| `typescript/no-unsafe-argument` | Enforced | [#594](https://github.com/FranciscoMoretti/chat-js/issues/594) |
| `typescript/no-unsafe-assignment` | Enforced | [#595](https://github.com/FranciscoMoretti/chat-js/issues/595) |
| `typescript/no-unsafe-call` | Enforced | [#596](https://github.com/FranciscoMoretti/chat-js/issues/596) |
| `typescript/no-unsafe-member-access` | Enforced | [#597](https://github.com/FranciscoMoretti/chat-js/issues/597) |
| `typescript/no-unsafe-return` | Enforced | [#598](https://github.com/FranciscoMoretti/chat-js/issues/598) |
| `typescript/no-unsafe-type-assertion` | Enforced | [#599](https://github.com/FranciscoMoretti/chat-js/issues/599) |
| `typescript/no-var-requires` | Enforced | [#564](https://github.com/FranciscoMoretti/chat-js/issues/564) |
| `typescript/non-nullable-type-assertion-style` | Enforced | [#600](https://github.com/FranciscoMoretti/chat-js/issues/600) |
| `typescript/only-throw-error` | Enforced | [#601](https://github.com/FranciscoMoretti/chat-js/issues/601) |
| `typescript/prefer-nullish-coalescing` | Enforced | [#602](https://github.com/FranciscoMoretti/chat-js/issues/602) |
| `typescript/prefer-promise-reject-errors` | Enforced | [#603](https://github.com/FranciscoMoretti/chat-js/issues/603) |
| `typescript/prefer-readonly` | Enforced | [#604](https://github.com/FranciscoMoretti/chat-js/issues/604) |
| `typescript/prefer-readonly-parameter-types` | Enforced | [#565](https://github.com/FranciscoMoretti/chat-js/issues/565) |
| `typescript/prefer-regexp-exec` | Enforced | [#605](https://github.com/FranciscoMoretti/chat-js/issues/605) |
| `typescript/promise-function-async` | Enforced | [#606](https://github.com/FranciscoMoretti/chat-js/issues/606) |
| `typescript/require-array-sort-compare` | Enforced | [#607](https://github.com/FranciscoMoretti/chat-js/issues/607) |
| `typescript/require-await` | Enforced | [#566](https://github.com/FranciscoMoretti/chat-js/issues/566) |
| `typescript/restrict-template-expressions` | Enforced | [#608](https://github.com/FranciscoMoretti/chat-js/issues/608) |
| `typescript/return-await` | Enforced | [#609](https://github.com/FranciscoMoretti/chat-js/issues/609) |
| `typescript/strict-boolean-expressions` | Enforced | [#610](https://github.com/FranciscoMoretti/chat-js/issues/610) |
| `typescript/strict-void-return` | Enforced | [#611](https://github.com/FranciscoMoretti/chat-js/issues/611) |
| `typescript/switch-exhaustiveness-check` | Enforced | [#612](https://github.com/FranciscoMoretti/chat-js/issues/612) |
| `typescript/unbound-method` | Enforced | [#613](https://github.com/FranciscoMoretti/chat-js/issues/613) |
| `typescript/use-unknown-in-catch-callback-variable` | Enforced | [#614](https://github.com/FranciscoMoretti/chat-js/issues/614) |
| `unicorn/explicit-length-check` | Enforced | [#567](https://github.com/FranciscoMoretti/chat-js/issues/567) |
| `unicorn/filename-case` | Enforced | [#577](https://github.com/FranciscoMoretti/chat-js/issues/577) |
| `unicorn/max-nested-calls` | Enforced | [#568](https://github.com/FranciscoMoretti/chat-js/issues/568) |
| `unicorn/no-array-callback-reference` | Enforced | [#569](https://github.com/FranciscoMoretti/chat-js/issues/569) |
| `unicorn/no-null` | Enforced | [#570](https://github.com/FranciscoMoretti/chat-js/issues/570) |
| `unicorn/no-process-exit` | Enforced | [#571](https://github.com/FranciscoMoretti/chat-js/issues/571) |
| `unicorn/no-useless-undefined` | Enforced | [#578](https://github.com/FranciscoMoretti/chat-js/issues/578) |
| `unicorn/prefer-global-this` | Enforced | [#572](https://github.com/FranciscoMoretti/chat-js/issues/572) |
| `unicorn/prefer-string-raw` | Enforced | [#573](https://github.com/FranciscoMoretti/chat-js/issues/573) |
| `unicorn/prefer-top-level-await` | Enforced | [#574](https://github.com/FranciscoMoretti/chat-js/issues/574) |
