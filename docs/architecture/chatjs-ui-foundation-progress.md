# UI foundation and Create implementation status

Implemented on `codex/shadcn-ui-plan`, based on main `9c7d39254`. Updated 26 October 2026. W2, W3, W4, W5, W6, and W7 now have an integrated Base UI path. Full dual-library support remains W9. The foundation slice was verified locally; the subsequent [Create QA pass](chatjs-create-qa.md) records additional regression fixes and remaining operational uncertainty. Per the user’s sequencing decision, npm publication is deferred until the end of the work.

## UI foundation

- `components.json` uses native `base-rhea`, neutral, Lucide, and the pinned registry beta. Installed primitives are generated from shadcn, and their core/registry consumers use Base UI APIs. Unused Accordion and the old Form wrapper were removed; MCP forms use native Field composition.
- The migration covers menus, dialogs, sheets, popovers, selects, tooltips, checkboxes, switches, drawers, tabs, sliders, and layout primitives. Radix primitive imports are gone; the controlled-state utility and transitive dependencies are not a second supported application base.
- Explicit accessible names replace accidental tooltip-derived labels. Editable composers retain full opacity when only Send is disabled under Nova; truly disabled/read-only composers retain native disabled styling. Route checks cover model filtering/keyboard selection, MCP transport selection, mobile sidebar/search focus, upload menu activation, and dialog lifecycle behavior.
- Native theme/font tokens and `app/editor.css` preserve shadcn ownership of global styling. App-specific helpers moved to `lib/id.ts` and `lib/file-language.ts`; native init can replace `lib/utils.ts` safely.
- Native baseline preset resolution returns `b27Gcu6y` without fallbacks.

## Conversation and composer migration

W3 uses upstream Message, Bubble, MessageScroller and Attachment source. EVE message IDs remain the identity for stream updates, branches, prepended history and edits. Native scrolling follows streamed content, releases when the reader scrolls away, and preserves history position. Shared transcripts and image attachments use the same native presentation. The old message, message-layout and conversation wrappers were removed, along with unused branch/response/attachment APIs and the unused `use-stick-to-bottom` dependency.

W4 removes the 730-line prompt-input facade. A small browser-safe PromptForm composes native InputGroup slots for both the runtime Lexical editor and Create's native textarea. Lexical retains draft, paste, IME and keyboard behavior; EVE retains execution/cancellation state. Read-only and busy forms cannot submit through keyboard or form paths. Unused speech APIs had no production/registry consumer and were removed rather than retained for tests.

Create's generator now retrieves native Message, Bubble, MessageScroller and Attachment for all eight shadcn styles, recording source hashes. Native scroll-button icons follow the selected icon library. The preview shares PromptForm and uses its selected style's native primitives; it does not import server/EVE modules or introduce a second theme contract.

## Native CLI and registry compatibility

`create` forwards the original native argument vector after `--`, without a ChatJS theme schema. ChatJS owns scaffold topology and initialization lifecycle; native shadcn owns preset parsing, validation, font transforms, and component reinstallation. Unsupported primitive bases are rejected. Native init runs before selected registry source is installed.

The opt-in registry beta is the release boundary for Base UI source; npm major bumps are not approved. Updated UI descriptors declare `contractVersion: 2` and `uiBase: "base"`. Older CLIs reject the new descriptors; the current CLI checks host compatibility before `add`/`sync` mutation. Legacy v1 descriptors remain readable, and existing apps retain their configured registry namespace. Keep stable `latest` unchanged; descriptor contract version 2 does not require npm major version 2.

The reproducible `bun --cwd packages/cli test:native-create` check generates a standalone app using a native blue/Inter/small-radius preset, uploads, OpenRouter, and S3. It resolves the exact preset, adds an item, syncs twice, verifies byte preservation of theme/config/font/helper files, and type-checks the generated app. A native Accordion installation was also checked on the Nova fixture: configuration stayed identical and standalone types still pass. A third run includes the website command’s default text/code/sheet documents, and passes the same checks. It does not call external model or storage services. The script also accepts a different native preset code for a representative style/icon matrix.

## Create preview

`/create` now vendors the actual upstream Create UI and mechanism from shadcn/ui commit `481d523374745e77d0cf9c53a4115ab5dd7c8481` (MIT). See `apps/site/vendor/shadcn-create/README.md` for provenance and the small integration adaptations. Native URL state, hover previews, locks, shuffle, undo/redo, preset parsing, theme construction, and self-hosted fonts are reused. The website and CLI both use shadcn 4.22.1; the native codec remains authoritative. Installation selections retain the existing registry schema and CLI options. Launch storage choices are Vercel Blob, S3, and R2; bucket options round-trip through `--storage-config`. Shared links reject unknown storage keys, and credentials remain in environment configuration.

