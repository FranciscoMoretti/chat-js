# Native subagent verification

## Scope and result

Verified the implementation at `80e5b636` in the isolated `francisco/eve-verify-subagent` worktree, using the same locally installed `@chat-js/eve@0.61.0-chatjs.0` candidate as the logical-chat worktree. The application used slot 12 (`http://localhost:3120`), with `chatjs_subagent_test` and `eve_subagent_test` databases on local PostgreSQL port 5447. Source port 3060 and its databases were not changed.

**A real model-driven child run now completes, its parent receives the result, and reload/follow-up work without changing the branch's native session binding. This does not certify production subagent support.** ChatJS currently sets `defaultTools: false` and does not expose a delegation tool. Verification temporarily installed only the native `eve/tools/agent` re-export. It was removed from the authored tool directory afterward; a reproducible fixture remains in `apps/chat/tests/fixtures/eve-subagent-tool.ts`.

## Bugs found and corrected

### Child conversation hooks claimed the parent's reservation

The first GPT-4.1 mini run delegated through the actual native agent tool. Two child sessions failed their `turn.started` boundary with `binding_conflict`. The parent displayed the native background-task failures.

The reservation guard was correct: a child's inherited authenticated reservation is not proof that it owns the parent's branch. The error was treating every execution session as a new application branch in the conversation hook.

The hook now reads the already-existing root binding using trusted native `session.parent.rootSessionId` for descendant project instructions. It does not pass the inherited reservation to that lookup. Only root sessions capture turn-index and named document checkpoints. Child turn indices and checkpoint IDs belong to their separate native transcript and must not overwrite the branch's checkpoint history.

The exact-session resolver, acceptance receipt checks, owner checks, deletion checks, and binder are unchanged. The regression tests retain rejection of a child attempting to bind its parent's reservation and additionally cover nested-child root lookup and both checkpoint boundaries.

### User follow-up suggestions ran inside background tasks

After correcting the conversation hook, a child completed but unnecessarily generated user follow-up suggestions. Its native `hook.result` contained a $0.0000328 model call, while the ledger contained only its primary step. Native hook results are emitted without another wildcard-hook dispatch; the application's reconciliation currently reads branch/root streams only.

Follow-up suggestions now run only for root sessions. They are UI affordances for a user-facing branch, not results of a background task. A regression test verifies children do not generate suggestions and root sessions still do. This removes the inappropriate auxiliary generation but **does not implement general descendant usage replay**; that remains an enablement requirement below.

## Live evidence

Final successful run:

| Identity             | Value                                  |
| -------------------- | -------------------------------------- |
| Logical chat         | `bd3de4b3-94ae-44f7-a068-c07d4fa82f14` |
| Branch/reservation   | `6eb88ffd-8e09-493e-b2e4-61955303bc70` |
| Root native session  | `wrun_01M351DN4B4RS14JWWRDMAABSX`      |
| Child native session | `wrun_01M351DS94BQC195PYJ0T2J94E`      |
| Parent tool call     | `call_C4EoiTdbGhHoUt62ZAsGq9U6`        |

The real creation request selected `openai/gpt-4.1-mini` and asked the model to delegate one plain-text task, omitting `outputSchema`. The child returned `CHILD42`; its native stream contains `message.completed`, `step.completed`, and `turn.completed`, with no child follow-up `hook.result`. The parent received native background completion and answered “The result from the background task is: CHILD42”.

Read-only inspection of the child's durable input confirmed the same authenticated owner and `chatjsReservationId` as the parent, together with a distinct native session and `eve.parentSession.rootSessionId` pointing to the root. Native run attributes independently identified `$eve.type=subagent`, `$eve.root`, `$eve.parent`, and the parent call ID. No credentials or serialized runtime signatures are retained in this report.

The application database contained exactly one bound branch for the root/child pair and no child branch binding. After browser reload, the transcript retained the result. A browser follow-up asking to repeat the marker returned `CHILD42` through the same root session.

After that follow-up triggered normal admission reconciliation, all five priced events from the original parent run and the child's one priced step matched the ledger by event ID, owner, native session ID, and exact provider cost. The parent events totaled $0.0000772. The gateway reported zero cost for the child's primary step, so this run verifies zero-cost receipt preservation and ownership, **not a positive child debit**. No child cost was relabeled as parent usage.

The native streams and database were read only for evidence. Diagnostic stream decoding was performed outside application code against these disposable local databases; no authentication policy was bypassed or changed. The public child stream remains denied because a child has no application branch binding.

## Repeat the experiment

Use an isolated checkout, the locally tested EVE package, separate test databases and a discovered worktree port. Apply the application migrations and run `bun eve:setup` against the new databases. Then:

1. Copy `apps/chat/tests/fixtures/eve-subagent-tool.ts` to `apps/chat/agent/tools/agent.ts`.
2. Start `bun dev` with Node 24. Restart the worker after authored-hook changes and create a fresh conversation; old authored snapshots are not retroactively updated.
3. Authenticate through `/api/dev-login`. Select GPT-4.1 mini and ask: “Delegate exactly one subtask using agent: Reply in plain text CHILD42 and do not use tools. Omit outputSchema entirely. When the task completes, report the returned text.”
4. Verify the native `subagent.called` event, child's completed native transcript, parent's background completion, and exactly one application branch binding for the pair. Reload and ask for the marker again.
5. Compare each native priced event with `EveUsage`, including owner/session/event identity. Parent auxiliary usage is reconciled at the next normal admission.
6. Remove the copied authored tool and restart the worker. Do not publish it as a production feature based on this test.

The provider can fail or choose a different tool invocation; a textual claim of delegation is insufficient. Check the actual native `subagent.called` and child completion events.

## Validation and remaining gaps

- `bun lint`: passes.
- `bun test:types`: all seven workspace tasks pass.
- EVE unit suites: 362 tests pass across 66 files, including three new lifecycle regressions.
- Browser: native delegation, completion, reload, follow-up and correct binding pass. Next MCP reports no compilation issues or runtime errors. React inspection confirms the original branch ID and root session remain selected, with the logical chat ID as draft scope after reload.
- Production tool availability remains unchanged. The EVE fork and package were not edited or published.

Before exposing delegation in production:

- Implement recovery of missed descendant billing events. Existing owner reconciliation inventories only application branch streams, and direct native child reads fail the current gateway ownership policy. A durable receipt/lineage-based read and progress contract is needed; do not create a fake branch binding or attribute child usage to the root session to avoid this.
- Define child access to branch-owned document, generated-file and code-sandbox resources. Those tool adapters still resolve the exact execution session and therefore cannot resolve a child as a branch. This run deliberately used a plain-text child with no resource tools.
- Verify a positive provider-priced child debit and retry/replay under injected hook failure.
- Exercise declared specialists and deeper native descendants live. Nested root selection is unit-tested, but this live experiment used one root-copy child.
- Exercise requested structured output separately. One live parent chose an integer-object output schema; the child answered in prose and native EVE correctly reported `OUTPUT_SCHEMA_NOT_FULFILLED`. The plain-text run succeeded. Structured-output reliability is not certified by this result.

The first Gemini 2.5 Flash Lite attempt returned an empty provider response twice and parked for retry before delegation. The successful live runs used GPT-4.1 mini. This experiment did not diagnose that independent provider behavior.
