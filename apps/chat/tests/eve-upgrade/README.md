# Integrated eve 0.80.1 evidence

Current review candidate: signed fork `8fb9d3597e5727349462fdaaeb948ab3d1d41d7b`, `.eve-upgrade/eve-0.80.1-8fb9d359.tgz`, SHA-256 `559964f080e818519965f63d1f58bd10a1b17614665e930f97226a584fee2079`. The sections below preserve chronological checkpoints. Full authenticated/VM integration evidence is tied to `efe221c7`; the new candidate corrects a hosted import and has targeted build verification. This remains a draft, not a production cutover.

Original guest-checkpoint app base: `c0ab1c0504bb3da73ca0f3625f66c47bf69e042e`. Candidate: `6869c3500831cc713ca43bd4f801c8c3512870bb` (fork PR9). Local tarball SHA-256: `a00bf75e61af0115d8bd57b2e3abd3313b9e0354df43be71b2321ba02a7196d6`.

The original guest checkpoint selected that ignored local tarball. Later sections supersede that candidate. Reproduce it by checking out that candidate in FranciscoMoretti/eve, building `turbo run build --filter=eve...`, and packing `packages/eve` into the local `.eve-upgrade/eve-0.80.1-6869c350.tgz` path before `bun install`. This is an integration checkpoint, not a production dependency cutover.

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

## Authenticated runtime and app process interruption

`authenticated-evidence.json` records the real authenticated Next.js/worker/proxy run against candidate `7ba35c10` and app base `11899bf33`, with the subsequent Turbo environment and unknown-response wording fixes. Unlike the earlier guest fixture, set `PLAYWRIGHT=False`: that flag intentionally bypasses server-side session resolution and cannot establish authenticated-layout coverage. Use Node 24, Bun and agent-browser 0.37.0; derive the URL with `bun dev:info --json`.

To reproduce, initialize a new loopback PostgreSQL 17 cluster under a fresh temporary directory with `initdb -A trust -U eve_fixture`, start it on a freshly reserved loopback port, and create separate `chatjs_auth` and `eve_auth` databases. Set only this worktree's ignored environment to their `DATABASE_URL` and `WORKFLOW_POSTGRES_URL`; use new random auth/gateway secrets and dummy optional provider credentials. A dummy MCP key must be 32 random bytes encoded as base64. Point `LANGFUSE_BASE_URL` at loopback. Set `NODE_OPTIONS=--import <absolute-path>/tests/eve-upgrade/mock-gateway.ts` and `EVE_MOCK_AUTHORED_MODELS=0`. The preload mocks gateway HTTP transport and rejects other external fetches. Run the real `lib/db/migrate.ts` and `scripts/eve-setup.ts` only against these fresh databases, then start through root `bun dev`. This run required adding the installed Langfuse variables to Turbo's environment allowlist.

Navigate a worktree-scoped browser to `/api/dev-login`, create a fresh chat, send another message and check that the exact owner/session/operation journal receipt clears the pending draft. Send `cancel-this-turn` and press Stop while the mock stream is delayed; verify native `turn.cancelled` and Ready in the browser. Read the stream through the authenticated proxy, request a named checkpoint at its current before-turn boundary, then create a fork referencing that exact checkpoint. The recorded run restored 26 events at `turn_3` and completed its new turn. A second fixture user/session, seeded only in this disposable database and signed with the same local auth cookie scheme as dev-login, received 404 for both the first user's conversation and stream. No ownership was inferred from displayed text.

For the app crash window, install this trigger **only in that disposable app database** before sending operation `00000000-0000-4000-8000-000000000080` once through the authenticated proxy:

```sql
CREATE FUNCTION eve080_pause_receipt_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."operationId" = '00000000-0000-4000-8000-000000000080'
     AND NEW.kind = 'send' AND NEW."sessionId" IS NOT NULL THEN
    PERFORM pg_sleep(120);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER eve080_pause_receipt BEFORE UPDATE ON "EveDispatch"
FOR EACH ROW EXECUTE FUNCTION eve080_pause_receipt_binding();
```