The live preview uses shared message presentation, upstream-generated primitive variants for all eight native styles, native menu variants and icon libraries, and upstream theme/font metadata. Icon-library changes apply to native primitive glyphs; app-owned glyphs remain Lucide, matching what native initialization changes. It runs in an isolated iframe so selected tokens and portal content do not restyle the Create controls. Desktop/mobile and light/dark controls exercise the preview. Conversation and tool scenes are local samples; the preview uses a native textarea rather than embedding the production Lexical editor or EVE runtime. This is a preset/composition preview, not a claim of full runtime or pixel parity. Preset/share/command round trips use the native preset code, with Base UI selected separately.

Run `bun dev:site` and discover the URL with `bun dev:info --json`. Run the browser behavior and capture check with `bun test:visual:create`.

## W5 message parts and app verification (26 October)

Native shadcn `trace` and `code-block` were installed with the pinned CLI (4.22.1), including upstream `use-highlighted-code` and `highlighter`. The installed source is preserved; its two non-UI dependencies have the same narrow formatting/lint exclusion as installed primitives. ChatJS owns the small compositions and domain state mapping.

- `EveMessagePart` separates streamed part dispatch from transcript layout. EVE retains tool execution, request IDs, approvals, cancellation, document ownership and revision selection.
- Reasoning, MCP results, generic tool activity, code execution, source triggers and document links compose native Trace/CodeBlock. Markdown continues through Streamdown; specialized registry renderers retain their domain-specific UI.
- Removed the old reasoning, tool, code-block, sandbox and MCP-header facades (959 lines), their unused public props, and the unused `@radix-ui/react-use-controllable-state` dependency. No theme/preset contract was added.
- Approvals now route before document and installed tool dispatch, including `createTextDocument`. Read-only approvals and busy freeform submissions cannot respond. Generic outputs now display their values, including `false`, `0`, empty strings and `null`; errors use native destructive CodeBlock.
- Sources use direct native dialog/drawer triggers instead of a hidden-trigger click bridge. The mobile drawer has an explicit Close action; dismissal restores trigger focus.
- Document activity uses Trace without changing revision/live-follow behavior. The loading action no longer has an always-equal memo comparator that could retain an outdated title.

Verification: `bun lint`, all nine type tasks, and all 1,207 app unit tests pass. All 28 chat-route browser tests pass; 21 focused component/tool browser tests pass. Captures cover every tool state, falsy output, reasoning, code, sources, document actions, desktop/mobile and light/dark. Code tests exercise appended streaming content, language changes, unknown-language fallback, escaped source, blank lines, line numbers, exact clipboard payload and denied-clipboard retry. A cold dependency optimization reload was removed by declaring native highlighter dependencies in the browser-test config; highlighting waits for its actual tokens before capture.

Live QA in the user's Chrome created a real text document through GPT-4.1 mini, closed/reopened it, reloaded the conversation, and reopened the persisted document. Next.js MCP reported no compilation or runtime errors. Browser error output contained only a Grammarly extension error. Proof is saved locally at `apps/chat/tests/eve-results/w5/document-chrome.png` (ignored QA output). No shared database migrations or package publication were performed.

UI Verify review completed against the existing baselines:

