# Execution-scoped approval receipts for conditional tools

Local upstream proposal draft; not published or accepted upstream. Baseline: EVE 0.71.3, commit `fab8ba1424eddfdedd6a177cac21710258da0e81`.

A dynamically discovered MCP tool can require no consent when its approval request policy runs, then require consent when the executor reloads connector policy. Removing the executor's receipt gate lets that call perform its effect without the newly required consent. Requiring consent for every MCP call changes product behavior. Freezing policy at request time loses the final authorization check.

Expose the settled human decision to the ordinary tool executor:

```ts
interface ToolContext {
  readonly approval?: {
    readonly requestId: string;
    readonly responder: {
      readonly authenticator: string;
      readonly issuer?: string;
      readonly principalId: string;
      readonly principalType: string;
    };
  };
}
```

Reuse EVE's narrow responder identity. Do not expose credentials, attributes, approval history, a user-supplied approval token, or a reusable grant. The application continues to recheck current ownership, enabled state and `requireApproval` before the remote effect. It compares the responder in its trusted identity namespace. Principal ID equality alone is insufficient across issuers.

## Required contract

1. **Current continuation.** Only a resolved approval belonging to the execution continuation being resumed may supply a receipt. A matching historical settlement alone is insufficient. Another invocation with identical visible identifiers gets no receipt. Workflow replay can reconstruct the same authority for the authorized continuation; this does not promise exactly-once external effects.
2. **Winner.** Issue from the durable settlement winner after response authorization, never from an allowed response-policy callback or losing candidate. Rejected, expired, pending, cancelled, ignored and ambiguous decisions supply none. Automatic policy approval supplies none.
3. **Exact action.** Bind internally to session, runtime tool identity, call ID and the actual parsed input supplied to execution. The runtime owns comparison and immutable capture. For dynamically discovered tools, binding must preserve the resolved tool's durable identity/closure; reusing a display name for another connector must not transfer consent.
4. **Parsing.** Input schema defaults, coercions and transformations must not silently change the approved action. Define and persist the input representation at the runtime's validation boundary, then compare against the executor's parsed value. A mismatch must fail closed. Application hashing of model JSON is not this contract.
5. **Authenticated identity.** Preserve authenticator, issuer, principal type and ID from the accepted response. Model text and unauthenticated response data cannot supply identity. Authorize cancellation responders as well as approvers.
6. **Before the callback.** The receipt is present before the effect callback without a separate application database write. Clear ephemeral authority at every harness entry, including early park/error paths, and prevent another callback in that invocation from reusing it.
7. **Recovery.** A persisted candidate before settlement remains unauthoritative after restart. A persisted winning settlement with its pending execution can reconstruct authority after restart. A completed execution's old settlement cannot authorize a fresh call. A crash during a remote effect still requires remote idempotency or an uncertain outcome.

## Experimental implementation

`receipt.patch` narrowly backports the fork's receipt projection to the release: private ephemeral map, preparation from the current resolved input batch and durable settlement, and injection through `createToolExecuteWithAuth`. It also clears the map on harness entry and consumes a matching receipt at callback-context construction. These two additions prevent stale authority surviving an early return and reuse by another callback in the same invocation. Replay constructs a fresh map rather than consuming an application ledger.

This is a local experiment, not a supported removal. The real compiled `step.started` fixture found a name-reuse gap in the first backport: rediscovery could substitute another connector closure. The patch now snapshots persisted dynamic metadata before refresh and checks it again at receipt retrieval. The replacement-connector test fails closed. The unchanged-tool tests pass across real Workflow local-world restarts, including Zod transformation, coercion and defaulting. See the README for exact proof boundaries. Full metadata comparison also invalidates receipts when non-authority closure data changes; preserving the approved callback binding or defining a runtime-owned stable identity is an upstream integration requirement. Arbitrary source revision migration and ChatJS’s Postgres backend remain unproven. The narrow public property still needs upstream review, documentation, supported distribution and compatibility proof before ChatJS can adopt it.

## Why the alternatives do not establish authority

A response callback is a candidate authorization decision, not proof it won settlement. An application ledger adds crash windows and grant lifetime without owning runtime replay. Searching `approval.settled` history identifies a past winner but cannot establish the current execution continuation. An authored workflow question may solve a fixed tool, but converting dynamic MCP tools into a workflow router is outside this proposal.

## Review and integration gates

Keep ChatJS's current fork adapter and execution-time policy/owner checks. Adopt the supplied real-runtime cases upstream, preserving the compiled dynamic discovery, transformed-input, local-world SIGKILL/restart and out-of-turn invocation proofs. Cover remaining deployment/backend compatibility and every reachable executor route. Verify the supported release consumed by ChatJS, not just an upstream merge. No application ledger, blanket MCP consent, workflow redesign, automatic resend or upstream publishing is part of this patch.

EVE 0.71.3’s approver-as-caller propagation is useful execution context, but does not by itself establish consent: an ordinary owner call also has that caller. The executable false-to-true counterexample and `invokeTool` case explicitly distinguish these facts.

The concrete upstream recommendation is to preserve the approved callback binding through replay, rather than authorize a rediscovered same-named callback with a new stable token. See [the design handoff](RESTART-COMPARISON.md) for the availability tradeoff, ChatJS’s captured message history, and the distinct unresolved Lane D hook-restart case.
