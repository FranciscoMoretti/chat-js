# Eve branching and AI SDK 7: factual research resolution

Date: 2026-09-05. Resolves the investigation in [Establish Eve support for ChatJS branching and AI SDK 7 migration](https://github.com/FranciscoMoretti/chat-js/issues/283). It does not select an architecture or reduce the branching requirement. The reference application remains the existing ChatJS demo's resolved configuration.

## Finding

Published Eve `0.52.1` supplies typed client/store APIs for durable linear sessions, replay, cancellation and structured human-input responses. Its inspected public APIs do **not** expose historical session forking, external transcript import, historical message editing, or regeneration as an alternate branch. Independently concurrent sessions are supported, but creating two such sessions does not establish that they share the same prior execution/history state.

This is now stronger than documentation-only negative evidence: the released npm declaration files were inspected, and two matching upstream feature requests remain open. The architectural problem is preserving ChatJS's branch semantics across Eve's session boundary, separately from the agreed AI SDK 7 upgrade.

## Released artifact and source evidence

- Inspected the actual [Eve 0.52.1 npm artifact](https://registry.npmjs.org/eve/-/eve-0.52.1.tgz) in memory, without installation or execution. Its [version metadata](https://registry.npmjs.org/eve/0.52.1) declares Node `>=24` and peer `ai: ^7.0.82`. The artifact SHA-1 is `8cc19eb3ebc079281606123965998508a88d257f`; registry integrity is `sha512-XluSIAcUy/Gtwqje5Vpv0EbNhDohwZYjcpeWCrm9pyeS5auvNYsWcLQfGxcpRa65VXRn/Sj19v//p4hUDYaWEQ==`.
- Read the released `dist/src/client/sessions.d.ts`, `types.d.ts`, `session.d.ts`, and `dist/src/react/use-eve-agent.d.ts`. These provide direct release evidence for the public method/option findings below. Artifact metadata had no `gitHead`; do not assume inspected upstream main equals release source.
- Broader implementation/docs inspection was pinned to upstream commit [`e6037391160b493e395f46a226878fc81ae1a1c0`](https://github.com/vercel/eve/commit/e6037391160b493e395f46a226878fc81ae1a1c0), recorded in [the preceding research](./eve-runtime.md). That inspection searched all 89 Markdown/MDX docs for fork, branch and initial-history/import terms.
- ChatJS baseline is commit [`8422c767f30a7586beb5d511ef12e88b1a29e845`](https://github.com/FranciscoMoretti/chat-js/commit/8422c767f30a7586beb5d511ef12e88b1a29e845). Its thread package targets `ai: ^6.0.244` and `@ai-sdk/react: ^3.0.246`, so the existing declared dependency ranges do not establish compatibility with Eve's required SDK generation. [Package](https://github.com/FranciscoMoretti/chat-js/blob/8422c767f30a7586beb5d511ef12e88b1a29e845/packages/thread/package.json).

## Capability matrix

“Public” below means the operation exists in the release's inspected API, not that ChatJS integration has passed a runtime test.

| ChatJS requirement | Released Eve evidence | Result / gap |
| --- | --- | --- |
| Continue a known durable conversation | `ClientSessions.attach(sessionId, { streamIndex })`; `ClientSession.send` | Public. Handle targets the exact existing session. |
| Restore displayed history and follow active work | `snapshot`, `stream`, hook `initialEvents`, `initialSession`, `resume` | Public replay facilities. Rebuilding a client view does not change backend model history. |
| Fork at an earlier message/turn | Collection exposes only `create` and `attach`; no fork/checkpoint method | No support established in the inspected public surface. Upstream request remains open. |
| Import a saved ChatJS path as real prior history | `SendTurnInput` requires one `message: string \| UserContent`; options include no initial model-message history | No public import mechanism established. Upstream request remains open. |
| Edit an earlier user message and continue from it | No edit or replace-history method on released session/hook | Unresolved; local display edits alone cannot alter durable context. |
| Regenerate a response while retaining the original sibling | No regenerate method on released session/hook | Unresolved. Asking for another answer in the same session is a later turn, not sibling regeneration. |
| Run two sibling alternatives from one prior path | Multiple independent sessions; no shared-history fork primitive | Independent concurrency is available; equivalence to ChatJS siblings is not established. |
| Stop a selected active run | Session `cancel({ turnId?, tasks? })` | Public targeted cancellation. Mapping ChatJS run IDs to session/turn IDs remains adapter work. |
| Approve a tool after reconnect | `respond(InputResponse[])` and durable stream replay | Public. Preserve session/request ownership and authoritative resolution; not a cast to AI SDK approval helpers. |
| Route approvals to a hidden branch | Explicit session and request targets exist | Primitives exist, but branch/session mapping and restored ownership need a prototype. |
| Composable UI observing one runtime | Published React hook types expose projected data, raw events, cursor and commands; pinned source exports headless `EveAgentStore` | Suitable seam to investigate. Do not create a separate stream owner for each layout component. |

Release declaration evidence comes from the artifact above. Corresponding pinned source: [session collection](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/sessions.ts), [session options](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/types.ts), [session operations](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/client/session.ts), [React surface](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/react/use-eve-agent.ts).

## Upstream corroboration and limits

[Support session rewind/fork from an earlier turn](https://github.com/vercel/eve/issues/75) is open with no comments when checked. It requests exactly the distinction needed here: continuation from historical state while retaining the original session. This is a feature request, not a maintainer commitment or proof about every private API.

[Support bootstrapping sessions from external chat transcripts](https://github.com/vercel/eve/issues/91) is also open. It distinguishes importing real prior role/tool history from attaching an existing Eve cursor. Its description contains older API names, so use the published declarations for current signatures. A later commenter reports upgrade-related session recovery problems; that is user-reported evidence, not a reproduced failure or a guarantee that current releases have the same behavior.

The documented execution model is append-only within a session. Steering cancels/replaces active work; queueing preserves input for later processing and may fold adjacent deliveries together. Subagents have their own sessions/context. None establishes arbitrary historical branching. [Pinned execution model](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/concepts/execution-model-and-durability.mdx).

`startIndex` rewinds a stream reader, not model state. `initialEvents` rehydrates the client projection. `clientContext` is ephemeral turn context. `clear` removes history in place, and `reset` retires a session. These operations are not substitutes for a historical fork. The release declarations and [session contract](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/concepts/sessions-runs-and-streaming.md) distinguish these responsibilities.

## AI SDK 7 and approvals

ChatJS's current `ThreadRunChat` extends AI SDK `AbstractChat` and submits a selected linear path through `ChatTransport`. Its documented guarantees include independent sibling runs, retained original responses on regeneration, and tool/approval ownership by run. Upgrading package versions alone does not port this orchestration to Eve. [Existing architecture](https://github.com/FranciscoMoretti/chat-js/blob/8422c767f30a7586beb5d511ef12e88b1a29e845/packages/thread/ARCHITECTURE.md), [implementation](https://github.com/FranciscoMoretti/chat-js/blob/8422c767f30a7586beb5d511ef12e88b1a29e845/packages/thread/src/ai-sdk-run-chat.ts).

The official [AI SDK 7 migration guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-7-0) deprecates tool-level `needsApproval` in favor of generation/agent `toolApproval`. Eve separately exposes its own approval authoring and structured response protocol. Audit these at their respective boundaries rather than treating them as the same API. The migration guide is current documentation; this research did not run codemods, dependency resolution, type checks or behavioral tests.

Eve's message projection also differs from AI SDK UI messages, including authorization parts and optional attachment URLs. Its hook adds `resuming` to the lifecycle surface. A type assertion would hide meaningful behavior differences. [Pinned frontend contract](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/frontend/overview.mdx).

Tool approvals are supported; arbitrary frontend-executed tools are a different question. [Public API for client-side tools that park for user input, like ask_question](https://github.com/vercel/eve/issues/593) remains open. Do not claim that showing a custom renderer automatically gives it a supported durable tool-result submission path.

## Smallest next evidence

1. **Historical fork/import clarification or prototype:** demonstrate two continuations from a settled earlier point with preserved roles/tool results and unchanged original history. Explicitly determine state/sandbox and pending-approval behavior. An upstream-supported extension point, if found, must be shown on the pinned release. This remains a decision/prototype dependency, not permission to drop branching.
2. **SDK 7 compatibility spike in the existing demo configuration:** pin an AI SDK 7 package set satisfying Eve's range and run the existing thread behavioral suite, including sibling regeneration, hidden-branch updates, selected-run cancellation and restored approval ownership. Preserve failures as evidence; do not infer compatibility from compilation alone.
3. **Eve approval/cancellation recovery slice:** one typed tool pauses; disconnect/reload; respond by request ID; cancel a specific observed turn while another independent session continues. Record events and IDs to settle adapter mapping.

The factual investigation is complete: published primitives and material gaps are established sufficiently to unblock architectural discussion. Architecture, branching implementation, and runtime compatibility remain unresolved. No application code or runtime tests were executed; only this research document is committed.
