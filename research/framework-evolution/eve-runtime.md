# Eve as the ChatJS execution foundation

Research date: 2026-09-05. This is research and a proposed direction for discussion, not a final architecture decision or an implementation plan.

## Position

Eve is a credible default execution foundation for ChatJS. It already owns the agent loop, durable sessions, tool execution, human input, reconnectable event streams, and a headless frontend store. ChatJS can own the application framework above that: composable screens, rich tool experiences, conversation navigation, installation, and application services. Reimplementing Eve's stream state machine inside Zustand would create unnecessary competing ownership.

The hardest integration question is **branching**, not streaming. ChatJS's current thread engine supports arbitrary selected paths and concurrent sibling responses through AI SDK. Eve's public model is an append-only durable session with sequential/steered turns. I found no documented session-fork or prior-transcript-import operation. Treat branching preservation as an unresolved capability requirement, not a transport conversion that is already understood.

This supports the agreed direction: Eve by default behind an explicit boundary, no second execution adapter until needed, retain the Next.js application, and demonstrate a second deployment host before broad portability claims. It does not yet justify advertising full feature parity with the present thread engine.

## Evidence and maturity

I inspected vercel/eve at commit [`e6037391160b493e395f46a226878fc81ae1a1c0`](https://github.com/vercel/eve/commit/e6037391160b493e395f46a226878fc81ae1a1c0). Its package version is `0.52.1`; npm's `latest` endpoint also returned `0.52.1`. This establishes a published version number, not that every inspected main-branch change is in that release. A prototype should pin the release and compare its bundled docs/types to these findings. [Package source][package], [npm metadata](https://registry.npmjs.org/eve/latest).

The published package requires Node `>=24` and has peer dependency `ai: ^7.0.82`. ChatJS's `@chat-js/thread` currently targets `ai: ^6.0.244` and `@ai-sdk/react: ^3.0.246`. Moving to current Eve therefore includes an AI SDK version decision and compatibility work. Bun can remain the package/script tool; Bun runtime support should not be inferred from using Bun to install a Node-targeted package. [Package source][package], [local thread package](../../packages/thread/package.json).

Maturity distinctions:

| Area | Evidence | Confidence limit |
| --- | --- | --- |
| Eve client/store/React exports | Public source exports and current documentation | Inspected, not run in ChatJS |
| Durable sessions and HITL | Documented execution contract and implementation surfaces | No crash/reload experiment performed here |
| Next.js integration | Official `withEve` guide | Not exercised against current ChatJS config |
| Custom Workflow world | Explicit `experimental.workflow.world` | Requires matching Workflow protocol; not a stable universal adapter guarantee |
| Rich per-tool frontend convention | Existing dynamic tool parts and registry distribution | Proposed ChatJS extension, not a verified Eve feature |
| Arbitrary conversation forks | No public operation found in audited docs/client collection | Must investigate upstream/support with a prototype |

The repository source is substantial enough to evaluate concretely; a pre-1.0 version and explicit experimental infrastructure setting still call for pinning and an upgrade policy rather than assuming a settled API.

## Product boundary: what is left for ChatJS?

Eve's frontend offering overlaps with a basic chat starter: it supplies React/Vue/Svelte helpers and can install a Next.js Web Chat application. Consequently, “a frontend for Eve” alone is a weak project definition. [Frontend guide][frontend], [installation guide][install].

ChatJS's stronger role is an application construction system:

- Compose a conversation, work area, navigation, artifacts, and actions into different layouts.
- Install a coherent tool experience, including the backend capability, typed presentation contract, and optional heavy frontend renderer.
- Own the app's users, access rules, conversation organization, persistence projections, uploads, and other product services.
- Make supported infrastructure choices installable without including every possible implementation.
- Preserve useful conversation interaction beyond the runtime's basic transcript, where the execution contract can support it.

This is a proposed positioning, not an upstream capability claim. The distinction should be visible in a minimal demo: an Eve agent is useful without ChatJS, while adding ChatJS produces an application whose composition and tool UX would otherwise require substantial custom work.

## Frontend ownership and composition

`eve/client` publicly exports `EveAgentStore`. It has a snapshot, subscriptions, reducer-driven projected data, raw events, a session cursor, and lifecycle methods. `useEveAgent` creates that store once and subscribes using `useSyncExternalStore`. This is already a headless observable boundary rather than an inseparable React hook. [Client exports][client-index], [store source][store], [React implementation][react].

Recommended first experiment: wrap one retained store/session with a ChatJS provider and narrow selectors. Components acquire commands and selected state from that scope, so moving the composer or a tool panel does not require wiring transcript props through the layout. Keep ephemeral UI choices in Zustand and fetched application records in React Query; avoid copying every streamed delta into both a runtime store and a separate canonical Zustand message array.

A provider must be scoped per conversation/application instance, not assumed to be one global store. Two panels may intentionally show different sessions; two components showing the same session should share ownership. Selector behavior, mount/unmount lifetime, and cancellation semantics need explicit verification.

The stock hook reads host, reducer, session, initial events, and other session-shaping options on creation; remounting changes those. Lifecycle callbacks refresh on render, and credential resolver functions can refresh credentials per request. ChatJS navigation should therefore own session/store identity deliberately rather than expect changing a hook prop to retarget a running session. [React implementation][react].

## Sessions, messages, and persistence

An Eve client handle addresses one durable `sessionId`. Its serializable state contains only `sessionId` and `streamIndex`; this is a cursor, not the transcript. `attach()` performs no request. Multiple handles can address independent conversations. A reset/terminal ID does not silently become a fresh session. [Client session state][continuations], [client collection source][sessions].

`useEveAgent` exposes `data`, `events`, `session`, `status`, and commands including `send`, `respond`, `resume`, `cancel`, and `reset`. Its default message projection is `EveMessage[]`, not AI SDK `UIMessage[]`. Eve includes authorization parts, optional file URLs, and its own metadata. Unmounting detaches a stream without cancelling durable execution. [Frontend guide][frontend].

Keep distinct identities for a ChatJS conversation, any branch, an Eve session, a runtime turn, and a tool call. Do not assume a ChatJS “run” corresponds one-to-one to a durable session: a session spans turns, and a turn can include multiple messages, steps, tools, and a pause.

Recommended persistence split:

- Eve's world owns authoritative execution state and durable event history.
- ChatJS's application database owns conversation ownership, names, organization, permissions, and mappings to sessions/branches.
- Any ChatJS transcript/search index is a rebuildable projection of runtime events, with a saved cursor and projection version.
- Client UI state owns selection, scroll position, layout and temporary editor state.

These are recommendations. A second transcript projection is optional if runtime replay meets the first release's access and performance requirements. Establish retention, export, deletion, and indexing needs before creating another mandatory database subsystem.

## Reconnection, human input, and state fidelity

The documented stream is ordered NDJSON with cursor-based replay. Event IDs permit deduplication across overlapping reads, but do not replace stream position as an ordering cursor. Interrupted-step retries can emit new events with new IDs for the same logical step; the docs explicitly acknowledge that events lack a complete attempt identity. The current stream contract normalizes older versions to delta-based version 25. These details matter to a custom projection. [Session/stream contract][stream-contract].

Use the supported client reconnection machinery first. It exposes reconnect policy control and bounded catch-up; tail-relative reads cannot automatically advance an absolute cursor. `MessageResponse` is single-use: consume it as a stream or aggregate it, not both. [Streaming client][streaming], [client messages][messages].

HITL requires more than a disabled composer: preserve the request ID, kind, pending state, and authoritative resolution. `respond()` sends structured responses; `input.resolved` records accepted results for replay. Optimistic “responded” UI is not the durable record. File attachments are accepted as AI SDK user content, but confirmed rendered attachments need not contain a browser URL. [Client messages][messages], [message projection types][message-types].

Use explicit structured approval responses. There are conflicting statements in the current human-input docs about plain text resolving approvals; the broader session contract says text does not decide an approval and structured responses do. Do not base ChatJS behavior on text matching without a release-pinned test. [HITL guide][hitl], [Session/stream contract][stream-contract].

Status should expose runtime progress, connection/catch-up progress, and pending input as separate concepts. Eve's public store status includes `resuming` in addition to ready/submitted/streaming/error. Flattening that into today's `ChatStatus` loses meaningful behavior. A cancelled turn can preserve already completed side effects and published output; cancellation should not promise rollback. [Store source][store], [execution model][execution].

## Branching and concurrent runs: the architectural constraint

The current local thread engine is deliberately a behavioral superset of AI SDK `useChat` on the selected path. Its generic message type extends `UIMessage`; `ThreadRunChat` extends AI SDK `AbstractChat`, passes the selected linear path to a transport, and creates independent run adapters. Tree regeneration retains old responses and inserts siblings; run-specific cancellation and tool ownership are core guarantees. [Thread architecture](../../packages/thread/ARCHITECTURE.md), [run implementation](../../packages/thread/src/ai-sdk-run-chat.ts), [types](../../packages/thread/src/types.ts).

Eve documents append-only conversation history. A message arriving during active work either steers by cancellation or queues for later processing; adjacent queued deliveries may combine into a turn. Separate sessions run independently. Background subagents/tools represent delegated work, not arbitrary alternate histories of the same conversation. [Execution model][execution].

The public `ClientSessions` source exposes create and attach. `SendTurnInput` requires a first message and turn options; it has no prior-transcript or fork option. I searched all 89 Markdown/MDX files under the pinned `docs/` tree for fork, branch, history import, and initial-history terms; no conversation-fork API surfaced. This is scoped negative evidence, not proof that no internal mechanism or future proposal exists. [Client collection][sessions], [client types][client-types].

Three approaches deserve discussion:

1. Preserve arbitrary branching through a supported Eve fork/checkpoint API, if upstream offers or accepts one. This has the best semantic fit, but depends on unverified capability.
2. Create independent Eve sessions from an application-defined history seed. That needs an explicit supported import/context contract and a policy for tool results, durable state, sandbox files, permissions, and pending approvals. Merely serializing a transcript into a new user prompt is not equivalent to restoring the original typed conversation.
3. Launch the new Eve path with linear conversations while the existing thread engine remains available in the current app. This reduces initial integration risk but changes feature scope and needs a deliberate user decision.

Do not equate `clientContext` with fork history: the documented field is ephemeral to one turn and not persisted as session history. Do not translate a regenerate action into “please try again” without acknowledging the different semantics. [Client types][client-types].

Recommended high-level position: keep branching as a first-class research requirement, but do not bend Eve's runtime into a fake AI SDK transport just to preserve all existing method signatures. An explicit boundary can preserve product concepts without freezing their existing implementation.

## Tools, frontend companions, and type safety

Eve's filesystem authoring uses typed tool definitions. Outputs can remain rich for channel/event consumers while `toModelOutput` supplies a smaller model-facing form. Tool outputs cross a durable JSON boundary. Normal tool execution and workflow-tool execution have different durable-wait semantics. [Tool guide][tools].

Eve's default dynamic-tool UI parts carry `input`/`output` as `unknown`; installing a backend definition does not automatically give each frontend renderer an inferred discriminated output type. `toolResultFrom` can infer a tool's return type using its authored definition identity, but its implementation depends on source identity metadata and does no structural output validation. It is not evidence that importing a server tool implementation into a browser is supported. [Projection types][message-types], [typed-result helper][tool-result].

Proposed ChatJS companion convention:

- Keep the backend Eve definition and executor in the server graph.
- Share a small serializable contract/schema and type-only references where possible.
- Keep a frontend definition with a stable capability identifier, supported contract version, and lazy renderer loader.
- Generate a static manifest of only installed frontend companions, each with an explicit dynamic import.
- Validate unknown external payloads at the adapter/renderer boundary; incompatible output gets a useful fallback.

This preserves strong TypeScript authoring while acknowledging that third-party HTTP payloads and independently upgraded installations still require runtime validation. Dynamic MCP tools cannot gain app-wide static types merely because their runtime schema exists. A schema-specific companion can provide a narrower contract for a known integration.

A companion should distinguish partial output, final output, errors, denied calls, approval prompts, and authorization prompts. Heavy editors/viewers should load when invoked or opened, with a cheap summary renderer in the base chat. Lazy loading reduces initial browser bytes; it does not remove an installed package from the dependency tree. Installation omission, server bundling, and client code splitting need separate checks.

Eve extensions introduce namespacing: consumer mount names qualify tool names. Therefore a renderer keyed only by an unqualified filename will fail for mounted extensions or overrides. Design the mapping to include the installed mount/qualified identity and contract version. [Extension guide][extensions].

## Distribution and selective installation

Eve already installs standard shadcn registry items from official catalogs, third-party namespaces, and URLs. Items can carry dependencies and explicit target files; some offer independently selectable components. Its namespace map is in `package.json#registries`. [Installation guide][install].

The registry copy model and Eve's extension package model are different ownership choices. A registry can write a mount/config scaffold, while an extension's compiled capabilities remain in an npm/workspace package and update with that package. Extensions support configuration, namespacing, overrides and disabled contributions. Treating every integration as copied editable source would miss this distinction. [Extension guide][extensions].

Recommendation: a ChatJS installer composes compatible registry items, with a backend item, frontend companion item and optional bundle/preset. Plain shadcn installation can work when targets and dependencies fully express the result. Whether one unmodified `eve add` can offer ChatJS's backend/frontend selection for arbitrary third-party items remains to be proven. Do not assume official Eve setup metadata is an unrestricted third-party installer API.

Runtime file discovery is not browser code discovery. A generated frontend manifest can make installation deterministic and let bundlers see lazy import boundaries. Layout replacement and user edits require their own contract; registry overwrite alone is not a semantic migration system.

## Host integration

The Next.js integration is a proxy/service topology. Local development starts an Eve server beside Next. Vercel deployment uses generated services/routes. Local production can start the built Eve output behind Next, and a separate production origin is supported. This lets the existing Next app survive while the runtime is integrated. [Next.js guide][next].

Self-hosting is documented as a Nitro Node service with independently chosen Workflow storage and sandbox backend. Custom worlds use an experimental setting and must match the vendored Workflow protocol. Persisted local-world storage and scalable multi-instance infrastructure are different deployment choices. [Self-hosting guide][self-host].

The second-host proof should include a durable tool pause, process replacement, reconnect, and response after resumption. A health endpoint or one ordinary chat reply is insufficient evidence for the portability claim users care about.

## Experiments needed before committing architecture

These are research/prototype gates for discussion, not tickets:

| Experiment | Question it resolves | Evidence to retain |
| --- | --- | --- |
| Minimal pinned Eve in current Next app | Can current auth, workspace and AI SDK versions integrate cleanly? | Exact version set, config diff, working turn |
| One shared store across rearranged panels | Does composition avoid duplicate streams and stale commands? | Render/subscription counts, navigation and remount behavior |
| Drop connection, reload, restart during HITL | Are cursor, pending input and final transcript restored correctly? | Event log, cursor snapshots, no duplicated tool execution |
| Two siblings from an earlier message | Can real branching preserve history and independent cancellation? | Supported fork/import API or explicit failed capability proof |
| External rich tool + heavy lazy viewer | Can a third-party item install a typed companion without backend imports in the client? | Registry payload, type errors for invalid contracts, bundle graph |
| Second Node host with selected world | Does durable behavior survive outside Vercel? | Restart/reconnect/HITL results and runtime versions |
| Upgrade/replay across a pinned release pair | How much runtime churn leaks through the boundary? | Compatibility fixture and projection migration behavior |

No application code, external issues, or runtime prototypes were created during this investigation. The recommendation is to discuss the product boundary and branching requirement first; other seams can remain small and concrete around Eve's existing public store/client.

[package]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/package.json
[frontend]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/frontend/overview.mdx
[client-index]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/index.ts
[store]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/eve-agent-store.ts
[react]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/react/use-eve-agent.ts
[continuations]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/client/continuations.mdx
[sessions]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/sessions.ts
[stream-contract]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/concepts/sessions-runs-and-streaming.md
[streaming]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/client/streaming.mdx
[messages]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/client/messages.mdx
[message-types]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/message-reducer-types.ts
[hitl]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/tools/human-in-the-loop.md
[execution]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/concepts/execution-model-and-durability.mdx
[client-types]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/types.ts
[tools]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/tools/overview.mdx
[tool-result]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/public/tools/result.ts
[extensions]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/extensions.md
[install]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/install-integrations.mdx
[next]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/frontend/nextjs.mdx
[self-host]: https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/deployment/self-hosting.md