Wait until a separate connection sees the committed intent with null binding and `pg_stat_activity` shows the receipt UPDATE in `PgSleep`. Locate the Next.js listener for this worktree's port with `lsof`, verify its process identity, and send that process SIGKILL. The browser must see a network failure. Terminate only the fixture's sleeping UPDATE backend, drop `eve080_pause_receipt` and `eve080_pause_receipt_binding`, and restart root `bun dev` with the same disposable databases. Retry the same operation ID and unchanged body: expect HTTP 502 with `chatjs_delivery_unknown`, no new dispatch, and a still-unbound journal row. The recorded native history contained exactly one test probe after retry. The unique fixture message is a test count assertion, not a production receipt-recovery mechanism.

Saved host logs: `/tmp/eve080-auth-next.log`, `/tmp/eve080-auth-next-restart.log`, `/tmp/eve080-crash-before.txt`, `/tmp/eve080-crash-browser-loss.txt`, `/tmp/eve080-crash-after.txt`, and `/tmp/eve080-crash-native-after.json`. The narrow trigger and function were removed. This is SIGKILL/restart evidence for the app dispatch fence; it does not claim a native-owner crash at the checkpoint commit window. Unknown still means unknown. The UI retains its draft and explicitly distinguishes a new manually submitted message from retrying the fenced operation.

A separate native-worker restart check sent SIGKILL to the verified chat worker PID 25089 (loopback port 57738), observed proxy connection refusal, then restarted the root development command with the same disposable databases. The exact retained checkpoint remained ready after the source had advanced. A new copy restored the original 26 events before `turn_3`, excluded subsequent source events and completed one fresh turn. See `nativeRestart` in the evidence JSON and `/tmp/eve080-native-restart-{checkpoint,copy,stream}.json`. This proves persistence across native process restart after checkpoint commit; it does not prove interruption within the checkpoint commit window.

The unknown-response slice passes 15 proxy tests, the updated local Chromium recovery capture (visually inspected), all 8 type-check tasks and root lint. Lint and type generation must run sequentially: their generated Next type files otherwise race.

## App-owned send display metadata

Known send receipts now supply display-safe tool selection through an ownership-scoped query. The browser joins the exact native delivery to its `message.received` event ID, using the current native reducer's user-message identity; tests fold real reducer events, including identical text in the same turn. Unknown, foreign, ambiguous and inherited receipts cannot acquire a new local selection. This metadata is not authorization or billing evidence. Native request bodies no longer carry ignored `messageMetadata`, and logical message identity uses the native ID rather than the removed custom-operation metadata.

In the authenticated disposable app, send operation `7d78a27d-c25b-4410-a36a-579086ed3812` returned delivery `96c53c3c-2939-4bf1-8cae-81c41b2e1d95`. After reconnect, editing that message restored Search in the actual composer. Evidence: `/tmp/eve080-display-send.json`, `/tmp/eve080-display-query.json`, `/tmp/eve080-display-edit.txt` and visually inspected `/tmp/eve080-display-edit.png`. Initial creation correlation is covered below.

Initial creates return a session ID but no delivery receipt. The app therefore requires a positively bound create with a validated nonempty initial input, then joins the current-session `session.started.meta.deliveryIds` to the exact `message.received` event ID. Native `turn-step.ts` initializes the first emission from `ChannelDeliveryKey`; `publish-session-events.ts` stamps its delivery IDs. This is causal native metadata, not first-message position or text. Restored/nested history, missing or multiple starts, missing or multiple delivery IDs, repeated delivery use, empty creation intents, unknown bindings and foreign ownership all leave the selection absent. They do not block creation or trigger resend.

Actual authenticated create/reconnect/Edit restored Search for `wrun_01M558204B8NA19DBEP76GXAGK`. Its initial start and received event shared delivery `e9555936-e5dc-4258-91c2-d36379e76177`; another authenticated owner received no display bindings. Sanitized identities are in `authenticated-evidence.json`; host evidence is `/tmp/eve080-initial-causal-{create,query,foreign}.json` and the visually inspected edit screenshot `/tmp/eve080-initial-causal-edit.png`. Nine focused journal/projection tests, all eight type-check tasks and root lint pass. No native admission API was added.