- [App build](https://uiverify.ai/builds/01a17763-a7b8-7e53-ba23-d4741ecf1c4b): 16 renders, 12 existing comparisons and four new activity captures, zero failures. All reviewed.
- [Registry build](https://uiverify.ai/builds/01a17763-cc70-7dbd-adac-28615bc689f4): 32 renders, 18 existing changed comparisons, 13 new captures, one unchanged, zero failures. Both sides of changed captures and all new candidates were reviewed.
- [Capture correction recheck](https://uiverify.ai/builds/01a1776b-b30e-7c27-8c20-6bfe957295d5): three renders, zero failures, all reviewed. The standalone harness now scans the upstream highlighter file and asserts computed token colors; copy feedback freezes the native hover presentation for archive replay. The optional-content fixture uses native CodeBlockFooter so its zero value is not clipped by the rounded container.

No remaining W5 product regression was found in the reviewed states. Expected differences include native Trace/CodeBlock styling and cumulative W2–W4 theme, message and composer changes. These builds retain CHANGED status: no preview or CI baselines were accepted. Archives contain sanitized fixtures and were scanned for credential patterns before upload. The lint-configuration policy suite also passes (27 tests).

W8 subsequently completed the local launch integration: Create shares the native activity composition, three fresh-install scenarios pass, migration guidance is updated, and release artifacts were rebuilt/audited. See [W8 evidence](chatjs-w8-release-verification.md). Live external search/MCP/sandbox services were not exercised by this W5 pass; their renderer states were verified with fixtures. W9 remains full Base/Radix support. npm publication stays last.

## W3/W4 and local W8 verification (26 October)

- `bun lint` and all nine `bun test:types` tasks pass; registry mirrors remain aligned.
- App unit suite: 1,207 tests pass; registry unit suite: 185 tests pass.
- Focused native conversation/composer/image browser suite: 10 tests pass. Composer/plugin/lifecycle suite: 31 tests pass. Chat/home route suite: 33 tests pass. Offline message/composer presentation checks: two tests pass.
- `bun test:visual:create` passes after integrating the shared composer and all eight native presentation variants, including five icon libraries, scene resets/transitions, history, delayed iframe state replay, mobile and dark modes.
- [Local generated-app verification](chatjs-create-local-runtime-verification.md) records fresh minimal Nova and enriched Rhea installations, exact native configuration and command parity, add/sync preservation, standalone types, local runtime/authentication, and light/dark/mobile checks. Minimal AI Gateway completion, transcript persistence and existing-conversation draft persistence pass.
- User Chrome checks confirm Create's Chat/New chat/Tools transitions and message submission, plus the generated app's model picker.

Fleet review covered [App build 186](https://uiverify.ai/builds/01a1773b-6bbb-7d2e-a1c8-3467ec9dbb30): all 116 rendered states (108 before/after pairs and eight new captures), with zero render failures. Native theme/composer/bubble changes and reflow account for expected differences. Mobile scrolling and shared-chat Save reachability were additionally verified with actual interaction tests. The review identified a guest-sidebar capture taken before its loading state resolved and a nested mobile search backdrop issue. Both are resolved: the fixture waits for Search, and the canonical search composition supplies the nested backdrop without modifying native primitives. Three focused tests cover the full viewport backdrop, close/Escape, focus return and reopen; all three [fleet recheck captures](https://uiverify.ai/builds/01a1774b-ef22-70e3-9dee-bf4b6d20145e) were reviewed with zero failures.

The focused [registry build](https://uiverify.ai/builds/01a1773f-03c1-7cb8-8139-b626c6ccfebb) rendered 11 captures with zero failures. Review found a real user-attachment alignment regression, now fixed with a geometry assertion and [fleet recheck](https://uiverify.ai/builds/01a17742-e1e1-7bb7-8e21-fbcb4366d8b4). The remaining captured tooltip was an exit-animation artifact; the test now waits for portal removal and the [final action capture](https://uiverify.ai/builds/01a17746-ac01-7128-b6c6-69ad0d240945) confirms it is gone. A redundant blank behavior-only capture was removed; the state gallery retains visual coverage. No fleet baseline was accepted.

OpenRouter completion, actual S3 transfers and OAuth are not verified in this local matrix. Unsent new-chat text does not currently persist through reload; existing-conversation drafts do. The W8 update below extends this matrix through W5 activity and a real document-enabled generated app.

## Earlier foundation verification

- Registry full check: types, 185 unit tests, and 191 browser tests pass.
- CLI source suite: 323 tests pass; CLI lint/types pass.
- Reference routes: 72 existing tests and two new interaction tests pass. The additional native Nova composer regression checks editable, disabled, and read-only states in one capture.
- App helper relocation test and native preset resolution pass.
- Native generated-app integration passes for Rhea/Lucide/blue/Inter/small and Nova/Tabler/rose/Geist/large; both resolve exact native codes with zero fallbacks and preserve configuration through repeated installation/sync.
- App unit suite: 1,207 tests pass.
- Combined `bun lint` passes, including documentation and registry mirror checks. `bun test:types` passes all nine tasks.
- Create unit tests: 13 imported upstream query/preset tests and three installation tests pass. Independent browser checks verify transient hover/revert, invalid-preset fallback, unsupported-framework recovery, clipboard denial feedback, and share-link filtering of unknown or secret configuration. The full upstream interaction/capture suite passes across all eight styles and five icon libraries, native history/locks, installation command copying, font loading, dark/mobile layouts, scene interactions, and shared storage configuration. Attachment settings persist when scenes replace the iframe.

The full Next/EVE app runs against a disposable local PostgreSQL database initialized specifically for verification. Development login, chat creation/submission, composer options, model selection, and the share dialog were exercised in the browser. Next reports no compilation or runtime errors; React introspection was available. A development credential pulled from the current Vercel `chat-js-app` project now passes a real GPT-4.1 mini response in Chrome, including streaming completion and Ready state. Credentials stay in ignored worktree configuration. No shared database migrations were applied.

UI Verify fleet comparison completed with 31 successful renders: [App build 185](https://uiverify.ai/builds/01a174f9-50d8-7205-94bb-f5410dcd6f34) has six changed and 12 new captures; [Registry build 212](https://uiverify.ai/builds/01a174f9-53e0-7fd4-9b84-09b704e3cb85) has eight changed and five new. All candidates and both sides of changed captures were reviewed; no new product regression was found. Native Rhea restyling accounts for expected differences. Both builds retain CHANGED status; no fleet/CI baseline was accepted or modified. The site is currently Next 16.2, so its browser verification uses Playwright; the Next 16.3 MCP verification applies to the chat app.

## Additional fixes from verification

- Mobile artifact panels now size the actual resizable panel to the viewport width instead of hiding only an inner wrapper. Desktop 65/35 sizing, keyboard resize, close/reopen, and mobile-to-desktop restoration are covered.
- Mobile Sign in and collapsed Models controls have explicit accessible names.
- Native preview shortcut scripts render in the server layout, matching upstream, so iframe shortcuts execute without client script warnings. Theme output preserves upstream fixed-radius normalization for Lyra/Sera.
- Installation synchronization remounts with the preview iframe so scene changes retain selected uploads.
- Desktop and mobile homepage screenshots, typography, buttons, and layout remain unchanged after client navigation through Create.

## Release handoff

Earlier audited release artifacts were prepared for `@chat-js/cli@1.0.0`, `@chat-js/registry@2.0.0`, `@chat-js/gateways@0.2.0`, and `@chat-js/sandboxes@0.2.0`. They contain no environment files or workspace-only dependency references. The previous audit covered 1,939 release inputs. Those earlier archives were superseded by the W8 rebuild/audit in `/tmp/chatjs-w8-release`; see the release-verification report. Rebuild/re-audit again if packaged source changes before publication. The CLI pins shadcn 4.22.1 and the matching public contract versions; registry defaults now pin `0.2.0-beta.0`. The earlier major-version artifacts are withdrawn and superseded by the [beta release](chatjs-beta-release-verification.md).

The first publish attempt for gateways returned npm `EOTP`; a subsequent lookup confirmed the package was still absent. No packages were published. Publication is now deferred until QA and the remaining launch work are complete. At release time, recheck source/artifact hashes and rebuild/re-audit any stale archives, complete npm authentication, publish in dependency order, then run the clean-consumer check against public npm. Local generation and tarball consumer checks already pass. Website deployment and fleet baseline acceptance have not been performed.

## W8 local launch integration complete (26 October)

Create now generates native Trace/CodeBlock/Collapsible for all eight styles and shares ToolActivity/ToolOutput with the runtime. Five new Playwright tests cover keyboard/copy across eight styles and five icon libraries plus desktop/mobile light/dark. The existing full Create suite, 28 chat-route tests, five shared-component tests, 323 CLI tests, and 1,207 app unit tests pass; lint and all nine type tasks pass. Sixteen scoped fleet renders were reviewed, including four existing-baseline approval comparisons, with no remaining W8 regression. No baselines were accepted.

Fresh Nova/minimal, Lyra/document, and Rhea/upload applications pass installation and runtime checks. Real Vercel AI Gateway responses, persisted chat/drafts, and document creation/reopening pass. A test-only fixture in each generated app verifies native tool states and highlighted-code copy using its own installed dependencies. All disposable databases/servers were cleaned up. OpenRouter/S3 external operations and OAuth remain explicitly unverified.

The CLI README now documents native theme-only versus source-regenerating updates, the Base UI migration boundary, removed-wrapper replacements, and preserved runtime behavior. Current CLI/registry/gateway/sandbox archives were rebuilt/audited and a clean consumer installed the tarballs and ran CLI help. Publication and production deployment are the remaining release gate; W9 remains full dual-base support. [Release evidence](chatjs-w8-release-verification.md).
