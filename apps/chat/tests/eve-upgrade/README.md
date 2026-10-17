# Integrated Eve 0.80.1 guest checkpoint

App base: `c0ab1c0504bb3da73ca0f3625f66c47bf69e042e`. Candidate: `6869c3500831cc713ca43bd4f801c8c3512870bb` (fork PR9). Local tarball SHA-256: `a00bf75e61af0115d8bd57b2e3abd3313b9e0354df43be71b2321ba02a7196d6`.

The app and guest package manifests explicitly select the ignored local tarball. Reproduce it by checking out that candidate in FranciscoMoretti/eve, building `turbo run build --filter=eve...`, and packing `packages/eve` into the local `.eve-upgrade/eve-0.80.1-6869c350.tgz` path before `bun install`. This is an integration checkpoint, not a production dependency cutover.

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

App-owned imported message fields now retain custom display metadata, model
provenance and text tool-output semantics independently of native Eve message
types. The sharing/tool-selection suites pass 17 cases. This changes reader
types, not native event production or seed acceptance.

The actual authenticated source compiler now reports 21 diagnostics, down from
31 before the imported metadata type separation, 47 after approval adaptation and 41 after child-session calls. Remaining errors are copy/seed/projection contracts; full repository lint/types remain blocked. No required capability has been removed to make these checks pass.

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
