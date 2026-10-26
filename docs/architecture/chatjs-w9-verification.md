# W9: Base UI and Radix verification

Status: local implementation and integration QA complete, 26 October 2026. This report does not change the historical W8 or public-beta evidence.

## Supported behavior

- Fresh creation accepts native `--base base` or `--base radix` beside the upstream preset. The CLI uses shadcn `4.22.1`; ChatJS does not introduce a preset decoder or theme schema.
- The maintained reference app remains Base UI/Rhea. Radix generation installs native Radix primitives and adapts application compositions to their APIs, rather than shipping Base components with Radix styling or a runtime compatibility layer.
- Registry builds keep the existing root Base namespace and emit complete `/base/{name}.json` and `/radix/{name}.json` namespaces. Fresh Radix apps select `/radix/`. Item IDs and target paths remain stable.
- UI-specific v2 descriptors declare matching `uiBase: "base"` or `uiBase: "radix"`. Installation and sync check this against the app's native style before mutation. Subsequent installs retain the configured namespace.
- Existing apps are not automatically migrated between libraries. Updating `components.json` or a namespace alone does not migrate callers and primitives.
- Uploads still require durable storage and a compatible persistent sandbox. Library choice does not alter that dependency or EVE attachment ownership.

The current public CLI `0.9.0-beta.0` and registry `0.2.0-beta.0` remain the earlier Base-only releases. W9 has not been published or deployed, and no package version or stable tag has changed. Radix commands from the local Create implementation require the matching local CLI/registry until a new beta is approved and published.

## Create implementation

`apps/site/scripts/generate-create-preview.ts radix` resolves native `radix-<style>` registry sources through shadcn. Generated components live in `apps/site/components/create-preview/ui/radix-<style>/`, selected through `native-radix.ts`; `provenance-radix.json` records source hashes and CLI version. The existing Base generated files were preserved. Adaptations are import destinations and upstream menu transformation.

The preview uses native `render` composition for Base and `asChild` for Radix. Its shared tool-activity composition accepts only the injected collapsible props it consumes, so neither library's event signature becomes a requirement of the other. Library selection is separate from the opaque native preset and survives URL sharing, reload, installation choices, and command generation. React Aria remains unavailable.

Broader Radix lifecycle QA caught a Base-only `closeOnClick` prop reaching Radix menu DOM. The preview now passes that prop only to Base; Radix uses its native close behavior. Browser assertions include console errors as well as thrown page errors. An existing uploads persistence test also now waits for the URL update before reloading, rather than racing the query-state flush.

## Completed checks

| Surface | Evidence | Result |
| --- | --- | --- |
| Create model and upstream URL helpers | `bun test apps/site/components/create-model.test.ts apps/site/vendor/shadcn-create/lib/*.test.ts` | 18 passed |
| Both native libraries | `bun run test:visual:create:activity` | 13 passed; all eight styles and five icon libraries, tool keyboard expansion/retry, copy, model/scene menus, library switching, preset/command/uploads/reload preservation |
| Existing Base Create behavior | `bun run test:visual:create` | Passed; controls, theme export, history, hover, recovery, new-chat reset, repeated/cold scene transitions, uploads, mobile preview, inflight preset synchronization |
| Radix preview behavior | `CREATE_UI_BASE=radix` with `create-preview-actions.visual.ts`, `create-lifecycle.visual.ts`, and `create-inflight.visual.ts` | Passed; composer/reset/attachment controls, history, rapid transitions, cold loads, theme changes, scene menus and inflight preset synchronization |
| Site static checks | `bun run test:types` in `apps/site`; scoped `oxlint` and `oxfmt --check` | Passed |
| Radix/Rhea generated app with uploads | Retained fixture `/tmp/chatjs-native-create-FOOPMA` | Generation, native resolution, standalone types, additional installation and sync preservation passed; live attachment runtime tracked separately below |

Local logs: `/tmp/w9-create-after.log`, `/tmp/w9-create-full-qa.log`, `/tmp/w9-create-unit.log`, `/tmp/w9-site-types-final.log`, and `/tmp/w9-radix-{preview-actions,lifecycle,inflight}.log`. Temporary paths are evidence from this run, not durable repository inputs.

## Visual comparison

The pre-W9 capture used the existing SDK suite before implementation changes. Base capture IDs remained unchanged. Both archives contain public Create fixtures rather than credentials or user conversations.