## Worker-owned local resource cleanup

Shared transcripts and public copy seeds also apply the ownership-scoped display receipts before sanitization. Only exact native delivery bindings supply selection metadata; unmatched receipts remain absent and private delivery identifiers are not disclosed. The projection/copy suites pass 55 tests, and all eight type-check tasks pass (`/tmp/eve080-shared-display-{tests,types}.log`).

Fork `6c40195d` retains the smallest provider-owned facts needed for cleanup: exact VM/state/fork snapshot names, session/cache ownership, borrowed snapshot provenance and allocating/live/removing/removed phases in the existing session metadata. A per-session cache lock and retirement marker fence first allocation and later materialization. Unknown allocation is not retried or reconciled from an empty SDK listing. Failed removal remains pending until exact absence is confirmed. The old 0.52 owner.json, sandbox-identity and local mutation-fence helpers and their obsolete tests have been removed.

The app route authenticates deletion credentials and authorizes the exact owner or fenced native descendant. It receives cache authority from the worker's route context; the requested root only verifies that authority. All covered sessions retire before removal. Consumer resources are removed before source snapshots; bounded progress passes handle snapshot dependency order. The existing app owner lock fences copy admission while preparing/accepted copy references are checked. Bound transcript copies own independent seeds, documents and files; provider borrower facts separately retain live native sandbox copies.

This is explicitly limited to the **local development host**, `MSB_BACKEND=local`, one canonical cache, and matching HOME/MSB_HOME settings. MSB_HOME must be absolute when set. Remote/production hosts, mismatched caches, unattributed metadata and crashed locks fail closed. Locks are never stolen or expired. This is not distributed fencing. Local backend variables pass through Turbo; no production environment or resources were changed.

Actual SDK 0.6.18 VM evidence covers retirement before allocation, retirement during allocation with a lost response, no resend, source removal with a live child, retained immutable snapshot, and failed removal followed by confirmed retry. The fork's `research/chatjs-native-checkpoints/verify-resource-cleanup.mjs` reproduces that provider proof. `/tmp/eve080-resource-digest-actual-final.log` records it.

The real authenticated worker route was also exercised with disposable app PostgreSQL reservation rows and an actual VM/fork snapshot. Oversized requests, foreign owner and wrong cache were rejected. Preparing and accepted copy rows retained the snapshot; after the fixture advanced to a bound independent copy, removal returned zero remaining resources and SDK listing confirmed absence. This tests reservation retention, not a new end-to-end copy dispatch. The fixture rows and native resources were removed. See `localResourceCleanup` in `authenticated-evidence.json` and `/tmp/eve080-resource-identity-app-proof.log` and `/tmp/eve080-resource-app-proof.json`.

Validation: 36 focused app authorization/coverage/deletion tests, all eight app type-check tasks and root lint; native focused lifecycle/resource tests, all 60 workspace type-check tasks, invariant guard and docs validation. Native lint passes with existing template warnings. The fork commit has SSH signature and DCO sign-off. The authenticated approval/document/attachment results and final local candidate are recorded below; this cleanup slice alone does not mark the upgrade done.

The resource contract also retains stable VM IDs and snapshot digest/path receipts from successful SDK allocation results. It refuses replacements reusing a name, checks snapshot absence at the recorded artifact path rather than trusting its rebuildable index, and keeps native snapshot dependency protection enabled. Fresh fork artifact version 2 resolves and verifies the captured digest before restore; state snapshot restore has the same guard. The real-VM proof includes replacing both a VM and snapshot under their old names and verifies that cleanup preserves the replacements and fork restore rejects the substituted snapshot. Earlier name-only records have no compatibility path; only the three completed disposable fixture records were archived from this worktree's cache before rerunning the new candidate.

Candidate used for the cleanup slice: `.eve-upgrade/eve-0.80.1-6c40195d.tgz`, SHA-256 `a4586a74f8afa8b40b7be2df0362c2c21f5892b0bc701c7b44e62d9ee7b8838c`. All four package consumers and the lockfile select this candidate. Earlier sections retain the candidate identities used for their historical evidence.

