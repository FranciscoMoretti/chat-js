# Integrated Eve 0.80.1 guest checkpoint

Original guest-checkpoint app base: `c0ab1c0504bb3da73ca0f3625f66c47bf69e042e`. Candidate: `6869c3500831cc713ca43bd4f801c8c3512870bb` (fork PR9). Local tarball SHA-256: `a00bf75e61af0115d8bd57b2e3abd3313b9e0354df43be71b2321ba02a7196d6`.

The original guest checkpoint selected that ignored local tarball. The current integration now selects the seed candidate described below. Reproduce it by checking out that candidate in FranciscoMoretti/eve, building `turbo run build --filter=eve...`, and packing `packages/eve` into the local `.eve-upgrade/eve-0.80.1-6869c350.tgz` path before `bun install`. This is an integration checkpoint, not a production dependency cutover.

## Runtime boundary and results

`guest-evidence.json` records the final browser run on 2026-10-17 with the committed TypeScript gateway preload. The actual ChatJS guest agent, model selection, gateway SDK, signed session-scoped credentials, Next rewrites and proxy policy executed. Only the external gateway HTTP transport was mocked; the model catalog returned 503 to exercise the committed fallback catalog. No live database or real provider credential was used. The database URL pointed to unused local port 1; guest workflow storage was local and disposable.

Creation returned 200; both explicit sends and cancel returned 202. The first live turn produced 9 events; reconnect from index 4 returned the exact 5-event suffix. After an active text delta, cancellation produced a durable `turn.cancelled` and `session.waiting`. History contained two messages, one cancellation, and no failed turn/session. Foreign-session credentials and an unknown authority query each returned 401. No automatic resend occurred.

The temporary Next configuration selected only the guest during this milestone because the authenticated agent still requires native API adaptations. It was restored to the normal two-agent configuration, with no committed config diff. Next MCP reported zero compilation issues for the exercised routes. The JSON health page has no React client session, so this is not full UI validation.

Guest TypeScript and `eve build --skip-sandbox-prewarm` passed. The request policy, proxy route and disposable guest suites passed 30 tests. Full repository lint/types were attempted and remain blocked by outstanding native API changes; this checkpoint is not a full-app green claim.

The app-owned strict input response schema preserves the previous requestId, optional optionId/text shape, including both/neither, and rejects unknown fields. PR848's published mock assertion lost two trailing undefined arguments during autofix after its earlier green run. The integrated route test restores them with a scoped lint exemption; PR848 itself is stale, not merge-ready.

## Authenticated native consumer checkpoint

The integrated source uses `response.principal` for approval response policies; execution still verifies `approval.responder` and current ownership/policy/revision. The MCP/deletion suites pass 36 cases. No credential capability is substituted for responder identity.

Research opens a fresh native agent session for each invocation, sends the structured request with its cancellation signal, awaits the turn result, and rejects failed or empty replies. Native structured output is `eve__reply`; the real runtime check caught the stale `final_output` prompt that type checks could not detect. Native `agent.started` carries the exact owning call ID and child `sessionId`, used for research evidence and independent billing discovery. Remote children and prefix-lookalike call IDs remain excluded.

The six adapter suites pass 74 tests. `bun run --cwd apps/chat test:research:native` passes both native scenarios (adaptive research and active child cancellation). This existing harness copies the production research tool, search progress reader, usage consumer and billing hook into a disposable native worker using the app's exact candidate package. Model responses, document persistence, auth, and search provider are fixture adapters. Two separate search receipts are charged to the owning root turn; orchestration costs zero. Gateway model accounting observation is stubbed because mock models have no real gateway intents. This does not prove production model accounting or full authenticated app startup. Final native log: `native-research-result.txt`.

App-owned imported message fields now retain custom display metadata, model provenance and text tool-output semantics independently of native Eve message types. The sharing/tool-selection suites pass 17 cases. This changes reader types, not native event production or seed acceptance.

