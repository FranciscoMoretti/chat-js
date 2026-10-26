# ChatJS Create QA — 26 October 2026

Scope: existing `codex/shadcn-ui-plan` worktree, including its uncommitted implementation. Lead manual QA used the user's Chrome; three independent subagents covered lifecycle, presets/install/history, and responsive/keyboard behavior. No packages published, deployment performed, or visual baselines accepted.

## Confirmed failures and fixes

| Reproduction | Root cause | Fix and regression evidence |
| --- | --- | --- |
| Existing Chrome tab at `?preset=bJMUSG36&item=preview-tools` showed a blank iframe. New `/create` requests also timed out with zero bytes. | The existing Next dev server was unresponsive (about 125% CPU, 4 GB footprint; process sample inside uncaught-exception reporting). The original trigger is not proven. The host had no loading/failure recovery UI. | Restarted only this worktree's site server using `bun dev:site`, with durable log output. Added readiness-based loading, a 15-second failure state, and Retry preview. `create-recovery.ts` forces document failure, failed before the change, then verifies successful retry. |
| Gate the Tools iframe document; select Rose in the host before releasing the request. Host becomes `b4Xa52`, preview remains `b0`. | Parameter messages could arrive before the iframe's hydrated listener. A document load event was not a sufficient readiness guarantee. | Replay the latest parameters on the validated preview-ready handshake. `create-inflight.visual.ts` deterministically gates navigation and checks the actual preview preset. |
| Choose Tool states from the preview's scenario menu. The iframe changes, but host Chat remains selected and its URL does not change. | The menu changed only the iframe's local query state. | Route embedded scene requests through the host, validating origin, source, and allowed scene values. Direct standalone previews retain local navigation. `create-lifecycle.visual.ts` reproduced the mismatch before the fix. |
| Click the preview sidebar's New chat with an unfinished draft or active conversation. | The handler only cleared dynamic messages; it did not select New chat or clear draft/attachment. | Select the empty scene and reset all composer content. `create-preview-actions.visual.ts` covers both switching scenes and repeated New chat while already on that scene. |
| Cold-open/reload a nondefault shared preset, then Undo. It resets to `b0` without a user edit. | History started with an empty/default entry before settled URL initialization. | Seed history from the first settled URL. `create-history.ts` covers initial state, Undo/Redo, branch replacement, reload, and browser history. |
| Open native Rhea + large radius (`b27GcrVw`), then Get Code → Theme. Preview uses `0.625rem`, exported CSS used `0.875rem`. | Theme export omitted the native provider's Rhea normalization. | Match native normalization in CSS export; retain the opaque native preset in the CLI command. `create-theme-export.ts` compares computed preview radius against displayed and copied CSS. |

All behavioral regression probes demonstrated failure before their corresponding fix. During integration, strict lifecycle tests also caught duplicate sibling React keys that briefly retained two iframes; the recovery key was made distinct, and a single-iframe invariant plus console-error checks remain in coverage.

## Why earlier passing tests missed this

The previous suite waited for scenes and presets to settle before the next action. It did not change a preset while the replacement iframe document was blocked, switch scenes from the preview menu/sidebar, test failed document navigation, or assert initial history on a nondefault URL. Radius assertions accounted for native normalization in the preview but never compared exported CSS. The new tests exercise these integration seams rather than extending timeouts or loosening assertions.

## Verification

- `bun lint`: passed, including registry mirror validation.
- `bun test:types`: all nine tasks passed.
- Relevant model/native query/CLI handoff unit tests: 46 passed.
- `bun test:visual:create`: passed on the restarted server, with no application runtime errors. This command now includes the original full interaction/capture suite plus history, theme export, recovery, preview reset, lifecycle, and in-flight regression checks.
- Lifecycle: 18 settled and nine rapid host transitions; both control surfaces; preset/dark mode/uploads retained; sample attachment reset; cold URLs; reload; back/forward; narrow iframe and light mode.
- Responsive checks: 1440×1000, 1024×768, 768×1024, 390×844, 320×568, and 844×390; no document horizontal overflow.
- Keyboard checks: draft typing does not trigger r/d/o shortcuts; Enter versus Shift+Enter; model keyboard selection and focus restoration; dialog focus trap and return; picker Escape; forwarded theme shortcut; mobile dialog action reachability.
- Installation/share: Bun, npm, pnpm, Yarn commands; OpenRouter; uploads; S3/R2 public settings and shell quoting; shared settings restoration and unknown/private query filtering; unsupported base/framework recovery.
- Manual Chrome: reproduced the blank preview, then verified host Chat/Tools/New chat and preview menu/sidebar navigation with preserved Emerald preset.

