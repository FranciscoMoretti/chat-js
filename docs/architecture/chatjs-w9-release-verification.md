# W9 release verification

Status, 27 October 2026: matching beta.2 packages are published and publicly verified, fresh Base/Radix consumers pass live QA, all required CI and reviewed visual gates pass, Create is live and verified in production, and PR 899 is merged. The post-merge release workflow and site/docs deployments pass. The chat-app production rollout remains blocked by its pre-existing coordinated database migration guard.

The five approved release steps are review/land, prepare matching betas, publish and test public consumers, deploy the matched Create flow, and establish reviewed visual baselines. Automatic migration of existing apps and OpenRouter/S3/OAuth certification remain separate work.

## Publication and safeguards

Matching CLI `0.9.0-beta.2` and registry `0.2.0-beta.2` are published under `beta`, including the verified model-row correction. Public archive SHA256/SHA512 and unchanged stable tags were verified at 07:17 UTC on 27 October. Publication used the exact audited archives and the user-provided npm configuration; credential contents were not displayed. The earlier beta.1 pair remains historical evidence and does not contain the model-row fix.

| Package | Public beta | Stable latest (unchanged) | Audited archive SHA256 |
| --- | --- | --- | --- |
| `@chat-js/cli` | `0.9.0-beta.2` | `0.8.0` | `5172bab6e574f72c7f27e5db4b4d5b8a374250893fba485189f5ae30968c5ae6` |
| `@chat-js/registry` | `0.2.0-beta.2` | `0.1.2` | `0fe374e499aaa17ce044af85e303e4a4c630acdb7572b7de6b9ba3f8daf51048` |

The beta.2 audit covers 1,275 files and an empty-cache exact-tarball consumer. Registry changes are limited to the model-preferences descriptor in root/Base/Radix namespaces and release metadata. CLI changes carry that fix, the matching registry pin, and exclusion of maintainer-only visual CSS; seven focused tests and standalone CLI types pass. Both namespace sources contain the verified row fix.

The earlier beta.1 public archive integrity and tags were verified at 21:54 UTC on 26 October. Publication used the exact audited archives with explicit `--tag beta`; no major or stable release was authorized. The audit covered 1,276 files, including nested vendor archives, accidental secrets/environment files, public dependency resolution, native shadcn/TypeScript runtime loading, and matching registry contracts.

The release guard prevents Changesets or its fallback from publishing workspace prereleases under `latest`. Ordinary releases require prereleases to exist publicly first and stable tags to remain stable. Twelve guard tests exercise this boundary, including registry lookup failure; the guard passes against the published pair.

## Public consumer verification

Fresh-cache public beta.2 installs of Base/Lyra/Tabler and Radix/Rhea/Lucide pass:

- Exact native preset resolution and matching public registry namespaces/descriptors.
- Native component addition and two ChatJS syncs preserving consumer customization.
- Standalone type checking.
- Real AI Gateway chat and persisted document creation/reopening.
- Seven activity states, highlighted-code copying, desktop light/mobile dark, and zero browser errors.

All 12 runtime screenshots were visually inspected without regression. Isolated databases, listening ports, and development processes were independently confirmed cleaned afterward. The first Radix install encountered an upstream shadcn connection timeout; a fresh-cache retry passed without source changes. Runtime checks used development login. OAuth was not exercised. Earlier W9 coverage also includes 76 routes per library, 65 focused Radix interactions, and five real attachment tests using AI Gateway, private Vercel Blob, and a persistent Vercel sandbox. Upload planning now requires a compatible persistent sandbox.

A separate default-create consumer, without forwarded shadcn flags or local registry overrides, resolves `shadcn/tailwind.css`, passes standalone types, and passes activity/clipboard/responsive runtime checks.

## Reviewed fixes and integration

