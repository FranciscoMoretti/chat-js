# Exact upgrade candidate against real ChatJS

**Verdict: the package builds, but the real ChatJS agents do not compile or start.**
This checkpoint tests fork PR #9 at `aab691297a59cc8c325b8f8c584a472495aed9ce`
and ChatJS main at `c0ab1c0504bb3da73ca0f3625f66c47bf69e042e`, including merged
prerequisite #847. It uses the actual candidate built and packed locally, not the
published eve package as a substitute. No production pin, live DB or env changes.

| Boundary | Result | Evidence / limitation |
| --- | --- | --- |
| Exact candidate dependency build, eve build and pack | PASS | Three build tasks; tarball SHA-256 in package-results.json |
| Package public export compatibility with ChatJS | FAIL | `eve/transcript` and `inputResponseSchema` are absent |
| Real authenticated agent types/build | FAIL | 56 diagnostics in eight groups; authored channel build stops at `eve/transcript` |
| Real guest agent types/build | FAIL | One diagnostic; channel build stops at `inputResponseSchema` |
| Focused actual application tests | PASS, limited | 30 tests: model ledger, MCP adapter and POST route; fixture mocks do not prove native startup or approval execution |
| Current main with maintained eve pin | PASS | Eight workspace type tasks; distinguishes baseline from candidate failures |
| Real app startup/proxy | BLOCKED | Agent compilation fails before the app can expose both agents |
| Real app fresh send/stream/reconnect/cancel | BLOCKED | Same compiler gate; no runtime pass inferred from unit tests |
| Real app MCP/deletion approvals | BLOCKED | Native approval consumers need adaptation; separate proof slice follows |
| Copies, attachments and sandbox | BLOCKED / unexecuted | Missing copy contracts and unvalidated ownership/lifecycle requirements |

Separate startup #8 and stream #10/#848 fixtures are useful replacement evidence,
but do not turn these blocked full-app rows green. No automatic resend or weaker
ownership/authority policy was added to make the probes pass.

## Prioritized smallest decisions

1. **App adaptation:** replace the removed input-response schema import with an
   app-owned exact input validator or supported native schema. Preserve the existing
   accepted option/text shapes. This is the guest's first compiler blocker.
2. **App adaptation:** approval response policies now read `auth.principal`, while
   accepted execution receipts still expose `approval.responder`. Adapt MCP/deletion
   wrappers without requester fallback; prove actual consumer ownership/current policy.
   Native tool schema inference and the six progress-call signatures also need updates.
3. **Required contract decision:** copy/seed/checkpoint APIs (`authorizeFork`,
   `resolveSeed`, `eve/transcript`, waiting checkpoint) are missing. First evaluate
   native alternatives for trusted new-conversation copy and owned resource isolation.
   Port only the missing guarantee, not every old API. Do not remove these consumers
   merely to obtain a green build.
4. **App adaptation with contract checks:** event/projection shapes changed (message
   metadata, tool outputs, action/subagent events). Adapt display/search consumers to
   native events. Exact operation correlation, independent charging and no replay of
   billing/tool effects remain requirements and may need a smaller runtime extension.
5. **Pending validation:** attachment staging/retry, sandbox identity/lifecycle and
   packaged integration must pass after compiler blockers are resolved. No implied
   approval of a wholesale port or cutover.

The 56 diagnostics are not 56 independent defects. `diagnostic-groups.json` records
18 copy/seed, one checkpoint, six progress, two MCP inference, one input schema,
13 projection, ten action/subagent and five approval/deletion diagnostics. These
match the earlier published-package probe. Both real builds still fail.

An initial 57th diagnostic in `mcp-client.ts:387` came from the probe linking eve
back to a separate AI SDK peer dependency tree, producing incompatible schema symbol
identities. Installing the packed contents physically inside the copied app's
node_modules removed it. No application or runtime fix was required. Initial
missing gateway-output noise was also removed by building the local gateway package.
Only the corrected runs are recorded in the final compiler/test output files.

## Reproduce

Use Node24, Bun1.3.11 and pnpm12.7.0. Check out the two exact commits above.
In the candidate repository, install the frozen lockfile, build `eve...` with Turbo,
then run `pnpm --dir packages/eve pack --pack-destination /tmp/eve080-candidate-package`.
If the local pnpm shim fails with ENOEXEC, invoke its pnpm.mjs using Node24 and make
that wrapper available to nested package scripts. No package source change is needed.

In ChatJS, install its frozen lockfile, then build `@chat-js/gateways`. Create a
private `runtime/package.json` under this evidence directory with dependencies
`eve: file:/tmp/eve080-candidate-package/eve-0.80.1.tgz`, `ai: 7.0.137`, and
`zod: 4.5.4`; install it with Bun. Run:

```sh
EVE_TEST_NODE=/path/to/node24 python3 experiments/eve080-candidate-verification/compiler-probe.py
```

The probe copies tracked real app sources into a temporary directory and installs
the actual packed candidate contents into that dependency topology. It runs both
agent type configurations, both real `eve build --skip-sandbox-prewarm` commands,
and the three focused test files. Dummy auth strings and unreachable localhost DB
URLs are compiler-only settings; no .env files or application credentials are copied.
It does not start a database or a partially compiled application. The package
runtime install directory is ignored; the tarball hash and final outputs are saved.
