# Integrated requirements and verification

Final runtime candidate: eve `efe221c703cc57e9f165d6d7ceae82f112492a15`. External model and Blob transports are disposable fixtures. “Actual app” means real authentication, proxy, authored agent, application/workflow databases and browser or HTTP endpoint; it does not imply live external services.

| Required behavior | Verification and exact scope | Status |
| --- | --- | --- |
| Both agents compile and start | Eight app type tasks; both agents restarted on the final pin. | Pass, final candidate |
| Guest create/send/live stream/reconnect/cancel | Existing actual guest proxy scenario rerun on final candidate: create 200, sends/cancel 202, exact cursor suffix, durable cancellation, no duplicate send. | Pass, final candidate |
| Guest authority | Final scenario rejects foreign session and unknown authority query with 401; focused credential/route tests cover files, tools, checkpoints and local-resource denial. | Pass, final candidate |
| Authenticated create/send/reconnect/cancel | Actual authenticated scenario on `7ba35c10`; final candidate repeats fresh create/completion/shared rendering and real sends/cancel during approval checks. Exact reconnect was not rerun on the final tarball. | Pass on earlier candidate; final partial rerun |
| Owner approval succeeds | Actual browser approval, successful document deletion and completed turn on `6c40195d`; negative paths below run on final candidate. | Pass on earlier candidate |
| Owner declines approval | Actual final browser **Cancel** choice produces `input.resolved: denied`; no successful deletion. | Pass, final candidate |
| Owner cancels a pending approval turn | Actual final authenticated cancel endpoint produces `input.resolved: cancelled` and `turn.cancelled`; subsequent real document read confirms preservation. | Pass, final candidate |
| Foreign approval cannot execute | Separately authenticated foreign user receives 404 in actual document approval flow on `6c40195d`; native consumer tests also reject foreign responders. | Pass on earlier candidate |
| Exact document revision | Actual create/edit and stale revision rejection preserve newer content; owner reads retained document after negative approval paths. | Pass, earlier and final candidate |
| Current MCP policy and responder identity | Five native-worker tests execute production MCP/deletion consumers, including policy tightening and foreign response checks; database and remote MCP are fixture adapters. | Fixture-backed pass; full authenticated connector flow unverified |
| Independent tool charging and known quota/balance checks | Existing real-worker research harness uses production billing/progress consumers and separately charges search receipts; provider accounting/auth/persistence boundaries are fixtures. App admission/usage tests retain known-balance checks and best-effort logging. | Fixture-backed pass; live provider accounting unverified |
| Known result correlation | Actual owner/session/send receipts and causal initial-create event/delivery IDs; foreign query returns no bindings. Final focused projection tests cover ambiguity, inherited events and sanitized sharing. | Pass, earlier actual app plus final tests |
| Unknown dispatch never automatically resends | Actual app SIGKILL after native acceptance, restart and identical-operation retry leave one native message and an unknown journal row. No native admission ledger/lookup retained. | Pass on earlier candidate |
| Exact checkpoint/copy boundary | Actual authenticated checkpoint/copy and post-commit native SIGKILL/restart retain the original history boundary. Native fault tests cover failed required persistence and receipt append. | Pass; no actual mid-commit kill |
| Immutable sandbox copy and restart | Final real native owner/VM captures original content, source advances, copied session reads original, foreign checkpoint rejected; `--resume` reads latest source content from same VM. | Pass, final candidate |
| Local resource ownership and retirement | Actual SDK retirement/allocation races, replaced identities, retained live child and removal retry; actual authenticated worker route checks copy-retention rows. Final owner/VM fixture cleanup reaches zero resources. | Pass across targeted actual boundaries |
| Owned attachment replay/Edit | Actual upload, native stable URL, restored owned upload and foreign download/submission rejection on `6c40195d`; Blob transport fixture. | Pass on earlier candidate; live Blob unverified |
| Trusted copy seed and attachment isolation | Native seed/continuation harness and targeted digest/staging/ownership tests; public seed uses exact display bindings before sanitization. | Fixture-backed pass; see combined-flow limit below |
| Distribution for review | All four consumers select one committed 7.4 MB tarball, with SHA-256 recorded in README. App draft installs without reconstructing an ignored local artifact. | Reproducible draft artifact |

## Explicit unverified boundaries

- A single authenticated scenario combining application document/file copies, copy-reservation database policy and actual VM fork lifecycle was not run. Those boundaries have separate actual or fixture-backed checks; their results are not presented as one end-to-end pass.
- A full authenticated MCP connector flow with current database-backed connector policy and remote MCP transport was not run. Production consumers were exercised through the native-worker bridge.
- Actual process termination inside the checkpoint commit window was not run. Injected write/callback failures and post-commit SIGKILL are separate evidence.
- Live model accounting, live Blob, production/distributed resource authority, full CI/e2e/scenario tiers, final production build/deploy, and registry release are not verified by local integration. Local resource cleanup intentionally fails closed outside its declared authority.
- Fleet visual comparison needs `UIVERIFY_API_KEY`. Local route captures passed in four viewport/theme variants.

The earlier-candidate rows are explicitly dated by commit rather than silently counted as final-tarball reruns. No merge, release, deployment, live database migration or production pin cutover is part of this handoff.

## Evidence

[README.md](./README.md), [authenticated-evidence.json](./authenticated-evidence.json) and [guest-evidence.json](./guest-evidence.json) contain sanitized identities, results and host log paths. Fork PR #9 contains the residual contract inventory and upstream removal criteria. The app draft contains the exact tarball and source pin.
