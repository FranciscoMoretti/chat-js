# Disposable guest chat

Anonymous users get a text-only EVE session inside the shared ChatJS sidebar, header, composer, model picker and message presentation. There is no separate temporary-chat design. Account-only controls retain the existing sign-in gating. The UI stays at `/`; its session ID, transcript projection and signed access credential exist only in browser memory. Reload and New chat start fresh. No guest account, chat history, application session mapping, reservation or quota counter is created. Existing guest cookies no longer authorize application history. Registered users keep the application agent, database ownership, billing and `/chat/<id>` routes.

## Deployment without an application database

Set `CHATJS_GUEST_ONLY=true`, `EVE_GATEWAY_SECRET` (at least 32 random characters), `EVE_INTERNAL_ORIGIN` to this application's origin, and the selected model gateway's credentials. Set `APP_URL` to the public origin on non-Vercel hosts; guest bootstrap fails closed when it is missing. On Vercel, bootstrap uses the configured deployment hostname. `AUTH_SECRET`, `DATABASE_URL` and `WORKFLOW_POSTGRES_URL` are not needed in this mode. Use Node 24+ and Bun. From the repository root:

```sh
bun install
bun dev
```

For production, run the chat application's build and start scripts. The Next.js EVE integration mounts the guest agent at `/eve/guest/v1/*`. On Vercel it uses managed Workflow; locally it uses EVE's local World. Only the guest agent is built in guest-only mode. The standard deployment also mounts the registered agent at `/eve/chat/v1/*`, with `/eve/v1/*` retained as its internal route alias. On Vercel the alias proxies to the deployment's named route so platform routing selects the chat service.

Basic guest mode has no account login, projects, sharing, attachments, tools, comparison branches, saved history, message allowance or spending cap. Deployers can apply hosting-level limits. Registered-user quotas and billing are unchanged.

## Authorization and lifetime

The bootstrap endpoint issues a server-only creation credential, prewarms one session, then returns an HMAC-signed credential restricted to that exact session and its selected allowed model. Every guest channel read and mutation checks the signature, deadline, session ID and operation allowlist. The credential never appears in a URL or cookie. A session ID alone cannot read, send, cancel or retire that session. Creation, forks, arbitrary model overrides, files, tools, callbacks, checkpoints and application APIs are not authorized by browser guest credentials.

Credentials expire one hour after bootstrap. EVE has a one-hour session timeout; an active turn is allowed to settle, and upstream deployment handoff can restart the runtime timeout. The browser attempts terminal reset on pagehide and New chat, but delivery on unload is best effort. The runtime timeout handles abandoned sessions even when no unload request arrives.

The guest agent sets `experimental.workflow.retention: 0`. This requests deletion of session run payloads and stream chunks after completion/failure, including successor session runs. It does not promise immediate deletion on reload or erase all provider metadata. EVE's timeout/background workflows use provider-default retention; model-provider logs and tracing have their own policies. Custom Worlds may ignore the retention setting. Do not describe this mode as zero-retention. Legacy Postgres guest cleanup remains available for previously stored guest data; new disposable sessions do not use that pipeline.

## Verification

Run `bunx playwright test --config playwright.guest.config.ts` from `apps/chat` against the running guest-only app with application and workflow Postgres URLs unset. The live test covers real replies, session authorization, no browser persistence and reload behavior. Unit tests cover credential forgery, expiry, operation restrictions, bootstrap failures and registered principal resolution.

Guest-only mode hides account-dependent actions (sign-in, account settings, unavailable models, attachments, and tools). Standard deployments retain the shared anonymous/account UI.
