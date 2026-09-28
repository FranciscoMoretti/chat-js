# Native tool format: EVE compatibility audit

Audited against the installed `npm:@chat-js/eve@0.61.0-chatjs.0` documentation and declarations on 2026-09-28. This is compatibility with the pinned version, not a claim about every upstream version.

## Conclusion

The definition format follows EVE's ordinary-tool API. The follow-up fix propagates unexpected exceptions, native authorization signals, and cancellation unchanged. Expected domain failures are explicitly reported with `usage.fail()` and remain application results with cost receipts. Nested execution remains deliberately restricted internal composition, not a second EVE dispatcher.

The findings below describe the initial audit. Current behavior and restrictions are documented in [Authoring Tools](../apps/docs/tools/authoring.mdx).

## What matches

- Native `defineTool`, schema-inferred input, typed return, and native context are the documented authoring API.
- Ordinary async generators yield full replacement snapshots, and their final yield becomes the durable tool result. The progress helper follows this rule.
- JSON receipts are permitted structured outputs. `toModelOutput` can project them to model-facing output while channels retain the complete receipt. Receipt marker, version, cost, and error status are ChatJS conventions, not an EVE-required envelope.
- Optional output schemas are not mandatory; restricting outputs to JSON-compatible values follows EVE's durable boundary.
- Completed EVE steps replay recorded results; interruption before completion can execute external effects again. Receipt accounting cannot independently guarantee exactly-once external charges.

Primary source: [installed EVE tool documentation](../apps/chat/node_modules/eve/docs/tools/overview.mdx).

## Findings

### Authentication control flow — fixed

Both `executeWithToolUsage` and `executeWithToolProgress` catch every exception and produce a ChatJS error receipt. EVE documents `ctx.getToken` and `ctx.requireAuth` as the inline authorization mechanism. Its implementation throws `ScopedAuthorizationRequiredError` and handles it outside the authored executor to start consent and resume the call. A catch-all wrapper prevents that signal from reaching the runtime, turning required sign-in into an ordinary generic failure.

Current provider tools mostly use environment credentials, so this does not demonstrate a broken current OAuth integration; it demonstrates that the proposed reusable wrapper does not preserve the documented OAuth contract.

Sources: [wrapper](../apps/chat/lib/eve/tool-usage.ts), [auth documentation](../apps/chat/node_modules/eve/docs/guides/auth-and-route-protection.md), [pinned authorization execution](../apps/chat/node_modules/eve/dist/src/runtime/connections/scoped-authorization.js).

### Error receipts — explicit domain failures only

EVE documents that throwing records a failed `action.result` and gives the model a tool error. Returning `{ status: "error", ... }` is legal JSON but is a successful executor return from EVE's perspective. ChatJS renderers interpret the envelope as an error; generic EVE hooks, activity labels, and consumers do not automatically acquire the same meaning. The projection gives the model JSON containing an error rather than a native tool error.

This is an application policy rather than a malformed tool definition. It must be an explicit decision, with authentication and cancellation control flow excluded from generic error conversion. A pre-start abort currently escapes; exceptions raised after execution starts are caught.

Sources: tool docs section “When a tool throws”; [wrapper](../apps/chat/lib/eve/tool-usage.ts); [model projection](../apps/chat/lib/eve/tool-model-output.ts).

### Nested invocation — restricted instead of emulating EVE

`invokeInstalledTool` validates input and directly calls the definition's `execute`. It conservatively rejects authored approval policies, which avoids silently executing an approval-protected action. It is still not a second EVE-dispatched tool call: it does not reproduce independent EVE action events/checkpointing, labels, output-schema handling, or delegated-agent availability policy. Replacing `toolName` on a copied context also does not prove runtime accessors are rebound to that name. Treat this as a constrained bridge for the current nested search/saved-code use cases, not as a universal implementation of EVE tool dispatch.

Sources: [nested bridge](../apps/chat/lib/eve/invoke-installed-tool.ts), EVE tool docs sections “Hide a tool from delegated agents”, “Label tool activity”, and “Gate a tool on human approval”.

### Scope is ordinary tools, not all EVE execution modes

`defineToolSet` checks `ToolDefinition`, whose pinned declaration has `execution?: never`. Background tools have a separate `BackgroundToolDefinition`, and workflow tools use `defineWorkflowTool`. Those modes have different final return/yield rules. Do not reuse the ordinary progress helper as a background/workflow implementation without an explicit design and tests.

Sources: [type helper](../apps/chat/lib/eve/tool-types.ts), [pinned definitions](../apps/chat/node_modules/eve/dist/src/tools/definition.d.ts), EVE tool docs sections “Background execution” and “Yield and return”.

## Recommended next boundary

Implemented without a new dispatcher or accounting store: shared helpers preserve native exceptions; `usage.fail()` explicitly selects a cost-bearing domain failure; nested calls retain the parent identity and reject approval policies, root-only availability, output schemas, and native auth access. Uncaught failures and cancellation do not yield a final cost receipt. Generic workflow/background support remains out of scope.
