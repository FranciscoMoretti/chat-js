# W9 beta.1 release verification

Status, 26 October 2026: both matching beta packages are publicly verified, and clean Base/Radix consumers pass live runtime QA. Final CI screenshot review, production promotion, and PR landing remain pending.

The five approved release steps are review/land, prepare matching betas, publish and test public consumers, deploy the matched Create flow, and establish reviewed visual baselines. Automatic migration of existing apps and OpenRouter/S3/OAuth certification remain separate work.

## Publication and safeguards

| Package | Public beta | Stable latest (unchanged) | Audited archive SHA256 |
| --- | --- | --- | --- |
| `@chat-js/cli` | `0.9.0-beta.1` | `0.8.0` | `9f45a32cb3ff7e7ddcff2606326befbdc73fc2136f26f076a9ec527909088f8c` |
| `@chat-js/registry` | `0.2.0-beta.1` | `0.1.2` | `4124cf280db6a6c42411b8328d0ee7b4173f8ce8d40974a31498f7925c26784e` |

Public archive integrity and tags were verified at 21:54 UTC. Publication used the exact audited archives with explicit `--tag beta`; no major or stable release was authorized. The audit covered 1,276 files, including nested vendor archives, accidental secrets/environment files, public dependency resolution, native shadcn/TypeScript runtime loading, and matching registry contracts.

The release guard prevents Changesets or its fallback from publishing workspace prereleases under `latest`. Ordinary releases require prereleases to exist publicly first and stable tags to remain stable. Twelve guard tests exercise this boundary, including registry lookup failure; the guard passes against the published pair.

## Public consumer verification

Fresh public installs of Base/Lyra/Tabler and Radix/Rhea/Lucide pass:

- Exact native preset resolution and matching public registry namespaces/descriptors.
- Native component addition and two ChatJS syncs preserving consumer customization.
- Standalone type checking.
- Real AI Gateway chat and persisted document creation/reopening.
- Seven activity states, highlighted-code copying, desktop/mobile light/dark, and zero browser errors.

Runtime checks used isolated databases, cleaned afterward, and development login. OAuth was not exercised. Earlier W9 coverage also includes 76 routes per library, 65 focused Radix interactions, and five real attachment tests using AI Gateway, private Vercel Blob, and a persistent Vercel sandbox. Upload planning now requires a compatible persistent sandbox.

A separate default-create consumer, without forwarded shadcn flags or local registry overrides, resolves `shadcn/tailwind.css`, passes standalone types, and passes activity/clipboard/responsive runtime checks.

## Reviewed fixes and integration

