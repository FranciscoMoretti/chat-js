# M04 → CLI/selection: tentative composition handoff

Read [exploration](m04-functional-ui.md) and [upstream source evidence](m04-upstream-reuse.md). No production API approved yet.

- Functional UI items include their behavior and chosen service/query adapter. Minimal composer must send without manually written callback wiring.
- Select source/dependencies at installation: core composer/messages; optional model/files/history/feedback/branches/documents/MCP; per-kind heavy renderers. External registry alternatives must work at every option-bearing installation boundary.
- Reuse shadcn/Eve resolution/installation. ChatJS glue validates declared services, mounted tool names, targets and browser/server boundaries. No parallel package manager or runtime remote JSX loader.
- Generated local imports preserve inference. Do not broaden external model/tool types to a fixed built-in union.
- Proposed conventional `chat/layout.tsx` is editable ordinary React. Path is tentative; know its location, propose a diff, never silently overwrite customized source. A/B view IDs and explicit history target survive layout changes.
- See file/dependency delta table in exploration. It is a proposed graph, not installed evidence. Materialize minimal + optional heavy + external replacement and compare emitted files/deps/import reachability. Registry prerequisites may be transitive and must be resolved, not guessed from this table.
- Scope semantics are stable from #288; names and factory surface await Francisco. Proceed with generic upstream item resolution independently; do not depend on a speculative `createChatUI` implementation.
