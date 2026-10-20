# PR 868 Render verification — 2026-10-20

The existing free Render service `chatjs-hosting-verification` successfully ran PR #868 (source revision `46f4a21ce5d9c8ed7f69342381ffbd34021b0c68`) with the existing Supabase/JustBash deployment adapters. Tested deployment commit: `ed96b026e2cd260af924fdbd879e0b2ef291e43a`, branch `codex/render-pr868-oct20`. Render reported live at 08:08 BST.

App: https://chatjs-hosting-verification.onrender.com

## Deployment adjustments

The deployment branch retains the private Supabase storage adapter, public Supabase CA certificate, limited PostgreSQL connections, and JustBash sandbox configuration from the earlier verification service. It keeps the PR's Next.js 16.3.0 and shared agent; there is no disabled guest worker workaround or paid plan upgrade.

Two deployment-script problems were corrected: explicitly run migrations without the Vercel-only `--deployment` flag, and resolve the Next.js executable from the app workspace instead of assuming a root dependency. The first startup attempt failed with MODULE_NOT_FOUND; the corrected deployment started successfully. Guest admission uses Render's Cloudflare client-address header.

## Observed checks

- Production build, migrations, and PostgreSQL lifecycle/fence setup passed.
- Public `/api/health` returned 200 and `status: ready`.
- Guest browser received `guest runtime works` from GPT-5 nano. Reload cleared the conversation and returned the welcome screen.
- Chrome GitHub OAuth login succeeded with the existing dedicated app.
- Registered Gemini 2.5 Flash Lite chat replied `registered runtime works`; the model also created a small test.py file through its registered tool capability. Reload restored history. A subsequent turn correctly recalled `orchid` and completed.
- Guest bootstrap returned 200 without a Set-Cookie header.
- Cross-origin bootstrap returned 403; a forbidden guest model returned 400.
- Missing guest credentials and a credential addressing another session both returned 401.
- A guest credential submitted to the account conversation POST API returned 401.
- A request with a forged invalid `cf-connecting-ip` header was rejected with an HTML 403 before normal guest bootstrap; a subsequent ordinary request succeeded. This is a focused edge check, not exhaustive proxy/security certification.
- No out-of-memory exit or worker restart was observed during the completed chat checks. First responses were slow on free compute.

## Limits

Render's free dashboard does not expose memory/CPU measurements. This smoke test does not establish headroom, concurrent-load capacity, restart recovery, or a precise memory reduction. The plan remains 512 MB / 0.15 CPU and retains idle spin-down.

No scheduled cleanup service exists in this verification workspace. The web deployment alone therefore does not guarantee the 24-hour cleanup target. Scheduled retention, full remote erasure, billing reconciliation and all registered tools/connectors were not certified by this run. Do not treat this as production acceptance.

Local screenshots: `/tmp/render-pr868-proof/guest-reply.png` and `/tmp/render-pr868-proof/registered-reply.png`.

The deployment overlay passed workspace type checks and nine Supabase adapter tests. Formatting and oxlint passed; the historical deployment differed from canonical demo-sync because it replaced the reference storage adapter. The reviewed opt-in profile keeps the repository default canonical. The shell corrections passed bash syntax and git whitespace checks.

## Opt-in profile after review

The repository keeps the canonical reference app provider selections. In a disposable source clone, set `SUPABASE_STORAGE_BUCKET` to your existing private bucket (the smoke test used `chatjs-staging`) and use `bash deployment/render/build.sh` / `bash deployment/render/start.sh` as the Render commands. The build invokes `node deployment/render/prepare.ts` to select the maintained Supabase adapter and override the shared agent and research subagents with JustBash. The profile also removes the persistent-workspace registration hook, since JustBash does not execute that provider’s retirement callback. Application and workflow pools each default to two connections per process, leaving room in the 15-client Supabase pool for health checks and deployment operations; budget additional instances separately. The script intentionally edits that checkout's source; do not run it in a development checkout containing edits to those provider files. It does not provision infrastructure or modify the default Blueprint.

The checked-in Supabase peer dependency supports this opt-in build. The missing-object normalization and its tests live in the registry's Supabase provider, so generated Supabase installations also receive the fix. Other storage errors remain errors.

Set `TRUSTED_CLIENT_IP_HEADER=cf-connecting-ip` only on the verified Cloudflare-fronted Render service. The startup script does not enable trust globally. JustBash applies to EVE's own workspace; ChatJS's installed tool execution provider remains separately configured. This profile does not certify persistent filesystem recovery or remote erasure.

The source revision after review incorporates the app-owned sandbox lifecycle and renumbered guest migrations. Those changes have not been deployed by this PR. The earlier test database needs explicit migration reconciliation or replacement with a fresh verification database before rollout; automatic deployment remains disabled. The timings above are evidence for the recorded tested revision, not a benchmark of the revised profile.
