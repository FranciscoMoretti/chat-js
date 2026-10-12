# UI typescript/no-deprecated audit

104 owned original memberships across8files: removed104, retained0, unresolved0. Generated mcp-create-dialog1 membership excluded and root-owned. No deprecated react-test-renderer imports remain in owned components/hooks/providers/site. No dependency/config changes.

| Original file | Starting | Removed | Retained | Replacement |
| --- | --: | --: | --: | --- |
| apps/chat/components/ai-elements/code-block.test.tsx | 7 | 7 | 0 | tests/visual/code-block-lifecycle.browser.tsx |
| apps/chat/components/auth-providers.tsx | 1 | 1 | 0 | Local brand SVG, identical existing Lucide ISC geometry, standard SVG attributes; same arrangement as local Google/Vercel icons. |
| apps/chat/components/device-login-page.test.tsx | 2 | 2 | 0 | tests/visual/device-login-lifecycle.browser.tsx |
| apps/chat/components/eve/eve-optimistic-response-group.test.tsx | 4 | 4 | 0 | tests/visual/optimistic-response-lifecycle.browser.tsx |
| apps/chat/components/eve/use-eve-fork.test.tsx | 70 | 70 | 0 | tests/visual/eve-fork-lifecycle.browser.tsx |
| apps/chat/components/lexical-chat-input.tsx | 1 | 1 | 0 | Removed obsolete MozBoxShadow; existing standard boxShadow:none remains. |
| apps/chat/hooks/responsive-hooks.test.tsx | 9 | 9 | 0 | SSR assertion stays unit;2 client tests move tests/visual/responsive-hooks-lifecycle.browser.tsx |
| apps/chat/providers/chat-models-provider.test.tsx | 10 | 10 | 0 | tests/visual/chat-models-lifecycle.browser.tsx |

## Lifecycle preservation

Six renderer suites now exercise native createRoot DOM through components/test-dom-harness.ts, which owns mount/update/unmount/container cleanup only. Callers retain their explicit React act batches. Existing primitive-mount is asynchronous; keeping a tiny synchronous harness preserves exact first-render counts and grouped controlled async scheduling in these inherited tests. No mocked renderer object or compatibility type casts. DOM queries replace renderer tree internals and their unsafe props suppressions.

- Code-block still controls both theme highlight promises and resolves the stale empty highlight before current streamed source. Final assertion now verifies actual rendered pre text after polling asynchronous effects instead of serialized dangerouslySetInnerHTML props.
- Device login asserts native link href, native retry button click, exactly one transfer-progress title and signed-in title after onError, no progress afterward. Adds missing unmount cleanup. Next Link renders natively; old CommonJS mock caused invalid browser element and was removed.
- Optimistic response retains exact two disabled buttons, both model labels, user text and two Generating... labels.
- Fork retains all12 tests: original model/tool, comparison restore, navigation, rejected recovery, ambiguous pending operation, retry/locking and attachment restoration failures. Browser file uses actual window origin instead of replacing window globally; original attachment same-origin contract unchanged.
- Responsive browser fixtures patch only matchMedia/innerWidth rather than replacing real window. First client render values and two listener cleanup calls preserved. All3 server false snapshots remain asserted by real renderToStaticMarkup in unit runner, avoiding duplicate browser React server bundles.
- Provider retains exact context identity under unchanged semantic inputs and lookup/filter changes under changed input.

## Verification

- Scoped native oxlint --type-aware: clean, /tmp/deprecated-ui-lint.json. -6 migrated Chromium suites20 tests pass, /tmp/deprecated-ui-browser.log; original21 tests retained as20 browser+1 server unit.
- SSR responsive and optional-content unit4 pass, /tmp/deprecated-ui-unit.log.
- New auth-provider-lifecycle browser1 pass verifies brand SVG paths, visible buttons and actual GitHub click/redirect contract; existing lexical input browser1 pass verifies independent editable/read-only handles and lifecycle. /tmp/deprecated-ui-controls.log.
- Installed only Playwright Firefox browser binary in machine cache, no package/dependency changes. Existing lexical input fixture passes in Firefox using temporary /tmp/chat-firefox-vitest.config.mts overriding browser instance only; /tmp/deprecated-ui-firefox.log.
- Inspected screenshots for new social-auth-brand-icons and lexical-independent-editors: icon visible and same geometry,3 coherent buttons, editor/read-only text independent, no overlap. Existing sandbox captures are sanitized fixtures, no private data.
- UI Verify fleet unavailable: UIVERIFY_API_KEY missing (previous pass /tmp/ui-boolean-uiverify.log); no baseline accepted.
- Parent runs integrated types/unit/lint. No generator or full mutable checks run here.

## Related Async Review

Reviewed the five UI/site retained promise-function-async cases without fabricating awaits or narrowing ReactNode with cosmetic Exclude types. Project/sidebar share render callbacks must stay synchronous ReactNode-producing callbacks consumed by client ShareDialog; broad ReactNode includes promises. Fork modelSelection.onChange only commits state synchronously and returns a resolved Promise for the established awaited selection interface; no I/O to await. Site reconnect returns null with no backend, and sendMessages immediately constructs/enqueues a stream whose asynchronous production happens in start. These are rule tensions with naturally synchronous APIs, not claims that every private promise identity is a public contract; no cosmetic rewrites made in this pass.
