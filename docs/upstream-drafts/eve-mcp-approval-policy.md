# Draft: approval evidence for dynamically rediscovered tools

Unpublished integration note for the pinned EVE 0.52.2 runtime.

ChatJS discovers MCP tools before an EVE step and reopens the authenticated
connector when executing a tool. This avoids persisting credentials or live
clients in workflow closures and rechecks ownership and tool availability.
However, the tool's `needsApproval` policy can change between those requests.

Evaluating a conditional policy during EVE's approval request and independently
rediscovering the tool at execution is insufficient: a previously optional tool
can become approval-required before execution. Executing the new definition
without checking the decision would bypass the new policy.

The local maintained EVE patch exposes an optional `ToolContext.approval` receipt.
The harness derives receipts from approval batches resolved in its current
invocation and the native allowed settlement audit. A step-local map binds each
receipt to the session, call ID, tool name, and exact input. The executor wrapper
only exposes a matching receipt, including the authorized responder identity.
Old settlement history alone cannot create a receipt; a new invocation replaces
the map, and duplicate call identities are rejected. No application approval
store or second transcript is added.

The MCP adapter evaluates boolean or conditional policies with validated input,
call ID, and the original model messages at request time. At execution it
rechecks the current policy against the current server definition. A required
policy only proceeds with the native receipt for the owner; newly required
approval without a receipt fails before the remote tool executes. A conditional
policy returning false does not prompt. Owner-only native response authorization
remains in place.

Local tests cover conditional input behavior, policy escalation, foreign
responders, schema validation, receipt identity mismatches, missing/old audit
state, ambiguous calls, and clearing receipt state. A native harness test uses a
deterministic model to resolve an owner approval through the real pending-input
coordinator and forward its receipt to the authored executor. A foreign approval
remains pending without executing the tool or model. These tests use no remote
model or database.

Compiled deployment/resume across worker restarts and real MCP OAuth reconnect
still need end-to-end verification. The public shape and step-local lifetime
need upstream review before proposing adoption. This draft does not claim that
an upstream issue has been published.
