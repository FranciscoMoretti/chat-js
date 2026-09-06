# M04 → minimal app: runtime/service handoff

Read [exploration](m04-functional-ui.md). UI API names remain tentative.

Semantic needs, independent of React API spelling:

- One shared conversation resource/canonical ancestry and execution mapping, independently selected by multiple view cursors. View removal releases subscriptions and never cancels execution.
- Explicit command targets for send parent, regenerate message, stop execution, approval request and tool result. Return resulting message/execution identities so only the initiating view can follow when still on the same binding/path. No global selected-run helper in the browser service contract.
- Event-derived execution status/error/required input by origin. Replay and live events must not double-apply workspace effects. Transport reconnect attaches to existing work.
- Default installed adapter provides real functionality. Hosts may inject equivalent services. React components should not need to import Next, tRPC server routers, database records or Eve internal wire types.
- Browser IDs route commands but never authorize them. Owner/conversation/session ACL storage remains mandatory even without saved-history UI. UI query namespaces also isolate caller data; they do not replace ACLs.
- History/document/files are independent selected services. Document references include exact immutable revision + origin; save consumes base revision and returns persisted successor. Do not default historical document access to latest.
- Main ai 7.0.93 and prototype Eve ai 7.0.84 remain separate pinned proofs. No UI dependency on the private seed patch or a one-branch/one-session assumption. Distributed create-once remains an execution integration gate.

The local headless spike uses a recording service to test target preservation and late-response guards, not an implementation of your server contract. Continue your minimal linear implementation without importing its illustrative API names. Join against your accepted concrete service boundary later.