PR [899](https://github.com/FranciscoMoretti/chat-js/pull/899) integrates main at `9e1038448095a20b182fb6882758f8059b3930d6`.

- Default scaffolding omitted the `shadcn` CSS dependency when native initialization was skipped. Commit `f37c6b139` adds the required core dependency and a failing-before/passing-after default-path regression.
- Native Badge centering clipped source-chip favicons and domain prefixes. Commit `876bc0772` fixes the app-owned composition; four geometry checks reproduce the old clipping and pass afterward. The five fleet captures preserve domains/favicons while truncating titles.
- Delayed Radix/RTL → Base/LTR iframe replacement exposed independent query subscriptions resolving different direction values. Commit `e852e4e83` makes ChatPreview consume the existing native provider state. It adds no preset codec or configuration schema. The regression fails before/passes after; 15 delayed transitions and the full Create interaction suite pass.
- Visual harnesses now wait for settled native submenu animation, research row opacity, and Sonner mounted state. Blank upload captures were removed while interaction assertions remain. Native generated RTL has separate Base/Radix capture identities.
- Playwright fixtures now exercise native input/textarea/button contracts and hydrate toggles before capturing. Reviewed platform screenshots replace legacy theme expectations; screenshot assertions remain enforced.
- Registry build determinism tests recursively enumerate files because native namespaces introduce subdirectories. Two builds and a complete generated gateway case pass after the fix.

Full repository lint and workspace types pass after the combined code/test fixes. Registry full checking previously passed 199 browser tests across 69 files; installation validation passed 28 tests and 2,076 assertions. Final CI results are recorded below when complete.

## Visual evidence

Create has its own CI workflow and project credential. It runs browser interactions and uploads SDK captures without automatically accepting changes. Existing Chat and registry visual workflows remain in place. Registry project auto-accept is enabled, so a green gate alone was not treated as manual review.

| Project | Cumulative PR vs main audit | Latest reviewed evidence before final refresh |
| --- | --- | --- |
| Chat app | 16 new, 247 changed, 0 removed, 11 unchanged (274 total) | `01a17a5d-027f-7b77-9052-40b160cc5be7`: three residual differences reviewed, zero render failures |
| Create | 11 new captures | `01a17a2f-3698-7c5c-a00a-be4c5c041991`: all 11 unchanged after acceptance |
| Registry/components | 27 new, 158 changed, 11 removed, 74 unchanged | `01a17a2e-c886-7095-aec2-ae015da822e8`: 254 current renders, zero failures |

The app workflow targets ChatJS App. The older ChatJS project separately reports 37 unchanged captures; that legacy project does not establish coverage of the current 274 app captures. The final three app residuals are one pixel of model-picker antialiasing and transient sidebar scrollbar visibility in two settings-loading captures, with content and dimensions unchanged. Cumulative app visual review remains in progress.

The registry cumulative API retains five accepted branch-only IDs no longer emitted (four blank upload captures and canonical RTL). It reports 259 present baseline IDs; the current archive contains 254. All 185 cumulative new/changed entries were reviewed. Eleven removals relative to main map to renamed or assertion-only native code/progress/reasoning tests, replaced custom clipboard APIs, and three unused PromptInput components. No product screen coverage was removed.

The safe initial 174 component changes were accepted from `01a17a1b-d627-7d35-8e2c-30210d6dbe9f`. Corrected citations were reviewed in `01a17a29-d284-7870-810d-51e40e3fce5e`; corrected MCP toast in `01a17a29-cd54-7f21-8b88-e0d89fc3beb6`. Generated Base/Radix RTL captures use builds `01a17a1f-53d5-7481-9bfc-45f782ec9ffe` and `01a17a20-0332-7c20-9cb3-109ac4f2caf1`.

Final residual review verified that five CI citation images exactly match the corrected captures and native sidebar menu closure on a failed sign-out is intended. Capture timing corrections restore all six research rows (`01a17a36-f0d7-7ae0-9430-543c01709d80`) and the Share error toast (`01a17a38-5b1c-7cdf-a286-5e7da3d0cf73`). Broken originals were not accepted as the intended outcome.

## Deployment and QA

Reviewed deployment: [Create preview](https://chat-js-site-m6spp13it-francisco-morettis-projects.vercel.app/create), deployment `dpl_5XWdwVWA9mPGoS67BF7csdgj56ff`, source `e852e4e83285ada2435ee51c7b5022101028d272`. Subsequent commits change tests only. Chrome verifies Base/LTR ↔ Radix/RTL switching, Chat/New chat/Tools navigation, mobile preview, theme switching, and beta command output. No application console errors were recorded; two errors originate from the Grammarly browser extension.

An earlier protected preview had one blank iframe after a rapid library/direction switch; Retry recovered it. Eight repeats, a cold repeat, and 15 delayed harness transitions did not reproduce that blank state. The separately reproduced direction race is fixed as described above. Do not conflate those observations. Public production retesting remains a release gate.

Production remains unchanged pending final checks. The previous deployment is `https://chat-js-site-kkt8tsc4x-francisco-morettis-projects.vercel.app` (`dpl_9uHXkvpGgfZ33JRSDpCQYmzf9Jg9`) for rollback.

## Remaining release gates and separate follow-ups

- Review remaining Linux Playwright snapshots from CI; complete all required checks without bypass.
- Promote the reviewed Create deployment and run the full suite against the public production URL.
- Land PR 899 and verify release/deployment outcomes and unchanged stable tags.

A CI-only sidebar hydration mismatch traces to session-seeding code inherited unchanged from main. It did not reproduce in nine focused local cases or four concurrent search tests. Keep it as a separate investigation rather than claiming it fixed by this UI migration.

Automatic migration of existing installations and credentialed OpenRouter/S3/OAuth certification are explicitly deferred. This release does not claim those checks passed.
