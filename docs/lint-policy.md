# Practical lint policy

The completion target is every rule in the pinned Ultracite core, React and Next presets enabled, with practical violations fixed and remaining exceptions justified beside the affected source. Minimal file-specific configuration exceptions are allowed only when Oxlint cannot honor source directives. Enabling a rule while suppressing its findings does not establish completion: each exception still needs review against the actual contract.

The ten rules below remain temporarily disabled during adoption. Their rationale explains the conflicts to resolve through narrow source exceptions; it does not authorize permanent global exclusions. The inherited `jsdoc/require-param-type`, `jsdoc/require-returns-type`, and `no-restricted-properties` rules are now enabled explicitly. JSDoc types follow actual declarations. `no-restricted-properties` has no project-specific restriction list, so enabling it does not claim an additional property-access restriction.

## Rules awaiting source-scoped adoption

| Rule | Rationale and evidence |
| --- | --- |
| `import/no-named-export` | Existing registry/package APIs expose named symbols. Requiring defaults conflicts with retained `import/no-default-export`; see the [rule definition](https://oxc.rs/docs/guide/usage/linter/rules/import/no-named-export) and `packages/registry/src/gateways/vercel/gateway.ts`. |
| `import/prefer-default-export` | A single named export is still an intentional public API. The [rule](https://oxc.rs/docs/guide/usage/linter/rules/import/prefer-default-export) opposes the retained named-export preference. Required framework defaults keep narrow exceptions to `import/no-default-export`. |
| `oxc/no-async-await` | [Oxlint describes this as a legacy-environment restriction](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-async-await). `package.json` requires Node ≥24 and app code already uses async APIs. Retain Promise safety and `typescript/promise-function-async` checks. |
| `oxc/no-optional-chaining` | [Oxlint recommends against this restriction for modern codebases](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-optional-chaining). Node ≥24 and `apps/chat/tsconfig.json`'s ESNext target support this syntax. |
| `oxc/no-rest-spread-properties` | The [rule guards old-engine compatibility](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-rest-spread-properties). Modern targets support immutable object composition and typed prop forwarding; see `apps/chat/components/ui/button.tsx` and `oxlint.config.ts`. |
| `no-ternary` | The [rule prohibits all conditional expressions](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-ternary). Value selection such as button `asChild ? Slot : "button"` is deliberate. Retain `unicorn/no-nested-ternary`. |
| `react/react-in-jsx-scope` | The [rule addresses React-in-scope JSX transforms](https://oxc.rs/docs/guide/usage/linter/rules/react/react-in-jsx-scope). `apps/chat/tsconfig.json` uses the automatic `react-jsx` runtime. |
| `sort-imports` | [Oxlint sorts declarations by binding syntax/name](https://oxc.rs/docs/guide/usage/linter/rules/eslint/sort-imports.html). `oxfmt.config.ts` imports the Ultracite formatter preset, which owns ordering; `button.tsx` uses its module-path/type import order. One formatter convention avoids rewrite cycles. |
| `react/forbid-component-props` | Tailwind styling and typed primitive APIs intentionally accept `className` and `style` on custom components. The [default restriction](https://oxc.rs/docs/guide/usage/linter/rules/react/forbid-component-props) forbids those supported props; `button.tsx`, `SidebarInset` and registry chart components demonstrate the contract. |
| `react/jsx-no-literals` | Chat and registry UI have no translation-layer contract. The [rule](https://oxc.rs/docs/guide/usage/linter/rules/react/jsx-no-literals) accepts expression-wrapped copy without providing localization; accessible text such as MessageAttachment's “Remove” remains ordinary UI content. |

These conflicts remain part of the unfinished adoption work. Do not replace them with indiscriminate source waivers or distort code merely to satisfy opposing rules.

## Node runtime boundaries

`import/no-nodejs-modules` is enforced in every directory, including CLI code, repository scripts, and Electron main/packaging. The previous directory-wide overrides have been removed from both the repository and standalone-app configurations.

Reviewed Node/Bun imports have statement-level comments explaining the filesystem, process, package-resolution or desktop contract they serve. New native imports in those same files remain checked. Browser code, renderer/preload code and generated app payloads receive no directory-wide permission. Scaffolded Electron files carry the reviewed source comments into the generated application.

The runtime-policy test loads the actual repository and standalone configurations from multiple working directories. Unannotated imports report errors in every tested path, including formerly exempt CLI and Electron paths. Separate annotated probes verify that local comments suppress their intended imports. The probes disable type-aware execution only for their temporary fixture projects; repository lint and type checks verify the real sources separately.

## UI scopes and performance options

`react/jsx-props-no-spreading` is enforced in every directory. The former primitive and AI-element directory exemptions have been removed from both configurations. Each retained forwarding expression explains the typed native, Radix, React Hook Form, Streamdown or other component contract that requires it. A finite TypeScript prop interface does not alone justify dropping unknown runtime keys: structurally assignable callers can still supply event handlers or data attributes. Singleton object spreads that did not forward a prop contract were replaced with explicit attributes.

The three `react-perf/jsx-no-new-{function,object,array}-as-prop` rules remain errors with `nativeAllowList: "all"`. Native DOM props do not establish custom component memoization boundaries. Custom component callbacks, arrays and objects remain checked; this batch adds no memoization and does not relax `jsx-no-jsx-as-prop`. Options are documented for [functions](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-function-as-prop), [objects](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-object-as-prop) and [arrays](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-array-as-prop).

The earlier UI totals recorded removals achieved partly through directory exemptions; those totals are historical and do not describe the current source adoption. Current reviewed counts and validation are recorded in `docs/oxlint-cleanup-progress.md`.

## Module initialization

`node/no-top-level-await` is enabled. Reviewed Bun/ESM command entrypoints and test initialization statements explain why they await configuration, mocks, fixture data, build output or child completion before continuing. They do not expose a synchronous `require(esm)` contract. The ordered Playwright executable retains one bounded scenario exception, including its `finally` browser disposal; browser launch and output initialization have separate line exceptions. A redundant dynamic test import and unused mock scaffolding were removed instead of annotated.

## Acceptance criteria

1. Resolve contradictory policies in shared root and standalone-app configuration.
2. Enable every rule in the pinned presets. Give each remaining violation an individually reviewed source exception, allowing a minimal file-specific configuration exception only for a verified directive limitation.
3. Fix mechanical findings and remove obsolete waiver names without changing runtime/API contracts.
4. Link genuinely nontrivial deferred work to concrete ownership, affected contracts and verification; do not describe general preservation comments as completed reviews.
5. Record a baseline of retained exceptions and reject silent additions or widened scopes. A passing lint run alone does not satisfy this criterion.
6. Synchronize registry/templates and generated applications, run repository lint, types and relevant tests, and verify the integrated checkout before claiming completion.

## Exception review and baseline

During adoption, globally disabled rules remain unfinished work and are not source-exception entries. For an enforced rule, a valid contract exception names the exact framework, external API or intentional test behavior and covers the smallest relevant line/declaration. A waiver that merely says “preserve existing behavior,” “keep inference,” or “avoid migration” remains unreviewed. Link deferred refactoring or bug work when that is the real reason.

Count original diagnostics, current unsuppressed diagnostics, suppression directives and reviewed exceptions separately. Multiple rules can report one expression, and one block waiver can cover many findings; none is a bug count. The audit tables are historical evidence, not the current backlog. The inventory's enforced status describes configuration, not exception acceptance or absence of defects.

The baseline must identify each retained rule, file, scope and reason. CI must fail on new/widened exceptions unless a reviewed update supplies a contract justification or a deferred issue. Obsolete rule names and empty disable/enable comments should be removed before capturing it. Regenerate registry outputs from canonical sources instead of independently editing generated copies.

## Exception guard usage

`bun lint:exceptions` checks the baseline and runs as part of `bun lint`. Run `bun test scripts/lint-exceptions.test.ts` when changing the guard.

The guard budgets entries by file, rule and directive kind. Every exception also hashes its covered line or block and reason, so relocating a waiver, expanding a block or editing covered code requires baseline review. File-level metrics hash the whole file, including when their directive appears at EOF; function metrics hash the affected declaration. Duplicate source regions use an occurrence ordinal to detect relocation; inserting identical source before a waiver can therefore require a baseline refresh even when its target did not change. Keep reasons attached to actual ESLint/Oxlint directives; prose mentioning a directive is not an exception.

After reviewing a deliberate exception change, use `bun scripts/lint-exceptions.ts --write-baseline` to record it. Adding a new file/rule/directive-kind key or increasing its count additionally requires `--allow-new`. A same-count replacement and an edit to an existing exception both change fingerprints; `--write-baseline` explicitly records either after review. The guard cannot distinguish those intentions, so inspect the source and baseline diff, including replacements, before committing. Do not regenerate the baseline to hide growth or an unexplained scope change. The baseline inventories debt; it does not endorse every retained waiver. Legacy directives without reasons must reach zero before the initial baseline is accepted. The new guard's own scoped exceptions also require explicit review.

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

`Enforced` means the rule remains an error in the effective policy, subject to existing options and scoped exceptions. `Off — policy` links to the rationale above. Original issues retain audit provenance even when their original enable-all resolution needs qualification.

| Rule | Status | Original issue |
| --- | --- | --- |
| `capitalized-comments` | Enforced | [#505](https://github.com/FranciscoMoretti/chat-js/issues/505) |
| `id-length` | Enforced | [#506](https://github.com/FranciscoMoretti/chat-js/issues/506) |
| `import/exports-last` | Enforced | [#522](https://github.com/FranciscoMoretti/chat-js/issues/522) |
| `import/group-exports` | Enforced | [#523](https://github.com/FranciscoMoretti/chat-js/issues/523) |
| `import/max-dependencies` | Enforced | [#524](https://github.com/FranciscoMoretti/chat-js/issues/524) |
| `import/no-commonjs` | Enforced | [#525](https://github.com/FranciscoMoretti/chat-js/issues/525) |
| `import/no-default-export` | Enforced | [#526](https://github.com/FranciscoMoretti/chat-js/issues/526) |
| `import/no-named-export` | Off — policy | [#527](https://github.com/FranciscoMoretti/chat-js/issues/527) |
| `import/no-namespace` | Enforced | [#528](https://github.com/FranciscoMoretti/chat-js/issues/528) |
| `import/no-nodejs-modules` | Enforced outside reviewed Node/Bun boundaries | [#529](https://github.com/FranciscoMoretti/chat-js/issues/529) |
| `import/no-relative-parent-imports` | Enforced | [#530](https://github.com/FranciscoMoretti/chat-js/issues/530) |
| `import/no-unassigned-import` | Enforced | [#531](https://github.com/FranciscoMoretti/chat-js/issues/531) |
| `import/prefer-default-export` | Off — policy | [#532](https://github.com/FranciscoMoretti/chat-js/issues/532) |
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
| `no-ternary` | Off — policy | [#518](https://github.com/FranciscoMoretti/chat-js/issues/518) |
| `no-undefined` | Enforced | [#519](https://github.com/FranciscoMoretti/chat-js/issues/519) |
| `no-underscore-dangle` | Enforced | [#520](https://github.com/FranciscoMoretti/chat-js/issues/520) |
| `node/no-process-env` | Enforced | [#537](https://github.com/FranciscoMoretti/chat-js/issues/537) |
| `node/no-sync` | Enforced | [#538](https://github.com/FranciscoMoretti/chat-js/issues/538) |
| `node/no-top-level-await` | Enforced; reviewed ESM command/test exceptions | [#539](https://github.com/FranciscoMoretti/chat-js/issues/539) |
| `oxc/no-async-await` | Off — policy | [#540](https://github.com/FranciscoMoretti/chat-js/issues/540) |
| `oxc/no-map-spread` | Enforced | [#541](https://github.com/FranciscoMoretti/chat-js/issues/541) |
| `oxc/no-optional-chaining` | Off — policy | [#542](https://github.com/FranciscoMoretti/chat-js/issues/542) |
| `oxc/no-rest-spread-properties` | Off — policy | [#543](https://github.com/FranciscoMoretti/chat-js/issues/543) |
| `promise/always-return` | Enforced | [#544](https://github.com/FranciscoMoretti/chat-js/issues/544) |
| `promise/prefer-await-to-then` | Enforced | [#576](https://github.com/FranciscoMoretti/chat-js/issues/576) |
| `react-perf/jsx-no-jsx-as-prop` | Enforced | [#555](https://github.com/FranciscoMoretti/chat-js/issues/555) |
| `react-perf/jsx-no-new-array-as-prop` | Enforced for custom components; native props allowed | [#556](https://github.com/FranciscoMoretti/chat-js/issues/556) |
| `react-perf/jsx-no-new-function-as-prop` | Enforced for custom components; native props allowed | [#557](https://github.com/FranciscoMoretti/chat-js/issues/557) |
| `react-perf/jsx-no-new-object-as-prop` | Enforced for custom components; native props allowed | [#558](https://github.com/FranciscoMoretti/chat-js/issues/558) |
| `react/forbid-component-props` | Off — policy | [#545](https://github.com/FranciscoMoretti/chat-js/issues/545) |
| `react/jsx-boolean-value` | Enforced | [#546](https://github.com/FranciscoMoretti/chat-js/issues/546) |
| `react/jsx-filename-extension` | Enforced | [#547](https://github.com/FranciscoMoretti/chat-js/issues/547) |
| `react/jsx-max-depth` | Enforced | [#548](https://github.com/FranciscoMoretti/chat-js/issues/548) |
| `react/jsx-no-literals` | Off — policy | [#549](https://github.com/FranciscoMoretti/chat-js/issues/549) |
| `react/jsx-props-no-spreading` | Enforced; reviewed forwarding expressions | [#550](https://github.com/FranciscoMoretti/chat-js/issues/550) |
| `react/no-array-index-key` | Enforced | [#551](https://github.com/FranciscoMoretti/chat-js/issues/551) |
| `react/no-multi-comp` | Enforced | [#552](https://github.com/FranciscoMoretti/chat-js/issues/552) |
| `react/only-export-components` | Enforced | [#553](https://github.com/FranciscoMoretti/chat-js/issues/553) |
| `react/react-in-jsx-scope` | Off — policy | [#554](https://github.com/FranciscoMoretti/chat-js/issues/554) |
| `sort-imports` | Off — policy | [#521](https://github.com/FranciscoMoretti/chat-js/issues/521) |
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