## Authenticated documents and owner approval

The gateway preload accepts an explicit `eve-fixture-tool:` JSON marker for create/read/edit/delete document calls, checks that the real model request offers that tool, and stops calling it once the request includes its tool response. Only model transport is mocked: the real authored tools, approval callbacks, app database and browser remain in use.

On candidate `6c40195d`, an authenticated session created and edited a text document. Reusing the old revision produced “Document changed. Reload before saving.” and the editor retained the newer content. A separately signed foreign user's approval request returned 404. The owner clicked Approve in the actual browser; native history recorded `input.resolved` approved, successful `deleteDocument`, and `turn.completed`. Exact identities and host evidence are in `authenticatedDocuments` in the evidence JSON.

This exposed an app bug: the open native turn remains streaming while it awaits input, but the app disabled approval controls with its general busy flag. Input responses now have their own command/resume guard, and read-only transcripts still cannot respond. Transcript/composer actions keep their existing locks. The real route-level browser test failed with disabled approval buttons before the fix and passes afterward. All nine chat route cases pass with desktop/mobile, light/dark captures. Fleet comparison could not run because this worktree lacks `UIVERIFY_API_KEY`; captures are local. All eight type-check tasks pass. A fresh browser session resolved stale hydration in the long-running fixture browser; no product hydration change was made.

## Authenticated attachment replay and editing

Current eve intentionally omits inline attachment bytes from its stream. ChatJS now passes a stable URL under its configured app origin after preflight validates the model, size and MIME type. The existing channel file resolver extracts the app key, rechecks the authenticated owner's access and reads storage directly; it never fetches the URL's host. Native history consequently retains a usable application URL, including after reconnect and copy. There is no receipt/text matching or native event rewrite.

The actual authenticated fixture uploaded a 68-byte PNG through the real Files SDK, created an attachment-backed session, replayed its stable URL and completed the turn. Clicking Edit restored a fresh owned upload with a verified digest. A separately authenticated foreign owner received 404 for download and 400 for submission before dispatch. The editor screenshot was inspected. The native development runtime installed its optional `just-bash` dependency on first file materialization; that dependency and lockfile are now retained explicitly.

Blob transport is disposable: `/tmp/eve080-blob-preload.mjs` installs an Undici MockAgent for the fixture store's upload, private read and signed-token endpoints, disallows other non-loopback Undici requests and uses a dummy token. `/tmp/eve080-integration-preload.mjs` loads this alongside the committed model preload. Use a single `NODE_OPTIONS=--import` pointing at that aggregator: Next combines multiple import flags incorrectly. `/tmp/eve080-browser-attachment-edit.mjs` forwards the actual local file route without following redirects, verifies its signed redirect points at the fixture store, and substitutes fixture PNG bytes for the external response. This proves app/SDK integration, not live Vercel Blob service behavior. Exact evidence is recorded under `authenticatedAttachments`. Preparation, channel ownership and restoration suites pass 29 tests; all eight type-check tasks pass.

## Final local candidate and source-owner VM integration

All four consumers now select signed+DCO eve `efe221c7`, packed as `.eve-upgrade/eve-0.80.1-efe221c7.tgz` with SHA-256 `3c7be9eb1e6b9b3a71633dfe31d565f1922c44fba107937977210e051db22fa9`. The tarball is a local integration artifact. Rebuild from that exact fork commit with `pnpm --filter eve pack --pack-destination <directory>`; preserve the recorded tarball for byte-identical reproduction.

The real native source owner captured `original` in a local VM checkpoint, then advanced its file to `advanced`. A new session restored the checkpoint and read `original` under its own session ID. A foreign checkpoint read returned 403. The source subsequently wrote `after-copy`; after development shutdown and `eve dev --resume`, it read that latest value from the same persisted VM. Final session resource retirement/removal returned zero remaining resources. Exact identities and host evidence are in `sourceOwnerActualVm` in the evidence JSON. This uses a deterministic authored tool/model fixture and actual native workers/VMs; the authenticated ChatJS database/document flow is separate evidence.

