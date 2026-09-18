### What problem are you trying to solve?

In chat apps, users need to edit earlier messages, regenerate answers, and branch conversations.

For example, editing the second question should work like this:

```text
Original: Q1 → A1 → Q2 → A2
New:      Q1 → A1 → edited Q2 → new answer
```

The original conversation should remain usable. Creating the new one should not rerun earlier tools.

This builds on the transcript import request in [#91](https://github.com/vercel/eve/issues/91) and relates to branching in [#75](https://github.com/vercel/eve/issues/75). Could EVE support these flows with two small guarantees?

### Proposed solution

**1. Let the app save history after a completed turn.**

Expose the structured conversation, preserving user/assistant roles and completed tool calls and results. The existing memory callback could be enough; I do not necessarily need a new API.

**2. Let the app start a fresh session from that history.**

The server supplies an authorized portion of the saved conversation. EVE validates it, makes it available as both model history and display history, and waits for the next message. Importing history should not run a model or replay old tools.

This should also support:

- Empty history, for editing or regenerating the first exchange.
- A mapping to the new message/tool IDs, so the app can reconnect its annotations.
- Clear errors for unsupported content or incomplete tool calls.

The app would own permissions, retry records, branch relationships, annotations, files, and sandbox snapshots. Saving conversation history would not guarantee that files or sandbox state were captured at the same moment.

An initial version can support a limited, documented history format. Provider-specific data, pending approvals, and compacted history need explicit rules so import does not silently change their meaning.

**What I tested:** a local fork of EVE 0.52.2 supports edits, regeneration, and branching using this approach. Mock-runtime tests verify that new sessions wait without replaying old calls and that the original conversation can continue independently.

The prototype relies on fork-only import support. It has not been ported to current upstream or wired into the production app flow. Real-provider and hosted end-to-end tests remain pending, and broader fork checks still have existing failures.

Would extending the existing memory callback and session-creation API fit EVE's direction? I am flexible on the API shape and would like to agree on scope before preparing an upstream implementation.

### Suggested implementation prompt

After maintainer agreement, add supported history capture and fresh-session initialization on current main. Reuse existing extension points where possible.

Acceptance criteria:

- A completed turn exposes structured history the app can save.
- Import accepts supported history, including an empty history, without running models or tools.
- The next message continues from the imported history. Excluded messages stay excluded, and the original session is unchanged.
- Supported content and tool results are preserved, with mappings to new IDs.
- Invalid or unsupported inputs fail clearly.
- Document authorization, retries, capture failures, attachment access, and compaction limits. Include focused tests, public documentation, and a changeset.

### Alternatives considered

- **History as plain-text context:** loses message roles and structured tool results.
- **History reconstructed from UI events:** display content may differ from what the model actually received.
- **Workflow checkpoint cloning:** copies more execution state than these flows need.
- **An app-owned agent loop:** requires replacing much more of EVE's orchestration.