Before copy-plan validation moved into the app, the authenticated source compiler reported 21 diagnostics, down from 31 before the imported metadata type separation, 47 after approval adaptation and 41 after child-session calls. Remaining errors are copy/seed/projection contracts; full repository lint/types remain blocked. No required capability has been removed to make these checks pass.

## Copy-plan validation checkpoint

`copy-seed.ts` now owns strict validation of the server-prepared copy transcript. The production plan preparer and copy journal use it directly, and stored seed and search-input types no longer depend on the missing native `resolveSeed` return type. No database shape or ownership/revision validation changed. The authenticated source compiler now reports 11 remaining diagnostics. Two focused tests exercise the real plan preparer, stable display-text search keys, retained model/text-tool provenance, detached data and rejection of live or incomplete parts, source sandbox URLs and oversized payloads.

Native seed admission, history event production, checkpoints and sandbox/file isolation remain incomplete. No legacy reader union or unused history normalizer was added. Full lint/types were run and remain red on outstanding runtime contracts; these tests do not establish a working copy lifecycle.

## Trusted seed runtime checkpoint

Current local fork candidate: `91a2864b14f2a3a740684120543565560e250f88`. The app and guest select `.eve-upgrade/eve-0.80.1-91a2864b.tgz`, SHA-256 `82a1c260450b37aa6899e6053ba999fcf0881bec9ad35ac03016f731101d75d8`. Build and pack that exact fork commit to reproduce this dependency; production pins are unchanged. The browser guest evidence above remains evidence for its original candidate, not a rerun against this one.

The native seed route resolves an accepted destination reservation under the current authenticated principal. Workflow initialization installs structured history before processing the first message and emits `history.seeded`; copied tools remain historical data. Destination files require channel authorization, successful sandbox storage and matching bytes on later model hydration, including after compaction. No legacy history importer is exported.

Fork validation: 215 affected unit tests, two focused integration tests, package TypeScript, targeted lint, docs validation and build passed. The app's five copy/sharing/search suites pass 56 tests; proxy/request-policy suites pass 26. The guest build also passes against this candidate. The existing native harness now passes three real-worker cases: research, cancellation, and trusted seed creation/continuation (`native-seed-result.txt`). The seed case checks idle creation without a model/tool turn, stable display IDs, retained tool history in the first model prompt, no historical tool execution and lookup of the same session. Its resolver uses the production app seed validator with a fixture-owned accepted reservation; this is not a database acceptance or crash/replay proof. Sandbox failure checks use the native in-memory runtime; end-to-end checkpoint/resource isolation remains outstanding.

The authenticated-source compiler reports seven remaining diagnostics, covering `authorizeFork`, waiting checkpoints and `history.restored`. Full app lint/types remain red. The app still fails closed on an unresolved copy lookup; durable admission/recovery is pending separately. This checkpoint does not establish a working complete save-copy/fork lifecycle.

## Registry dependency alignment

The registry and visual-test workspace now select the same local `91a2864b` candidate as the app and guest. Registry approval, research and tool-context consumers use the current native contracts, matching the integrated app sources. Registry unit tests pass 159 cases and package lint passes. Registry type checking now reports only two imported app errors for the missing `history.restored` contract. Root `bun lint` and `bun test:types` were rerun and remain red; no full-repository or visual-runtime pass is claimed. These are integration-branch dependency selections, not a production release or pin cutover. After dependency hoisting, the real-worker harness was rerun: research, cancellation and seeded continuation all pass (three cases, two research gates). The saved output is `native-registry-result.txt`; the same fixture limitations described above apply.

## Reproduction

Use Node 24 and Bun 1.3.11. Set a disposable worktree slot, run `bun dev:info --json`, then start through root `bun dev`. In the ignored `.env.worktree.local`, set `PLAYWRIGHT=1`, `EVE_MOCK_AUTHORED_MODELS=0`, dummy AUTH_SECRET/EVE_GATEWAY_SECRET values, `AI_GATEWAY_API_KEY=disposable-mock-key`, `DATABASE_URL=postgresql://postgres@127.0.0.1:1/unused`, and `NODE_OPTIONS=--import <absolute-path-to-mock-gateway.ts>`. Temporarily select only guest in Next's agents map until authenticated integration compiles; restore the normal map after testing. Do not commit that isolation.