This check found a development cleanup bug: shutdown overwrote resource metadata and erased ownership receipts. Its regression failed before repair. Shutdown now verifies cache and VM identity, stops the existing persisted VM and preserves all receipts. It does not allocate state snapshots inside the CLI's forced shutdown window; an intermediate snapshot approach could be killed before persisting the allocation receipt. Earlier failing fixture resources remain available for explicit inspection when their ownership or allocation is unknown; no inferred recovery or automatic retry was added.

Final validation: 60 native workspace type tasks, the shutdown regression and three cleanup unit tests, native lint (existing template warnings), invariant/docs checks and package build; eight app type tasks, root lint and 71 focused app tests. Logs use `/tmp/eve080-shutdown-stop-*`, `/tmp/eve080-persisted-stop-app-*`, and `/tmp/eve080-final-app-focused.log`. Both app agents are restarted from the final pin. This is local review evidence, not production deployment or full CI. The native checkpoint commit window has injected-fault tests, not an actual mid-commit process kill. Fleet visual comparison remains unavailable without `UIVERIFY_API_KEY`.

After restarting both app agents on the final pin, a fresh authenticated create completed and its shared transcript returned HTTP 200 in the browser. The screenshot `/tmp/eve080-final-shared.png` was inspected, and the fixture was returned to private visibility. See `finalAppSmoke` and `/tmp/eve080-final-app-smoke.json`. Display-binding sanitization is covered by the focused projection tests; this screenshot proves the rendered shared route, not a visible selection badge.

## Review handoff completion

The final-candidate authenticated approval check now covers both negative owner paths. Clicking the approval card's **Cancel** button recorded `input.resolved` with outcome `denied`. A later pending approval cancelled through the real authenticated cancel endpoint recorded outcome `cancelled` and `turn.cancelled`. Neither executed successful deletion; a subsequent real `readDocument` returned the original content. See `ownerRejectCancel` in the evidence JSON and `/tmp/eve080-owner-reject-cancel.json`.

The existing guest proxy scenario was rerun unchanged on `efe221c7` with both real app agents enabled. Create returned 200; send and cancel returned 202; streaming and replay returned 200. Cursor 4 matched the exact five-event suffix of nine initial events. Durable history contained one cancellation and no duplicate send. Foreign-session and unknown-authority requests returned 401. See `finalCandidateRerun` in `guest-evidence.json` and `/tmp/eve080-final-guest.json`.

The requirements matrix in [REQUIREMENTS.md](./REQUIREMENTS.md) distinguishes current-candidate checks, earlier integrated checks, fixture-only boundaries and remaining release validation. The exact final tarball is now tracked at repository root `.eve-upgrade/eve-0.80.1-efe221c7.tgz`; no other local candidate is included. A fresh checkout can run `shasum -a 256 .eve-upgrade/eve-0.80.1-efe221c7.tgz` and `bun install --frozen-lockfile` without building the fork or obtaining a registry release. Expected digest: `3c7be9eb1e6b9b3a71633dfe31d565f1922c44fba107937977210e051db22fa9`. The source is signed eve commit `efe221c703cc57e9f165d6d7ceae82f112492a15`; rebuilding is supported, but only the committed artifact is asserted byte-identical.

## Authenticated combined copy and MCP closure

The final candidate now has an actual authenticated combined flow. Source `6fc620f8-cd2f-4b46-918c-d9a9181d91ee` created a document and materialized its owned PNG into a local Microsandbox VM. Named checkpoint `c1709970-6afb-431f-b55c-6a247480c88c` captured the boundary before `turn_1`. After an authenticated source-document edit, fork `cb542442-6e5a-476d-bb1c-24fdfa493bc5` read the original revision. Both bound reservations, document heads and inherited file references retained the expected owner. Native source `local:210` and child `local:211` have distinct identities; the child borrows the recorded immutable checkpoint snapshot. Both initially contained PNG digest `27e63057e51ba6a302fb6280624d05065c645f0ed10abf56454a3a2a85505b90`; writing different bytes to the source VM left the child unchanged. Saved public copy `7d71e38e-5c07-443a-953d-e5bb69fcb066` then settled its real copy journal to `bound` with new document and file identities. The source was returned to private visibility.

