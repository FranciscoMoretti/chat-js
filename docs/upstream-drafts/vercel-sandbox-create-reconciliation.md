# Draft: reconcile a sandbox create after its response is lost

Status: local draft for user review; not submitted. This is a contract question, not a claim that a provider race has been reproduced.

Target: vercel/sandbox. Inspected installed `@vercel/sandbox` 3.3.0.

## Problem

A durable application records a unique allocation intent before calling `Sandbox.create({ name, persistent: false, ... })`. If the request times out, the application does not know whether the server accepted it. Conversation deletion must account for this allocation even after the originating workflow has been retired.

A subsequent lookup returning 404 cannot by itself establish that the earlier request will never complete. Retrying creation or get-or-create during deletion may allocate a new resource. Waiting for the VM timeout also does not establish that the named sandbox and any associated storage were erased.

## Evidence and limits

The installed `dist/sandbox.js` create method delegates to `APIClient.createSandbox` and returns the parsed sandbox/session response. `dist/api-client/api-client.js` forwards the caller's name and abort signal to POST `/v2/sandboxes` for runtime-based creation, or `/v3/sandboxes` for image-based creation. The inspected public create parameters expose no separate operation handle for resolving an ambiguous request outcome.

The official [SDK guidance](https://github.com/vercel/sandbox/blob/main/skills/sandbox/SKILL.md) describes project-unique names and idempotent get-or-create for long-lived sandboxes. That guidance does not establish the deletion ordering guarantee needed here. We have not reproduced a late allocation against the service and have not inferred undocumented server behavior from the SDK implementation.

## Requested contract

Is there a supported way to establish that a named allocation is terminal after a lost create response? Useful options would include a durable operation handle, a project-scoped idempotency key with status lookup, or a deletion tombstone that also prevents a previously accepted create from materializing later.

Please clarify whether a successful lookup followed by deletion has any ordering guarantee against still-pending duplicate creates for the same name, and whether a 404 after cancellation is ever authoritative evidence of non-allocation.

## Current application behavior

ChatJS retains uncertain allocation intents and keeps deletion pending. It does not mark them erased from a 404 or elapsed timeout. Confirmed allocations are looked up by exact name without resuming, deleted with orphan snapshots, and checked for absence. Already-cancelled tool invocations are rejected before reserving an intent or calling the provider.

ChatJS now includes the resolved provider team/project in each new hashed allocation name. The same resolved credentials are passed to SDK creation; cleanup recomputes and checks the identity before lookup or deletion. Changed scope and older unscoped names remain unresolved. This application fix does not resolve ambiguous create outcomes and is not presented as an SDK defect.
