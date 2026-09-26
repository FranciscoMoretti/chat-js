# Disposable guest chat

Anonymous users get a text-only EVE session inside the shared ChatJS sidebar, header, composer, model picker and message presentation. There is no separate temporary-chat design. Account-only controls retain the existing sign-in gating. The UI stays at `/`; its session ID, transcript projection and signed access credential exist only in browser memory. Reload and New chat start fresh. No guest account, chat history, application session mapping, reservation or quota counter is created. Existing guest cookies no longer authorize application history. Registered users keep the application agent, database ownership, billing and `/chat/<id>` routes.

## Runtime and deployment

Disposable anonymous chats run alongside registered chats in the normal application. Existing authentication, application database, and registered Workflow Postgres configuration remain required. A guest-only CLI scaffold without those dependencies is deferred to [issue #455](https://github.com/FranciscoMoretti/chat-js/issues/455).

The guest agent is mounted at `/eve/guest/v1/*`; the registered agent uses `/eve/chat/v1/*`. These are the supported application-facing mounts on local and hosted deployments. `/eve/v1/*` is only the worker-side protocol path behind EVE's generated routing; the application does not expose an alias for it. Guest execution uses managed Workflow on Vercel and EVE's local World locally.

Set `APP_URL` to this application's public origin on non-Vercel hosts; guest bootstrap fails closed when it is missing. On Vercel, bootstrap uses the configured deployment hostname. The server-only bootstrap credential uses `EVE_GATEWAY_SECRET`.

Anonymous chat is text-only, with no saved history, message allowance or spending cap. Existing account-only controls keep their sign-in gating. Deployers can apply hosting-level limits. Registered-user quotas and billing are unchanged.

## Authorization and lifetime

The bootstrap endpoint issues a server-only creation credential, prewarms one session, then returns an HMAC-signed credential restricted to that exact session and its selected allowed model. Every guest channel read and mutation checks the signature, deadline, session ID and operation allowlist. The credential never appears in a URL or cookie. A session ID alone cannot read, send, cancel or retire that session. Creation, forks, arbitrary model overrides, files, tools, callbacks, checkpoints and application APIs are not authorized by browser guest credentials.

Credentials expire one hour after bootstrap. EVE has a one-hour session timeout; an active turn is allowed to settle, and upstream deployment handoff can restart the runtime timeout. The browser attempts terminal reset on pagehide and New chat, but delivery on unload is best effort. The runtime timeout handles abandoned sessions even when no unload request arrives.

The guest agent sets `experimental.workflow.retention: 0`. This requests deletion of session run payloads and stream chunks after completion/failure, including successor session runs. It does not promise immediate deletion on reload or erase all provider metadata. EVE's timeout/background workflows use provider-default retention; model-provider logs and tracing have their own policies. Custom Worlds may ignore the retention setting. Do not describe this mode as zero-retention. Legacy Postgres guest cleanup remains available for previously stored guest data; new disposable sessions do not use that pipeline.

## Verification

Run `bunx playwright test --config playwright.guest.config.ts` from `apps/chat` against the normal running application. Tests use an unauthenticated browser and cover real replies, session authorization, no browser persistence, reload, New Chat and back navigation. Unit tests cover credential forgery, expiry, operation restrictions, bootstrap failures and registered principal resolution.