This reused the existing authenticated checkpoint, document and copy routes. A temporary `agent/sandbox.ts` selected `MicrosandboxSandbox.image("debian:bookworm-slim", { memoryMiB: 256, setup: { autoInstall: false } })` with `networkPolicy: "deny-all"`; it was removed afterward. External model/Blob transports remained fixtures. Public saved copies allocate independent resources and a trusted seed; they do not fork the source VM. See `authenticatedCombinedVmCopy` in the evidence JSON.

The authenticated MCP flow used a real encrypted connector row and the disposable HTTP protocol fixture from `eve-mcp.e2e.ts`. Foreign approval returned 404 with zero remote calls. Actual owner approval executed once. An authenticated `mcp.update` disabling the connector while its next approval was pending prevented execution. A database policy change from no-approval to required approval between request and execution also prevented execution without an owner receipt. Total remote tool calls remained one. See `authenticatedMcpConnector` and `/tmp/eve080-auth-mcp-closure.json`.

Transport setup is explicit: loopback is correctly rejected by the production SSRF guard. For this disposable fixture, temporary `mcpFetch` options `fetch: globalThis.fetch` and `dispatcher: null` routed the exact fixture endpoint through a preload to the local HTTP server, retaining the URL guard. Those options and diagnostic logging were removed after the check. The connector database queries, current-policy logic, native approval checks and authenticated routes were unchanged. This closes the DB-policy/responder integration boundary; it is not evidence for live OAuth, external MCP availability, DNS pinning or SSRF transport behavior.

After verification, both temporary VM sessions were retired through the native local resource manager; dependency-ordered purge reported zero remaining resources for both. The disposable MCP connector and foreign login session were removed. Temporary sandbox and MCP transport source edits are absent from the draft.

Closure validation: root lint passed and all eight app type tasks passed. Logs: `/tmp/eve080-integrated-closure-lint.log` and `/tmp/eve080-integrated-closure-types.log`. No runtime implementation change or new candidate artifact was needed; the committed model fixture now permits the disposable MCP tool name.

## CI failure diagnosis and repaired review candidate

Published CI at app `ec381a867` exposed four issues. The unit assertion omitted eve 0.80.1's `errorName`; the no-file copy-seed unit test accidentally loaded database environment validation through its storage dependency; scaffold templates preserved an unusable repository-relative candidate path; and the chat visual workspace's separate Vitest peer instance lacked the registry provider's command-context augmentation under an isolated install. The assertions/mock now match their boundaries, both template preparation paths vendor the exact candidate bytes, and the private visual workspace shares root test tooling with the registry.

Vercel's actual build log reported `MISSING_EXPORT: isEveDevEnvironment` in the Microsandbox runtime. A focused real Rolldown regression and a local hosted eve build reproduced it. Signed fork `8fb9d359` imports that helper directly from `dev-environment`, independently of the hosted optional-installer stub. The same regression and `VERCEL=1 eve build --skip-sandbox-prewarm` now pass. Prewarming was deliberately skipped; this generated output is not deployable evidence and no deployment was performed.

All four consumers select the new committed tarball. Only this current archive is tracked; earlier archive identities remain available in their historical commits. Verify `shasum -a 256 .eve-upgrade/eve-0.80.1-8fb9d359.tgz` against the digest at the top, then `bun install --frozen-lockfile`. Standalone CLI templates copy those exact bytes to `vendor/eve-0.80.1-8fb9d359.tgz` and use that local path. No registry package was published.

Validation: 229 CLI unit tests (including synced-template and source-fallback scaffolds), the two formerly failing app unit files, all eight app type tasks in a clean isolated install, and root lint. Native validation includes 60 type tasks, lint, invariant/docs checks, the new hosted bundler regression and package build. Existing authenticated copy/MCP/VM scenarios were not rerun because the runtime fix changes only the helper's import path. Logs: `/tmp/eve080-ci-{cli-unit,unit-green,final-isolated-types,app-lint,hosted-build-red,hosted-build-green,hosted-regression-red,hosted-regression-green,fork-types}.log`.
