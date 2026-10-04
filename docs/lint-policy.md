# Practical lint policy

This policy replaces enable-all adoption as the completion criterion for the [Oxlint audit #503](https://github.com/FranciscoMoretti/chat-js/issues/503). Of the 110 audited rules with findings, 11 are deliberately disabled below and 99 remain enforced, with the runtime/UI scopes and options described below. Enabling a rule while suppressing its findings does not establish that the underlying work is complete. Existing retained waivers remain unreviewed until they have a concrete contract justification or linked deferred work.

## Deliberately disabled rules

| Rule | Rationale and evidence |
| --- | --- |
| `import/no-named-export` | Existing registry/package APIs expose named symbols. Requiring defaults conflicts with retained `import/no-default-export`; see the [rule definition](https://oxc.rs/docs/guide/usage/linter/rules/import/no-named-export) and `packages/registry/src/gateways/vercel/gateway.ts`. |
| `import/prefer-default-export` | A single named export is still an intentional public API. The [rule](https://oxc.rs/docs/guide/usage/linter/rules/import/prefer-default-export) opposes the retained named-export preference. Required framework defaults keep narrow exceptions to `import/no-default-export`. |
| `oxc/no-async-await` | [Oxlint describes this as a legacy-environment restriction](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-async-await). `package.json` requires Node ≥24 and app code already uses async APIs. Retain Promise safety and `typescript/promise-function-async` checks. |
| `oxc/no-optional-chaining` | [Oxlint recommends against this restriction for modern codebases](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-optional-chaining). Node ≥24 and `apps/chat/tsconfig.json`'s ESNext target support this syntax. |
| `oxc/no-rest-spread-properties` | The [rule guards old-engine compatibility](https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-rest-spread-properties). Modern targets support immutable object composition and typed prop forwarding; see `apps/chat/components/ui/button.tsx` and `oxlint.config.ts`. |
| `no-ternary` | The [rule prohibits all conditional expressions](https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-ternary). Value selection such as button `asChild ? Slot : "button"` is deliberate. Retain `unicorn/no-nested-ternary`. |
| `node/no-top-level-await` | The [rule bans top-level await](https://oxc.rs/docs/guide/usage/linter/rules/node/no-top-level-await), while both lint configs enforce `unicorn/prefer-top-level-await`. Modern ESM tooling supports the retained convention. |
| `react/react-in-jsx-scope` | The [rule addresses React-in-scope JSX transforms](https://oxc.rs/docs/guide/usage/linter/rules/react/react-in-jsx-scope). `apps/chat/tsconfig.json` uses the automatic `react-jsx` runtime. |
| `sort-imports` | [Oxlint sorts declarations by binding syntax/name](https://oxc.rs/docs/guide/usage/linter/rules/eslint/sort-imports.html). `oxfmt.config.ts` imports the Ultracite formatter preset, which owns ordering; `button.tsx` uses its module-path/type import order. One formatter convention avoids rewrite cycles. |
| `react/forbid-component-props` | Tailwind styling and typed primitive APIs intentionally accept `className` and `style` on custom components. The [default restriction](https://oxc.rs/docs/guide/usage/linter/rules/react/forbid-component-props) forbids those supported props; `button.tsx`, `SidebarInset` and registry chart components demonstrate the contract. |
| `react/jsx-no-literals` | Chat and registry UI have no translation-layer contract. The [rule](https://oxc.rs/docs/guide/usage/linter/rules/react/jsx-no-literals) accepts expression-wrapped copy without providing localization; accessible text such as MessageAttachment's “Remove” remains ordinary UI content. |

These are policy decisions, not deferred violations. Broader relaxations require their own evidence and decision.

## Node runtime boundaries

`import/no-nodejs-modules` remains enforced outside the Node/Bun boundaries reviewed in [#529](https://github.com/FranciscoMoretti/chat-js/issues/529). The root config permits built-in imports only in `packages/cli/src/**`, `packages/cli/test/**`, `packages/cli/scripts/**`, root `scripts/**`, `apps/electron/src/main.ts`, `apps/electron/scripts/**`, and `apps/electron/forge.config.ts`. This scoped decision does not add a globally disabled rule.

The CLI package publishes the `chat-js` executable, builds it with `--target=node`, and verifies its published entrypoint with `node ./dist/index.js --help`. Its tests and utilities own filesystem, subprocess and package-resolution work. Root scripts run Bun/Node development, deployment and repository tooling. Electron's package entrypoint is `dist/main.js`, built for Node; Forge and packaging scripts also run in Node/Bun. These are supported runtime capabilities rather than import-by-import exceptions.

Electron preload remains protected: it is built with `--target=browser`, exposes a restricted `contextBridge`, and belongs to a BrowserWindow with `nodeIntegration: false`. Renderer files, CLI template/generated app payloads, shared packages and mixed app directories receive no relaxation. The standalone Chat config retains the error severity. New browser exports, template directories or desktop entrypoints require a separate boundary review.

At merged baseline `cf629c56`, this rule has 292 suppression entries: 290 canonical and two generated mirrors. The reviewed boundaries cover 170 canonical entries (CLI 130, Electron 15, root scripts 25); 122 outside entries (120 canonical and two mirrors) retain their existing review requirements. These counts describe rule entries, not unique imports. The isolated positive/negative import probes load the actual root config and pass from root, CLI and Electron working directories: all seven allowed patterns permit Node imports, while preload, renderer, CLI templates, Chat components and registry sources still report the rule. Effective-config checks from those working directories agree; the standalone Chat rule remains an error. The non-typed import probes disable type-aware execution only in their temporary harness. Required repository lint/type/test checks verify the implementation batch separately.

## UI scopes and performance options

`react/jsx-props-no-spreading` remains an error in feature components and canonical registry features. It is off only in `apps/chat/components/ui/**` and `apps/chat/components/ai-elements/**`, mirrored as `components/ui/**` and `components/ai-elements/**` in the standalone config. This reusable wrapper layer includes typed compositions of custom renderers, not only native elements: `SandboxCode` forwards `ComponentProps<typeof CodeBlock>`, while `Response` and `MessageResponse` forward `ComponentProps<typeof Streamdown>`. Those supported prop contracts intentionally pass through to custom components. Application orchestration belongs outside these wrapper directories and remains checked. Other wrappers expose native/Radix/React Hook Form prop contracts: `FormField` forwards typed `ControllerProps`, `FormControl` forwards Slot accessibility/event bindings, and `Actions` forwards native attributes. Enumerating a subset would narrow their supported APIs. The registry currently has no equivalent primitive wrapper directory; `src/ui/code-execution/**` and `src/tools/**` remain checked. See [Oxlint options](https://oxc.rs/docs/guide/usage/linter/rules/react/jsx-props-no-spreading).

The three `react-perf/jsx-no-new-{function,object,array}-as-prop` rules remain errors with `nativeAllowList: "all"`. Native DOM props do not establish custom component memoization boundaries. Custom component callbacks, arrays and objects remain checked; this batch adds no memoization and does not relax `jsx-no-jsx-as-prop`. Options are documented for [functions](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-function-as-prop), [objects](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-object-as-prop) and [arrays](https://oxc.rs/docs/guide/usage/linter/rules/react_perf/jsx-no-new-array-as-prop).

The UI batch removes 759 suppression rule entries from canonical source: 291 styling-prop entries, 182 literal-text entries, 271 primitive spread entries and 15 newly unused native performance entries. Generated mirrors account for 56 additional removals, for 815 total. These count one rule per disable directive, not diagnostics or bugs. The 15 native performance removals were checked against the previous default options; pre-existing SDK/Query compatibility directives remain untouched.

| Retained UI rule | Canonical entries before | Canonical entries after |
| --- | --: | --: |
| `react/jsx-props-no-spreading` | 302 | 31 |
| `react-perf/jsx-no-new-function-as-prop` | 127 | 118 |
| `react-perf/jsx-no-new-object-as-prop` | 66 | 60 |
| `react-perf/jsx-no-new-array-as-prop` | 16 | 16 |

Component source changes are comments only: all 254 changed code files have identical comment-free ASTs, including regenerated mirrors. The exception baseline requires a separately reviewed update during integration; these counts do not endorse the remaining waivers.

## Acceptance criteria

1. Resolve contradictory policies in shared root and standalone-app configuration.
2. Give every audited rule an explicit disposition: enforced, deliberately disabled with rationale, or an enforced rule with narrow, justified exceptions.
3. Fix mechanical findings and remove obsolete waiver names without changing runtime/API contracts.
4. Link genuinely nontrivial deferred work to concrete ownership, affected contracts and verification; do not describe general preservation comments as completed reviews.
5. Record a baseline of retained exceptions and reject silent additions or widened scopes. A passing lint run alone does not satisfy this criterion.
6. Synchronize registry/templates and generated applications, run repository lint, types and relevant tests, and verify the merged result before claiming completion.

## Exception review and baseline

Keep policy-off rules out of the exception baseline. For an enforced rule, a valid contract exception names the exact framework, external API or intentional test behavior and covers the smallest relevant line/declaration. A waiver that merely says “preserve existing behavior,” “keep inference,” or “avoid migration” remains unreviewed. Link deferred refactoring or bug work when that is the real reason.

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
| `node/no-top-level-await` | Off — policy | [#539](https://github.com/FranciscoMoretti/chat-js/issues/539) |
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
| `react/jsx-props-no-spreading` | Enforced in features; off in primitive wrapper scopes | [#550](https://github.com/FranciscoMoretti/chat-js/issues/550) |
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