PR [899](https://github.com/FranciscoMoretti/chat-js/pull/899) integrated main at `9e1038448095a20b182fb6882758f8059b3930d6` and merged as `b1fde55cbb9fef6bac9ac94df3e436316f7da2b9` after all checks passed, without bypass.

- Default scaffolding omitted the `shadcn` CSS dependency when native initialization was skipped. Commit `f37c6b139` adds the required core dependency and a failing-before/passing-after default-path regression.
- Native Badge centering clipped source-chip favicons and domain prefixes. Commit `876bc0772` fixes the app-owned composition; four geometry checks reproduce the old clipping and pass afterward. The five fleet captures preserve domains/favicons while truncating titles.
- Delayed Radix/RTL → Base/LTR iframe replacement exposed independent query subscriptions resolving different direction values. Commit `e852e4e83` makes ChatPreview consume the existing native provider state. It adds no preset codec or configuration schema. The regression fails before/passes after; 15 delayed transitions and the full Create interaction suite pass.
- Visual harnesses now wait for settled native submenu animation, research row opacity, and Sonner mounted state. Blank upload captures were removed while interaction assertions remain. Native generated RTL has separate Base/Radix capture identities.
- Playwright fixtures now exercise native input/textarea/button contracts and hydrate toggles before capturing. Reviewed platform screenshots replace legacy theme expectations; screenshot assertions remain enforced.
- Native table cells prevented long model names from wrapping, which clipped the full model-list switches on mobile. Commit `6519ac785` overrides wrapping only in the registry-owned model-row composition. The new geometry assertion fails before and passes after; three model-settings tests and 12 fleet renders pass. Mobile dark/light switches are fully visible; nine captures are unchanged, three reviewed differences are intended. Build `01a17a67-8135-7532-993d-c7eac6f91ba0` records the fix.
- Registry build determinism tests recursively enumerate files because native namespaces introduce subdirectories. Two builds and a complete generated gateway case pass after the fix.

Full repository lint and workspace types pass after the combined code/test fixes. Registry full checking previously passed 199 browser tests across 69 files; installation validation passed 28 tests and 2,076 assertions. Final CI on `0c4b8ea30fa566b4b2b8d33d57da9053f2125c26` passes: 29 checks passed, three neutral/skipped, no pending or failed checks. This includes 23 main browser cases, two conversation presentation cases, 22 installed gateway tests (658 assertions), 28 registry combinations, and all eight package-manager/Electron configurations. Required is green and PR review is clean.

## Visual evidence

Create has its own CI workflow and project credential. It runs browser interactions and uploads SDK captures without automatically accepting changes. Existing Chat and registry visual workflows remain in place. Registry project auto-accept is enabled, so a green gate alone was not treated as manual review.

| Project | Cumulative PR vs main audit | Final reviewed CI evidence |
| --- | --- | --- |
| Chat app | 16 new, 247 changed, 0 removed, 11 unchanged (274 total) | `01a17c2c-6747-743b-923c-bd9804e290af`: 274 renders, two reviewed scrollbar differences, zero render failures |
| Create | 11 new captures | `01a17c31-4415-7b6b-8660-aae11499d083`: passed |
| Registry/components | 27 new, 158 changed, 11 removed, 74 unchanged | `01a17c2c-7825-741b-95c4-1f8886901ffa`: 254 renders, two reviewed cosmetic differences, zero failures |

The app workflow targets ChatJS App. The older ChatJS project separately reports 37 unchanged captures; that legacy project does not establish coverage of the current 274 app captures. The final two app residuals are transient sidebar scrollbar visibility in settings-loading light/dark captures, with content and dimensions unchanged. The two registry residuals are a research-header shimmer frame and one pixel of progress-panel reflow, with all text, rows, and icons preserved. All 263 added/changed app captures have been compared with exact main build `01a17785-71de-7e85-9ee8-a5ba952121bc`. Two mobile model-list images exposed the same clipping regression, fixed above. Transcript scroll offsets and a transient sidebar skeleton were independently investigated: native end scrolling reaches mobile follow-ups and the shared Save control without overlap, and the sidebar resolves its history. Initial-mobile mount and desktop-to-mobile measurements confirm native scroll state settles from top 0 / end delta 136 to top 136 / end delta 0 without interaction. Commit `060ef70e0` waits for that natural end state and resolved sidebar Suspense before capture; intentional loading fixtures opt out. Commit `8e63eee79` keeps readiness and layout checks coupled across sidebar remounts; fleet `01a17a75-2fd8-7c04-8ae7-cae397df9391` verifies Search, Q4, and history restored in the desktop capture. All 76 app browser tests and full lint/types pass with this harness correction.

UI Verify still replays some mobile transcripts at the top despite correct serialized `rr_scrollTop` values (130/136). Runtime measurements verify the natural end position and reachable controls. This is a renderer limitation; the captures alone do not prove the final mobile scroll position. No product workaround was added. MCP and sign-out error toasts now wait for settled visibility before capture (`9863db406`); both corrected fleet images were inspected and accepted.

The registry cumulative API retains five accepted branch-only IDs no longer emitted (four blank upload captures and canonical RTL). It reports 259 present baseline IDs; the current archive contains 254. All 185 cumulative new/changed entries were reviewed. Eleven removals relative to main map to renamed or assertion-only native code/progress/reasoning tests, replaced custom clipboard APIs, and three unused PromptInput components. No product screen coverage was removed.

The safe initial 174 component changes were accepted from `01a17a1b-d627-7d35-8e2c-30210d6dbe9f`. Corrected citations were reviewed in `01a17a29-d284-7870-810d-51e40e3fce5e`; corrected MCP toast in `01a17a29-cd54-7f21-8b88-e0d89fc3beb6`. Generated Base/Radix RTL captures use builds `01a17a1f-53d5-7481-9bfc-45f782ec9ffe` and `01a17a20-0332-7c20-9cb3-109ac4f2caf1`.

Final residual review verified that five CI citation images exactly match the corrected captures and native sidebar menu closure on a failed sign-out is intended. Capture timing corrections restore all six research rows (`01a17a36-f0d7-7ae0-9430-543c01709d80`) and the Share error toast (`01a17a38-5b1c-7cdf-a286-5e7da3d0cf73`). Broken originals were not accepted as the intended outcome.

## Deployment and QA

Reviewed deployment: [Create preview](https://chat-js-site-m6spp13it-francisco-morettis-projects.vercel.app/create), deployment `dpl_5XWdwVWA9mPGoS67BF7csdgj56ff`, source `e852e4e83285ada2435ee51c7b5022101028d272`. Subsequent product changes affect the generated-app model-settings row and CLI packaging; the deployed Create source is unchanged. Chrome verifies Base/LTR ↔ Radix/RTL switching, Chat/New chat/Tools navigation, mobile preview, theme switching, and beta command output. No application console errors were recorded; two errors originate from the Grammarly browser extension.

An earlier protected preview had one blank iframe after a rapid library/direction switch; Retry recovered it. Eight repeats, a cold repeat, and 15 delayed harness transitions did not reproduce that blank state. The separately reproduced direction race is fixed as described above. Do not conflate those observations. The full public production suites subsequently passed, including rapid and in-flight transitions.

Production [Create](https://www.chatjs.dev/create) is live from deployment `dpl_DsHLBCUJDpFHhVK4hu268STNibfb` (`chat-js-site-r1g9yaouu-francisco-morettis-projects.vercel.app`), created by promoting the reviewed preview with production settings at 07:29 UTC on 27 October. Both Base/Radix interaction, lifecycle, and in-flight suites pass, together with all 13 activity tests. Chrome verified the Tools scene, Base/LTR ↔ Radix/RTL transitions, beta installation command, and restored Chat scene, with zero console errors.

The previous deployment is `https://chat-js-site-kkt8tsc4x-francisco-morettis-projects.vercel.app` (`dpl_9uHXkvpGgfZ33JRSDpCQYmzf9Jg9`) for rollback.

## Post-merge verification and separate follow-ups

The feature PR is merged. Main Release workflow [40467874790](https://github.com/FranciscoMoretti/chat-js/actions/runs/40467874790) passed, updating the existing Changesets PR without publishing CLI/registry. Stable tags remain CLI `0.8.0` and registry `0.1.2`. Post-merge site deployment `dpl_3WvY1EgKtB8B6yvEbGzu5QbYoBuz` (`chat-js-site-e700ejone-francisco-morettis-projects.vercel.app`) and docs deployment succeeded. The public alias points to the main site deployment; its lifecycle suite passes.

One Chrome reload after the production deployment changed left the iframe at `about:blank` until the visible preview timeout. Retry recovered it. The automated lifecycle suite and 13 subsequent Chrome reloads passed, with no application console error identifying the cause. This is a recorded intermittent observation, not a verified fix; it must not be conflated with the separately reproduced and fixed direction race.

The chat-app production deployment `dpl_7aYFguRHVLwNftsd4FkDqPo45UWU` stopped before database changes because migration `0021` requires coordinated rollout. The guard is unchanged from pre-PR main and removes four columns still used by older app/worker revisions. Follow the [migration runbook](../../apps/chat/lib/db/migrations/README.md#migration-0021-guest-balance-removal): prepare matching revisions, back up, stop traffic/drain old processes, explicitly migrate, deploy app and worker, then restore traffic. No migration, guard bypass, or production configuration change was performed. This operational rollout is separate from publishing the beta packages and deploying Create.

Local Chrome model-settings QA also records a `Date.now()` prerender warning in `HydrateClient`; the relevant server/page code and Next version are unchanged from main. The models page renders and controls remain usable. This warning is a separate framework/data-hydration investigation.

A CI-only sidebar hydration mismatch traces to session-seeding code inherited unchanged from main. It did not reproduce in nine focused local cases or four concurrent search tests. Keep it as a separate investigation rather than claiming it fixed by this UI migration.

Automatic migration of existing installations and credentialed OpenRouter/S3/OAuth certification are explicitly deferred. This release does not claim those checks passed.