Open `/eve/guest/v1/health` in a worktree-scoped agent-browser session with `--restore --headed --enable react-devtools`, then pass the following script to `eval --stdin`. It returns evidence without exposing the issued credential.

```js
(async () => {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const creation = await fetch("/api/eve-guest", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelId: "openai/gpt-5-nano" }),
  });
  assert(creation.status === 200, "guest creation");
  const binding = await creation.json();
  const base = "/eve/guest/v1/session/" + binding.sessionId;
  const headers = {
    authorization: "Bearer " + binding.credential,
    "content-type": "application/json",
  };
  const history = async (query = "follow=false") => {
    const response = await fetch(base + "/stream?" + query, { headers });
    assert(response.status === 200, "history status");
    return (await response.text())
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((event) => !event.$eve);
  };
  const controller = new AbortController();
  const stream = await fetch(base + "/stream?streamControlVersion=1", {
    headers,
    signal: controller.signal,
  });
  assert(stream.status === 200, "live status");
  const events = [];
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  const reading = (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let index;
        while ((index = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, index);
          pending = pending.slice(index + 1);
          if (line) {
            const event = JSON.parse(line);
            if (!event.$eve) events.push(event);
          }
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();
  const waitFor = async (predicate) => {
    const deadline = Date.now() + 25000;
    while (!predicate()) {
      assert(Date.now() < deadline, "event timeout");
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };
  const send = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "Reply briefly with hello from the actual guest agent.",
    }),
  });
  assert(send.status === 202, "send status");
  await waitFor(() => events.some((event) => event.type === "session.waiting"));
  const initial = await history();
  const suffix = await history("follow=false&startIndex=4");
  assert(
    JSON.stringify(suffix) === JSON.stringify(initial.slice(4)),
    "exact cursor suffix"
  );
  assert(
    initial.some(
      (event) =>
        event.type === "message.completed" &&
        event.data.message === "Hello from the actual ChatJS guest agent."
    ),
    "model text"
  );
  const before = events.length;
  const next = await fetch(base, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: "cancel-this-turn after the response starts",
    }),
  });
  assert(next.status === 202, "second send status");
  await waitFor(() =>
    events.slice(before).some((event) => event.type === "message.appended")
  );
  const cancel = await fetch(base + "/cancel", {
    method: "POST",
    headers,
    body: "{}",
  });
  assert(cancel.status === 202, "cancel status");
  await waitFor(() =>
    events.slice(before).some((event) => event.type === "session.waiting")
  );
  controller.abort();
  await reading;
  const durable = await history();
  assert(
    durable.filter((event) => event.type === "message.received").length === 2,
    "no resend"
  );
  assert(
    durable.filter((event) => event.type === "turn.cancelled").length === 1,
    "durable cancellation"
  );
  assert(
    !durable.some(
      (event) => event.type === "turn.failed" || event.type === "session.failed"
    ),
    "no failed turns"
  );
  const foreign = await fetch(
    "/eve/guest/v1/session/wrun_foreign/stream?follow=false",
    { headers }
  );
  const unknown = await fetch(base + "/stream?follow=false&owner=foreign", {
    headers,
  });
  assert(
    foreign.status === 401 && unknown.status === 401,
    "authority rejection"
  );
  return {
    appBase: "c0ab1c0504bb3da73ca0f3625f66c47bf69e042e",
    candidate: "6869c3500831cc713ca43bd4f801c8c3512870bb",
    creationStatus: creation.status,
    sendStatus: send.status,
    streamStatus: stream.status,
    initialEventCount: initial.length,
    exactCursorReconnect: {
      startIndex: 4,
      eventCount: suffix.length,
      matched: true,
    },
    cancelStatus: cancel.status,
    postCancelHistoryStatus: 200,
    foreignSessionStatus: foreign.status,
    unknownQueryStatus: unknown.status,
    sessionId: binding.sessionId,
    events: durable,
  };
})();
```

