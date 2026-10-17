# Integrated requirements and verification

Current review candidate: eve `8fb9d3597e5727349462fdaaeb948ab3d1d41d7b`. The full integration checkpoint below remains `efe221c7`; the current candidate changes only the hosted helper import and adds a bundler regression. External model and Blob transports are disposable fixtures. “Actual app” means real authentication, proxy, authored agent, application/workflow databases and browser or HTTP endpoint; it does not imply live external services.

| Required behavior | Verification and exact scope | Status |
| --- | --- | --- |
| Both agents compile and start | Eight app type tasks; both agents restarted on the final pin. | Pass, `efe221c7` |
| Guest create/send/live stream/reconnect/cancel | Existing actual guest proxy scenario rerun on `efe221c7` integration candidate: create 200, sends/cancel 202, exact cursor suffix, durable cancellation, no duplicate send. | Pass, `efe221c7` |
| Guest authority | Final scenario rejects foreign session and unknown authority query with 401; focused credential/route tests cover files, tools, checkpoints and local-resource denial. | Pass, `efe221c7` |
| Authenticated create/send/reconnect/cancel | Actual authenticated scenario on `7ba35c10`; `efe221c7` integration candidate repeats fresh create/completion/shared rendering and real sends/cancel during approval checks. Exact reconnect was not rerun on the final tarball. | Pass on earlier candidate; final partial rerun |
| Owner approval succeeds | Actual browser document approval on `6c40195d`; final-candidate authenticated MCP owner approval executes exactly one remote fixture call. | Pass, `efe221c7` |
| Owner declines approval | Actual final browser **Cancel** choice produces `input.resolved: denied`; no successful deletion. | Pass, `efe221c7` |
| Owner cancels a pending approval turn | Actual final authenticated cancel endpoint produces `input.resolved: cancelled` and `turn.cancelled`; subsequent real document read confirms preservation. | Pass, `efe221c7` |
| Foreign approval cannot execute | Separately authenticated foreign user receives 404 in document flow on `6c40195d` and final-candidate MCP flow; no remote call occurs. | Pass, `efe221c7` |
| Exact document revision | Actual create/edit and stale revision rejection preserve newer content; owner reads retained document after negative approval paths. | Pass, earlier and `efe221c7` integration candidate |
| Current MCP policy and responder identity | Actual authenticated connector with real DB policy: owner approves once, foreign response 404, disable while pending prevents execution, approval tightening requires owner receipt. Disposable transport injected through temporary fetch/dispatcher options, removed afterward; SSRF/DNS transport is outside this check. | Pass, `efe221c7` |
| Independent tool charging and known quota/balance checks | Existing real-worker research harness uses production billing/progress consumers and separately charges search receipts; provider accounting/auth/persistence boundaries are fixtures. App admission/usage tests retain known-balance checks and best-effort logging. | Fixture-backed pass; live provider accounting unverified |
| Known result correlation | Actual owner/session/send receipts and causal initial-create event/delivery IDs; foreign query returns no bindings. Final focused projection tests cover ambiguity, inherited events and sanitized sharing. | Pass, earlier actual app plus final tests |
| Unknown dispatch never automatically resends | Actual app SIGKILL after native acceptance, restart and identical-operation retry leave one native message and an unknown journal row. No native admission ledger/lookup retained. | Pass on earlier candidate |
| Exact checkpoint/copy boundary | Actual authenticated checkpoint/copy and post-commit native SIGKILL/restart retain the original history boundary. Native fault tests cover failed required persistence and receipt append. | Pass; no actual mid-commit kill |
| Immutable sandbox copy and restart | Final real native owner/VM captures original content, source advances, copied session reads original, foreign checkpoint rejected; `--resume` reads latest source content from same VM. | Pass, `efe221c7` |
| Local resource ownership and retirement | Actual SDK retirement/allocation races, replaced identities, retained live child and removal retry; actual authenticated worker route checks copy-retention rows. Final owner/VM fixture cleanup reaches zero resources. | Pass across targeted actual boundaries |
| Owned attachment replay/Edit | Actual upload, native stable URL, restored owned upload and foreign download/submission rejection on `6c40195d`; Blob transport fixture. | Pass on earlier candidate; live Blob unverified |
| Trusted copy seed and attachment isolation | Native seed/continuation harness and targeted digest/staging/ownership tests; public seed uses exact display bindings before sanitization. | Pass, final authenticated combined-flow check |
| Combined authenticated fork and saved copy | Same actual app source: checkpoint document/file ownership and bound reservation, distinct native VM with matching bytes and source-write isolation; saved public copy binds journal with independent document/file allocations. | Pass, `efe221c7` |
| Hosted candidate build and CI regressions | `8fb9d359` passes the previously failing hosted eve bundle, native regression, CLI unit suite and clean isolated app types; targeted app unit failures fixed. No cloud prewarming or deployment. | Pass, current candidate |
| Distribution for review | All four consumers select one committed 7.4 MB tarball, with SHA-256 recorded in README. App draft installs without reconstructing an ignored local artifact. | Reproducible draft artifact |

## Explicit unverified boundaries

- Actual process termination inside the checkpoint commit window was not run. Injected write/callback failures and post-commit SIGKILL are separate evidence.
- Live model accounting, live Blob, production/distributed resource authority, full CI/e2e/scenario tiers, final production build/deploy, and registry release are not verified by local integration. Local resource cleanup intentionally fails closed outside its declared authority.
- Fleet visual comparison needs `UIVERIFY_API_KEY`. Local route captures passed in four viewport/theme variants.

The earlier-candidate rows are explicitly dated by commit rather than silently counted as final-tarball reruns. No merge, release, deployment, live database migration or production pin cutover is part of this handoff.

## Evidence

[README.md](./README.md), [authenticated-evidence.json](./authenticated-evidence.json) and [guest-evidence.json](./guest-evidence.json) contain sanitized identities, results and host log paths. Fork PR #9 contains the residual contract inventory and upstream removal criteria. The app draft contains the exact tarball and source pin.
