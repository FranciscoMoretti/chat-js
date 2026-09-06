# M04 — upstream UI reuse and installation boundaries

Research date: 2026-09-06. **Evidence-backed proposal; no production API commitment.** This report reuses the executable R04 and R09 installation proofs instead of repeating them. It adds fresh primary-source inspection and live registry reads. It does not claim a new browser or AI SDK 7 compatibility test.

## Recommendation

Use shadcn/ui for accessible widgets and AI Elements for existing chat interaction/rendering behavior. Ship ChatJS functional components around those sources: each selected component should include its query/mutation/runtime integration through a typed service scope with working defaults. Application authors should compose `Composer`, `Messages`, `ConversationList`, or `Approval` without manually rebuilding their API wiring. The service scope is ChatJS glue, not a facility supplied by either registry.

Eve is the execution/session client; ChatJS remains responsible for ancestry, choosing a linear history, saved-conversation navigation, view-local drafts/selections, file persistence, and targeting actions to their originating conversation. Neither an AI Elements `MessageBranch` nor a wholesale Eve web starter is an adequate substitute for those boundaries.

## Pins and evidence

| Source | Observed pinned source/version | Evidence limit |
| --- | --- | --- |
| AI Elements | [`6a9d5b1822ffb10bba4bd97175f01edd7d8651cd`](https://github.com/vercel/ai-elements/tree/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd) | Current HEAD read through GitHub API. Source package is private `@repo/elements@0.0.0`, not a published runtime package pin. |
| shadcn | [`7c9eaba1c0a6404c990c144a654792e3313c650d`](https://github.com/shadcn-ui/ui/tree/7c9eaba1c0a6404c990c144a654792e3313c650d), `shadcn@4.21.0` | Same source as R09; no new installer execution here. |
| Eve | [`9cb98b98624d854257a09ffefc90b5b9b8d312d7`](https://github.com/vercel/eve/tree/9cb98b98624d854257a09ffefc90b5b9b8d312d7), package manifest `0.52.1` | Current source inspection. R04 executed released Eve 0.52.1 at an earlier source reference; do not equate newer HEAD with that package artifact. |
| R04 | [report](/Users/fran/.codex/worktrees/ceca/chat-js/research/framework-evolution/implementation/findings/r04.md) | Actual external paired install, Eve build, typed two-mount registration, serialized validation, and separate lazy browser chunk. |
| R09 | [report](/Users/fran/.codex/worktrees/c997/chat-js/research/framework-evolution/implementation/findings/r09.md) | Actual mixed namespace/URL/transitive selection installation and type-check; no production CLI claim. |

The AI Elements [manifest](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/package.json) develops against `ai ^6.0.105`, React `19.2.3`, and dev `@ai-sdk/react ^3.0.41`. Live generated registry items declare unversioned npm names. Therefore using current Elements source does **not** establish compatibility with ChatJS's `ai 7.0.93`; compile selected sources against ChatJS's actual lockfile before adopting them. A pinned installer does not pin mutable registry payloads or their transitive sources.

## What the reusable UI actually does

Each source link below is pinned to the inspected AI Elements revision.

| Surface | Existing functionality to reuse | ChatJS integration still needed |
| --- | --- | --- |
| [Conversation](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/conversation.tsx) | Stick-to-bottom scrolling, scroll control, empty state, Markdown download from supplied messages. | Fetch/subscribe to selected history; own loading/error/empty interpretation; view scroll identity; adapt Eve parts for export. |
| [Message](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/message.tsx) | Role layout, tooltip action buttons, Streamdown response, local branch navigation. | Map message parts; edit/retry/vote/copy behavior; permissions; tree-selected history. `MessageAction` supplies a button, not a mutation. |
| [Prompt Input](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/prompt-input.tsx) | Local or provider state, Enter behavior, file input/drop validation, blob previews/cleanup, submit status, async submission, optional screenshot action. | Durable upload service, attachment authorization, draft persistence, model selection, send/cancel policy, failure/retry semantics. Submit invokes the supplied handler after converting blob URLs to data URLs; it does not persist uploads. |
| [Attachments](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/attachments.tsx) | Attachment display, preview, information and remove control. | Storage operations, upload status and download URL lifetime. |
| [Model Selector](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/model-selector.tsx) | Command/dialog composition, filtering controls and provider logos. | Catalog query, entitlement/availability, selected model and gateway policy. Model names/data are supplied; logos fetch from models.dev. |
| [Tool](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/tool.tsx), [Confirmation](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/confirmation.tsx) | Tool states, collapsible details, input/output presentation; conditional approval UI and action buttons. | Map Eve HITL metadata; send response to originating session/request; handle rejected/stale/error responses; browser-safe specialized renderer lookup. |
| [Artifact](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/packages/elements/src/artifact.tsx) | Container/header/actions/content controls. | Document query/save/version history, work panel selection, editor loading, layout persistence. |

Two details constrain the scope design:

- `MessageBranch` holds `currentBranch` as local numeric state initialized from `defaultBranch`; `onBranchChange` reports changes but there is no controlled `branch` prop. Its content maps **every** branch to a div with `hidden`/`block` CSS. Children remain mounted. It neither owns tree ancestry nor prevents a hidden heavy renderer from loading. Reuse its button/group styling if useful; preserve ChatJS's controlled branch ID/history selection and mount only the active specialized renderer.
- PromptInput's provider can lift input/attachments, but lifting it to an application-wide singleton would share drafts across panes. Use one provider per composer/view unless sharing is deliberate. `globalDrop` installs document listeners: do not enable it on both simultaneous composers. Its uncontrolled form resets before async blob conversion; provider mode clears after the submission promise resolves. Neither behavior proves correct preservation of text typed while a send is pending. The functional ChatJS composer should snapshot the submitted draft and clear only that snapshot, with a focused acceptance test.

## Installation is per item, not per exported symbol

The current AI Elements [registry route](https://github.com/vercel/ai-elements/blob/6a9d5b1822ffb10bba4bd97175f01edd7d8651cd/apps/docs/app/api/registry/%5Bcomponent%5D/route.ts) parses imports to declare npm and registry dependencies. One requested source file produces one item; relative Elements imports become transitive URL items. `all.json` intentionally installs every component and is unsuitable for minimal selection.

Live reads of `https://elements.ai-sdk.dev/api/registry/<name>.json` produced these **direct** declarations. Each item installs `components/ai-elements/<name>.tsx`; shadcn then recursively installs listed registry dependencies and their own package requirements. Counts here are not transitive totals.

| Item | Direct npm names | Direct registry items |
| --- | --- | --- |
| conversation | ai, lucide-react, use-stick-to-bottom | button |
| message | ai, lucide-react, streamdown, @streamdown/cjk, @streamdown/code, @streamdown/math, @streamdown/mermaid | button, button-group, tooltip |
| prompt-input | ai, lucide-react, nanoid | command, dropdown-menu, hover-card, input-group, select, spinner, tooltip |
| attachments | ai, lucide-react | button, hover-card |
| model-selector | none | command, dialog |
| tool | ai, lucide-react | badge, collapsible, Elements code-block URL |
| confirmation | ai | alert, button |
| artifact | lucide-react | button, tooltip |
| code-block | lucide-react, shiki | button, select |

This matters for a minimal preset: importing only `MessageAction` from the upstream message item still installs Streamdown and its plugins. Generic `Tool` also selects `code-block` and Shiki. Package installation and browser chunking are different concerns. Prefer reusing the app's existing lower-level sources or a focused composition when the full upstream item graph is excessive; do not rebuild a parallel primitive library just to change that graph.

Observed payload SHA-256 values, in table order:

```text
conversation  7b964b9252cb39218ebbf1e156bcf42be7a049c51e881cf72cc7b7bc2ce31090
message       c37a2189906cf9e14d95f304d609dc6c0b53e22f78d1d644cddbe1d62284e804
prompt-input  660efa7c9a10c204ceeb8d32a320ef430a26776b283a148113a1f672a90af0b8
attachments   919d3098dd2c93263a4caa579443cee5860ccc83ee6144a37fb96ed7ce8c26a5
model-selector a4ca70919f02ee25c2a2deadaa73b3a323e0f0cb3e5744b72f183758d9f9296d
tool          ac2f38003fe00b0a0b7594bc028f0d6ff09db1a8a79a40bb4fa632565c06194b
confirmation  46c75b46b40421a5489238c9d537de59e79acb7673b87dbc688fcfe1ffc2909f
artifact      6df97316a98e33936fc001b6b57bbd0fb45efcec5a52b0bc460836eb08a00c9a
code-block    b5ac0e9373b26576c69a2035aae8868d957189bd3c52807bfa91e2a12904db32
```

These identify observations, not immutable replay addresses.

## Eve reuse boundary

The current [frontend contract](https://github.com/vercel/eve/blob/9cb98b98624d854257a09ffefc90b5b9b8d312d7/docs/guides/frontend/overview.mdx) supplies `useEveAgent`: session/stream state, send, respond, resume, cancel, reset, custom reducers and host/auth/header injection. It explicitly says Eve messages are not interchangeable with AI SDK UIMessage: file URLs may be absent and authorization/HITL parts need adaptation. That supports a ChatJS service adapter and browser-safe projection, not casts between whole message arrays.

The [web registry composition](https://github.com/vercel/eve/blob/9cb98b98624d854257a09ffefc90b5b9b8d312d7/apps/docs/registry/channel/web/app/_components/agent-chat.tsx) already combines AI Elements with functional send, attachment conversion, cancellation, resume and question-response handling. Study/reuse those behaviors. Its direct session hook and `/s` history/navigation handling are starter assumptions to replace at the ChatJS boundary.

The [channel/web manifest](https://github.com/vercel/eve/blob/9cb98b98624d854257a09ffefc90b5b9b8d312d7/apps/docs/registry.json) selects **40 files, 25 runtime dependency declarations, 4 development declarations**, including full Next pages/config/CSS, an Eve channel, AI Elements and shadcn sources. It is an app starter, not the installation unit for an embedded composer. Examples of pinned declarations are Next `16.3.0-preview.6`, React `19.2.6`, Streamdown `2.5.0`, and TypeScript `6.0.3`. Do not wholesale install this graph over the ChatJS app.

Current [Eve installer source](https://github.com/vercel/eve/blob/9cb98b98624d854257a09ffefc90b5b9b8d312d7/packages/eve/src/cli/commands/registry.ts) still treats official Eve setup metadata specially and does not execute external setup flows. R04's limitation remains: an external item must install explicit registration/mount source or provide a documented continuation. This does not block frontend-only items with complete source glue.

## Concrete selection handoff (proposal)

Use existing shadcn materialization through mixed registry addresses. R09 already proves this; its semantic requirement checks and runtime projection are ChatJS glue. Registry `meta` is not an executable ChatJS service-binding system. A frontend, composer, renderer, navigation or layout choice can all be an external address. The external source must export a component compatible with its declared slot, or ship an explicit adapter.

```text
Selected: composer + messages + external saved-navigation
components/chatjs/composer.tsx             # functional draft/upload/send integration
components/chatjs/messages.tsx             # history subscription + parts/actions
components/chatjs/scope.tsx                # typed services and view targeting
components/external/saved-navigation.tsx   # external functional source
lib/chatjs/default-services.ts             # selected ChatJS API adapter
lib/chatjs/composition.tsx                 # explicit imported components
components/ai-elements/{prompt-input,conversation,message}.tsx
components/ui/...                         # recursive selected widget graph

Optional selected heavy renderer:
components/tools/report/registration.ts    # lightweight loader + mounted tool identity
components/tools/report/contract.ts        # browser-safe runtime schema
components/tools/report/renderer.tsx       # dynamic import; heavy package imports here
```

The names above are discussion examples, not committed API names. The navigation item should receive a scoped typed conversation service (including its query behavior) and a target view, or consume that scope internally; it should not require the application author to manually implement a fetch loop and every mutation.

A heavy renderer's registry item declares its renderer-only packages. The registration imports only its contract and `() => import('./renderer')`; the default generic fallback remains outside that module. Omitting the selection must omit both source and package dependencies. Selecting it must still defer loading until its matching part is actually rendered. R04 proves that split for a small weather renderer; a real editor/chart renderer still needs browser network verification in the chosen host. Keep the key as Eve's final mounted tool identity, not a registry URL or ambiguous definition identity.

Before production commitment, check three narrow seams: compile selected Elements parts against AI SDK 7; run two simultaneous composers to check targeting/draft isolation and send-error behavior; inspect bundles/network with a heavyweight renderer absent, selected-but-unused, then displayed. Installation dry-run/diff should list complete transitive files/dependencies for each selection. No new version manager or package resolver is needed.