## App-owned admission decision

The accepted product contract allows lost-response sends to remain unknown permanently. There is no automatic resend of an uncertain native operation and no claim of universally exact recovery. `EveDispatch` commits the immutable owner/operation/conversation/kind/intent before dispatch; a successful native response records its exact session and delivery identity. Concurrent requests and later requests against an unknown row cannot dispatch again. Creation and trusted-copy records retain their existing ownership, source revision, policy, and independent billing checks. The new migration is generated locally only.

The fork's custom GET operation endpoint is removed in source. ChatJS now owns that positive-only application route using native `resolveSession`. Its small `operation-token.ts` adapter deliberately depends on **upstream 0.80.1's internal, unexported create-token format**. It is not a public native lookup API. A parity test imports the installed candidate's actual derivation, covering ordinary and trusted-seed namespaces. Gateway authentication supplies the current principal; callers cannot select a foreign principal. Existing tool-scope reconciliation needs this positive lookup when the native owner starts before the application receives and binds the creation response. A missing alias remains unknown; the route cannot create, send, or retry an operation. Alias loss and prebinding allocation gaps remain limitations.

Evidence: direct journal tests use an isolated PGlite database with the generated migrations, including concurrent dispatch fencing, lost response, successful binding, changed intent and foreign ownership. Separate proxy tests exercise the actual POST handler and journal with a mocked native transport. The real creation database path also verifies that a failed binding transaction rolls back while its previously committed dispatch fence survives. These are not real native acceptance or abrupt-process-crash tests. The candidate remains `91a2864b` until the integrated fork source is built and repackaged; the installed package still contains the older native lookup implementation. Full lint/types remain red on pending upgrade contracts and unrelated fixtures. Checkpoint restoration and final app/runtime validation are still outstanding.

The seven focused journal/lookup/creation/proxy suites pass 53 tests. Root lint and type checks were rerun; their existing upgrade blockers remain.

## Current checkpoint and receipt integration

Current local candidate is `7ba35c10`, selected by app, guest, registry and visual-test packages. Tarball SHA-256: `9a5e8860d25265af10b7ec92434c690e50e42c5050e1a43e3277490591a9359a`. Rebuild and pack that commit to reproduce the ignored `.eve-upgrade/eve-0.80.1-7ba35c10.tgz` dependency.

Application document snapshots now commit through the required checkpoint callback. Native readiness follows the durable private receipt append; restored history carries its exact before-turn boundary. The app reads positive send receipts from its durable journal for the exact owner, session and operation. Bounded browser polling cannot dispatch or infer that an unknown send was rejected.

Validation on this candidate: 58 targeted app tests, 9 local Chromium tests, 5 native-worker approval-consumer cases, and all 8 repository type-check tasks pass. Approval tests execute the production MCP and deletion consumers behind a local native-worker bridge; persistence and external MCP transport are fixture adapters, and token capabilities are deliberately unavailable at that serialization boundary. Native checkpoint integration passes 6 cases.

A disposable local microsandbox test also passed source-deletion isolation, destination stop/resume, a later copy from the retained artifact, and exact artifact removal after all fixture consumers were deleted. This is real provider cleanup, not app deletion orchestration or a process-crash proof. The old private approval-receipt-map test was replaced by the native-worker cases. The obsolete provider-create checkpoint test was replaced by the current provider lifecycle test.

Remaining integration gates include app resource ownership/reclamation, retained-artifact references, abrupt process failure, live display metadata correlation and full authenticated startup. In particular, native terminal status is not positive cleanup evidence: finalization logs sandbox cleanup failures. Production app cleanup still needs replacement of its old cache/identity/fence assumptions before it can claim current resource erasure. No live resources or database migrations were used.