| Capture | UI Verify build | Result |
| --- | --- | --- |
| Before W9 | [01a179b0-a93c-799b-9f7f-21f8b5ec7c8d](https://uiverify.ai/builds/01a179b0-a93c-799b-9f7f-21f8b5ec7c8d) | 7 renders, zero rendering failures |
| W9 | [01a179b2-0c90-78ce-8fd2-705aa56dbee6](https://uiverify.ai/builds/01a179b2-0c90-78ce-8fd2-705aa56dbee6) | 11 renders, zero rendering failures |

UI Verify reports these stories as new because this project has no resolved CI baseline for these IDs. Accordingly, the comparison used the actual before/after fleet-rendered candidate images; it is not a claim that the CI baseline gate passed. No baseline was accepted or advanced.

Pixel comparison and visual inspection found:

- Four Base tool scenes—desktop/mobile in light/dark—and the history toolbar are pixel-identical before and after W9.
- Four native Radix tool scenes are pixel-identical to their corresponding Base scenes, on both local captures and the UI Verify fleet.
- Desktop/mobile installation dialogs differ intentionally: Radix becomes enabled, its “Coming later” label disappears, and the description names both supported libraries. The remaining form layout and controls are unchanged.

Fleet images and metadata are retained under `/tmp/w9-create-before-fleet-images/` and `/tmp/w9-create-after-fleet-images/`. Reviewed installation pairs are `comparison-005.png` and `comparison-006.png` in the latter directory. The pre-change SDK archive is `/tmp/w9-create-before-archive`.

## Reference-app visual comparison

UI Verify rendered 16 pre-W9 Base captures in [build 01a179b8-af88-77a5-9c39-192f75a660fe](https://uiverify.ai/builds/01a179b8-af88-77a5-9c39-192f75a660fe) and the corresponding native Radix captures in [build 01a179bb-6d06-780e-b2ed-89c55632ed7e](https://uiverify.ai/builds/01a179bb-6d06-780e-b2ed-89c55632ed7e). Both completed with zero rendering failures. Coverage includes signed-in home/history, the open composer menu, tool approval, and reasoning/tool error/falsy results, each desktop/mobile and light/dark.

Comparison of the actual fleet candidate pixels found 11 exact matches. The other five contain only antialiasing differences: one mobile model label differs by one channel level at 359 pixels; the four open-menu captures differ at 10–24 icon/text-edge pixels. Side-by-side inspection found no geometry, content, or interaction regression. Images and the pixel report are retained in `/tmp/chatjs-w9-{before,after}-fleet-images/`.

Eight reference captures have existing CI baselines and eight are new IDs. The pre-W9 captures already differ from those older CI baselines, so the W9 comparison uses the explicitly captured previous state instead of attributing earlier W0–W8 changes to W9. No CI or preview baseline was accepted.

## Integrated QA

| Check | Result |
| --- | --- |
| Radix/Rhea uploads generation | `/tmp/chatjs-native-create-FOOPMA`: exact native preset, compatible registry metadata, standalone types, native add and ChatJS add/sync preservation passed |
| Radix/Lyra documents generation | `/tmp/chatjs-native-create-acaP05`: exact native preset, standalone types, native add and ChatJS sync preservation passed |
| Reference-app routes | 76/76 passed with Radix, and 76/76 passed with Base after integration |
| Focused Radix interactions | 65/65 passed across composer, menus, model selection/save races, sharing, MCP, sign-out, reasoning, streaming/history and attachments |
| Full registry check | Types, 197 unit tests and 197 browser tests across 68 files passed |
| CLI unit suite | 331 passed, zero failures |
| Native forwarding edge cases | Fresh `--base radix` without a preset and preset URL with `base=radix` without a separate base flag both produce native Radix/Rhea and the correct namespace; pointer-only creation exits cleanly and retains Base/Rhea |
| Repository checks | `bun lint` and `bun test:types` passed |
| Live Radix chat and documents | Real AI Gateway response, document persistence/reopening, seven activity states, highlighted-code clipboard, mobile dark mode, and exact Create/generated theme parity passed; zero browser errors |
| Live Radix uploads | All five real attachment tests passed using AI Gateway, private Vercel Blob and persistent Vercel Sandbox; image delivery, retry/edit retention, remove/reupload, reload, recovery, ownership and orphan access covered |
| User Chrome | Chat → Tools → New chat → Chat and Get Code verified on Radix. Only console warning was Grammarly injecting body attributes before hydration; isolated browser suites were error-free |

QA fixed native Search dialog focus restoration on mobile, normalized checkbox state, omitted the Base-specific nested search backdrop in emitted Radix source, and removed repository-only visual fixtures from generated apps. Conversation fixtures now supply the TooltipProvider already present in the real app, and the credit-event fixture waits for its subscription before emitting an event.

The fresh-scaffold native CLI handoff now uses the valid default preset `rhea` and lets native initialization resolve the library from a preset URL unless an explicit native flag overrides it. Interactive terminals retain native stdin; noninteractive fresh-library replacement answers the upstream confirmation that otherwise ignores `--yes`.

Runtime evidence: `/tmp/chatjs-native-create-acaP05/runtime/report.json`, `/tmp/chatjs-native-create-FOOPMA/runtime/report.json`, and `/tmp/chatjs-w9-upload-live.log`. The tests removed their isolated databases, two sandbox resources and five uploaded fixture files. Temporary pulled credentials were deleted. No production build was used merely for type checking.

Provider certification beyond the available AI Gateway/Blob/Sandbox combination remains a separate track. A future release must use a matching approved CLI/registry prerelease, verify a clean public consumer, and only then update the deployed Create flow; major bumps and stable promotion are not authorized.
