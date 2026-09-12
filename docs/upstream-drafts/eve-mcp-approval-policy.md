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

The local adapter currently captures whether the discovered tool has a policy.
Policy-bearing tools always use native owner approval. Execution rejects a new
policy if the captured definition had no approval gate. This handles boolean
policies and refuses escalation, but conditional policies conservatively prompt
for every call, including inputs their callback would allow without a prompt.
It is not exact conditional-policy parity.

Before publishing an upstream request, confirm the supported way for tool
execution to inspect a durable native approval decision tied to the same call,
input, tool identity, and responder. If no public interface exists, request one
or a native boundary that evaluates the current policy immediately before
execution. Avoid creating a second application approval/transcript store.

Local tests cover the conservative gate, owner-only responses, schema validation,
and refusal when a policy appears after discovery. Compiled runtime approval
resume and real MCP OAuth reconnect still need end-to-end verification. This
note does not claim an upstream bug has been reproduced or reported.