Captures are in `apps/site/uiverify-screenshots/` (ignored generated artifacts), including `create-preview-failed.png`, `create-sidebar-new-chat.png`, `create-lifecycle-new-chat.png`, `create-lifecycle-mobile.png`, and `create-theme-radius.png`. Candidate images were visually inspected. A scoped UI Verify check was attempted for these five public fixture captures, but the configured project requires SDK archive format and rejected raw screenshots before rendering ([failed check](https://uiverify.ai/builds/01a1771e-4af5-7b4d-8ee3-5c322624d539)). This is a fleet verification limitation, not a passing comparison; no project settings or baselines were changed.

## Limits and operational evidence

The original server hang's initiating exception is unavailable, so the restart is operational recovery, not a claimed root-cause fix. A process sample remains in `/tmp/chatjs-create-server-sample.txt`. Final server output is `/tmp/chatjs-create-qa-server-final.log`; check outputs use `/tmp/chatjs-create-qa-{lint,types,unit,visual}.log`.

Concurrent development briefly left stale server markup (`p`) against updated client markup (`output`) for the recovery component. Those hydration errors were not filtered; the server was restarted after edits settled and checks rerun. Chrome's separate Grammarly hydration diff showed only `data-new-gr-c-s-check-loaded` and `data-gr-ext-installed` on body; Grammarly stream errors originated at its extension URL. These are distinguished from the application failures above.

The site uses Next 16.2, below the `next-dev-loop` skill's required 16.3. That workflow was not claimed or used; this pass used the requested Chrome and independent Playwright checks. The preview remains a local sample, not production Lexical/EVE. Native shadcn 4.22.1 preset semantics and Base UI + Next.js launch support remain unchanged.

## W8 native activity integration (26 October)

Create now generates native Collapsible, Trace and CodeBlock for all eight supported styles and records upstream hashes alongside the existing variants. Its tool states use the same browser-safe ToolActivity/ToolOutput compositions as the runtime, with native primitives injected for the selected preset. The conversation outline and terminal use native expansion/copy behavior. Native Copy/Check/Chevron glyphs follow all five icon libraries. The CLI forwarding/preset contract is unchanged.

`bun test:visual:create` passes the full host/iframe interaction suite: scene switching, history, repeated/rapid navigation, loading/recovery, presets, locks, shuffle, theme export, installation controls, unsupported selections, and share sanitization. `bun test:visual:create:activity` adds five tests: the eight-style/five-icon keyboard and clipboard matrix, plus four actual preview-route captures (desktop/mobile × light/dark). The recovery test now asserts the native error label.

UI Verify's previous ChatJS project is Vitest-only. A separate **ChatJS Create** Playwright project now accepts actual SDK archives; its key is stored only in ignored `.env.worktree.local` as `UIVERIFY_CREATE_API_KEY`. The four new captures were rendered and reviewed at https://uiverify.ai/builds/01a1778d-6ddd-7e6b-adee-4df356add846. They are new stories, not comparisons against an older Create baseline. No baselines were accepted. Use that scoped key with `uiverify check --static-dir apps/site/uiverify-archive` after running the activity suite.

Shared runtime validation: 28 chat-route tests and five component tests passed. Four native activity galleries and eight app route captures were rendered/reviewed with zero failures: https://uiverify.ai/builds/01a1778e-b945-7661-8fcd-8b8ef0173fe3 and https://uiverify.ai/builds/01a1778f-d328-72dc-88d3-f81aed0db819. Four approval captures compare against existing CI baselines; the remaining activity captures are new. The approval changes are the expected W2–W5 native presentation and create-document approval fixture. No additional W8 regression was found.

Manual QA in the user's Chrome verified Chat → New chat → Tools, native expansion/copy feedback, mobile preview and dark mode. Grammarly inserted body attributes before hydration on one load, producing a development-only hydration warning; the clean automated browser suite passes without that extension. No application change was made to hide the warning.
