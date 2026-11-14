# EVE agent, ChatJS application

This is the implementation contract for the native-agent simplification. It supersedes the runtime-adapter recommendations in the earlier EVE research documents. Those documents remain historical research, not instructions to recreate removed adapters.

## Ownership

EVE discovers and executes the agent's native files: tools, connections, instructions, skills, subagents, memory, schedules, sessions, approvals, authentication mechanisms, and channels. Developers can add capabilities using `eve add` and edit those files directly. A capability does not require a ChatJS manifest, session profile, conversation reservation, or setup receipt to execute.

The Agent tab installs capabilities through EVE registry addresses, including `@skills`, named third-party registries, and HTTPS item URLs. It does not expose model or advanced settings, author instructions or skills, or generate Planner/Reviewer presets. Developers edit native instructions in generated source. Source labels identify EVE catalog, skills.sh, ChatJS, or a third-party registry independently of application dependencies. Portable ChatJS tools use the native ChatJS registry and do not require ChatJS application services. Application features retain their own resource checks and a separate “Requires ChatJS” label.

ChatJS assembles and presents the application: builder choices, web authentication, chat UI, projects, documents, optional billing, and deployment. The web channel authenticates the application user and binds application operations to that user. This authentication boundary remains mandatory for private web resources.

The builder emits `agent/agent.ts` and native capability files. Its serializable form/recipe schema is an installation input, not a second runtime configuration. Subsequent ChatJS sync preserves authored agent files. Web model choices live in `integrations/chat/models.ts`; ordinary native callers use the authored EVE model without the web picker or billing ledger.

## What remains

- Native EVE channels, connection consent, approval handling, and execution.
- ChatJS web authentication, conversation/branch presentation, activity projection, and resource ownership checks.
- ChatJS tools for application features, with checks at the resource they access.
- Native result and pending-input rendering in the web UI, including connection sign-in prompts.
- Deployment glue for the existing Next.js mount and workflow environment.

The `applicationModel` helper applies model selection, availability, and optional accounting to authenticated web sessions. Native channel callers return the authored model directly. Core application hooks return before loading application billing or resource services for native callers. Optional database-backed plugins still require their application database configuration at compilation. Reserved `chatjs-*` identities still require their installed application policy, so removing a guest policy cannot grant account capabilities.

For protected Vercel deployments, the application authenticates its same-deployment EVE requests with the current invocation's project OIDC identity. It does not require an automation bypass secret or forward project identity to a separate worker.

## What is optional

- **Billing:** applies to the web application when installed. Replay and deletion skip tool accounting when billing is absent, while descendant ownership registration remains active. Ordinary native tools are unmetered by ChatJS; tools opt into application charges by returning `chatjs.tool-result` receipts. This does not imply that their providers are free. Model accounting uses EVE's native session, parent, and committed turn context, without separate ChatJS lifecycle state. Billing is not a prerequisite for Slack or ordinary native integrations.
- **Slack documents:** `slack-documents` adds ChatJS storage, workspace/conversation isolation, current-caller authorization, and document rendering. It does not replace the native channel. Configure `CHATJS_SLACK_DOCUMENTS` only when installing this application feature.
- **Native memory:** select providers directly from EVE’s catalog, using their native storage, identity scopes, and retention semantics. Deleting conversation-derived memory is required only where the selected native provider supports it. ChatJS does not implement a custom provider or impose that guarantee on every provider.
- **Application code execution:** optional disposable code-execution tools retain their resource authorization and cleanup. They do not configure the agent sandbox. The agent always uses EVE’s native sandbox environment, including when these tools are installed. Uploads require application storage, without an application sandbox provider.
- **User-managed MCP settings:** remain an optional application feature. EVE registry connections do not depend on those settings or their OAuth storage.

## What was removed

The runtime `AgentSettings`/`agent.config.ts` translation layer, mandatory session-profile registration for native callers, custom Notion web/conversation restrictions, connection setup fingerprints and receipt gates, the bespoke Slack channel/credential wrapper, and mandatory Slack budgets/accounting were removed. The unused Slack usage table has a removal migration. The custom persistent agent sandbox, restoration catalog, development cleanup supervisor hooks, sandbox session registration, and persistent sandbox provider implementation were also removed. Migration `0026_loving_mesmero.sql` drops the three unused application sandbox/restoration tables. No remote database migration is part of this change.

The Agent builder reads the official EVE registry at `https://eve.dev/r/registry.json`, with an hourly cache and explicit loading/retry states. The Agent tab renders all entries in category sections using the same layout as Setup. Native identifiers supply categories; descriptions, environment requirements, setup availability and runtime requirements come from registry metadata. Hidden upstream entries remain hidden. Selection records only native item identifiers in `eve`, not another runtime configuration.

Fresh generation runs the generated application's installed `eve add <item> --skip-setup --non-interactive` for each selected capability. It records installed native source and frozen dependencies for recipe replay without consulting the registry again, and writes `chatjs/eve-setup.md` with native setup continuations. No accounts or infrastructure are provisioned by this step. The former ChatJS Notion/Slack registry wrappers are removed; the reference application's native channel/connection files are app-owned.

ChatJS application capabilities retain their own source labels and resource checks. Native memory providers keep their own retention semantics. The custom ChatJS personal-memory provider, its database tables and deletion logic have been removed. EVE's Web Chat frontend replacement is shown with a manual-composition explanation instead of installing a second frontend over ChatJS. Other native installer conflicts and runtime requirements remain EVE's responsibility.

`chat-js setup` reports application configuration; it does not certify native consent or replace EVE setup.

## Resource policies versus framework limitations

| Concern | Boundary or limitation |
| --- | --- |
| Private web documents and files | ChatJS policy: authenticated owner and conversation scope remain required. |
| Shared Slack documents | Optional ChatJS policy: authorized current caller, workspace and conversation scope; no private web-file references. Child-session document access remains denied. |
| Ordinary Notion or other native connections | EVE authentication/current-caller behavior; no private web conversation requirement. |
| Optional billing | Unmarked native tool outputs do not create application charges or unresolved ledger entries. Explicit application receipts with missing or malformed costs remain unresolved. Model usage is still accounted for; a missing provider cost is unknown, while an explicit zero is valid. This is ChatJS billing policy, not an EVE requirement. |
| Basic Slack | Native channel behavior; no web-account linking, application quota, or document reservation requirement. |
| Agent sandbox | EVE owns the single exported environment and its lifecycle. Sessions have separate native sandboxes; declared children may inherit their parent’s sandbox. Forks no longer share a ChatJS-managed filesystem. Native provider loss/recreation follows EVE behavior, without ChatJS restoration. |
| Multiple Slack workspaces | **Not verified/supported by this change.** The pinned EVE Slack thread address lacks workspace identity and Connect 2.9.2 does not select an installation from `teamId`. Framework routing/token selection must be fixed or upgraded and verified before enabling multiple workspaces. The optional document plugin prevents cross-workspace document access but cannot repair native session-history isolation. |
| Scheduled runs | Native schedules work within the framework's authentication and interaction constraints. A run without an interactive caller cannot complete human consent by itself. |
| Native file memory | Requires an appropriate backend and scope. Deleting a ChatJS conversation does not by itself establish deletion of entries managed by an unrelated provider. |
| Subagents | Native declared subagents have their own configuration; root hooks and capabilities are not automatically inherited. |

## Uploaded originals and sandbox lifecycle

The web channel authenticates a ChatJS account, verifies original-file ownership, and returns stored bytes to EVE. EVE stages those bytes in its own sandbox. ChatJS no longer records native sandbox paths or restores an original when the agent changes a staged file. Original downloads still read application storage, independently of mutations to the sandbox copy.

Conversation references retain original uploads for surviving conversations. Deleting a conversation removes its exclusive original files after session retirement, preserving references used by other conversations. Empty workspace metadata still requires owner authorization, retired conversations, and no pending application operation; it no longer requires native sessions to register in a ChatJS sandbox table.

Session termination delegates native sandbox cleanup to EVE. After submitting the native end command, ChatJS follows the session stream until `session.ended` before erasing app resources. The pinned client's end-delivery reader uses a non-following stream and can finish before that terminal event is written; it is not sufficient as retirement evidence. EVE’s documented lifecycle does not promise cleanup of sandboxes reopened by still-running child steps after session end, or resources from a previous provider after a provider change. ChatJS does not add a parallel sandbox cleanup service or claim stronger guarantees.

## Verification and remaining acceptance

See [deployed verification](./eve-deployment-verification.md) for the isolated Vercel run, native connection consent status, the deployment authentication fix, and the managed-deletion and creation-recovery gaps it exposed. The local-provider acceptance below does not establish that the application deletion coordinator supports managed Vercel Workflow.

The automated standalone generation scenario installs the official `tool/web_fetch` using `eve add`, checks that ChatJS sync preserves its source, and type-checks the resulting application. It also verifies registry-installed skills, Slack and Notion files, and offline replay of the original builder recipe. Later hand-authored or CLI-added files are project source, not retroactively part of that frozen recipe.

App tests cover native callers without application model/accounting adapters, web model restrictions, guest policy, and document isolation. Registry and builder tests cover optional assembly and the native setup copy. Browser captures cover builder layout and native connection prompts.

EVE compilation also passes for the generated selection and for a minimal application with the official Slack channel added. The latter compiles without ChatJS `DATABASE_URL` configured; EVE persistence is configured separately.

The generated billing-free application also passed live browser acceptance with the official `web_fetch`, approval and denial, an owned PDF upload, native file writes and reads across a full server restart, and conversation deletion including the uploaded original. That run used local PostgreSQL, disposable MinIO, the native `JustBashSandbox`, and a live model through AI Gateway. It also verified that billing-free execution creates no usage ledger records.

A separately generated billing-enabled application passed the same live flow using native `VercelSandbox`, including an explicit cloud sandbox stop, an app restart, successful file recovery on resume, and EVE's cloud sandbox deletion at session end. Model receipts settled without native tool charges or duplicate retirement debits. AI Gateway reported zero model cost in this run; positive debits, per-turn rounding, unknown costs, and replay idempotency were verified separately by the PostgreSQL contract suite against a disposable local database.

These checks do not prove live provider consent, live Slack delivery, or multiworkspace routing. Slack verification is deferred by user choice. Native integration setup still requires the provider credentials and infrastructure documented by EVE. The acceptance rule is that no new ChatJS adapter is needed, not that all integrations work without their own setup.

References: [EVE authoring](https://github.com/vercel/eve/blob/main/docs/README.md), [EVE CLI](https://github.com/vercel/eve/blob/main/docs/reference/cli.md), [Slack](https://eve.dev/docs/channels/slack), [Connect with EVE](https://vercel.com/docs/connect/frameworks/eve), [native file memory](https://eve.dev/docs/memory/file).

### Opt-in generated-app runtime acceptance

Generate a disposable fixture with the actual CLIs:

```sh
CHATJS_NATIVE_SCENARIO=acceptance CHATJS_KEEP_NATIVE_FIXTURE=1 \
  bun run --cwd packages/cli test:native-create
```

Then, from the repository root, run the harness against the printed fixture path:

```sh
CHATJS_NATIVE_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
  bun packages/cli/test/native-agent-acceptance.ts /tmp/chatjs-native-create-XXXXXX/app
```

The harness requires `AI_GATEWAY_API_KEY` (Bun loads the root `.env.local`), local PostgreSQL with database-creation permission, Docker, and Playwright Chromium. `CHATJS_MINIO_IMAGE` can select an available MinIO image. It creates and removes its own database and MinIO container, without using application storage credentials or remote databases. The fixture uses EVE's documented `JustBashSandbox` to avoid provisioning cloud compute; this does not exercise Vercel Sandbox infrastructure.

The browser flow exercises official `web_fetch` approval, an owned PDF upload, native file tools, server restart, denial, and deletion. Logs, native events, screenshots, and a success report are written beside the generated app in `acceptance/`. Run it only on a disposable fixture: it changes that fixture's sandbox provider and local storage endpoint. The live model calls incur provider usage.

To include application billing, add `CHATJS_NATIVE_BILLING=1` to the generation command. The harness seeds credits only in its disposable local database, checks model receipt settlement and balance arithmetic, verifies native tools create no tool charges, and checks retirement does not debit twice. Every native turn must complete successfully, including the model response after approval.

To exercise cloud sandbox infrastructure, use a fresh development environment file for the intended Vercel project:

```sh
CHATJS_NATIVE_SANDBOX=vercel \
CHATJS_NATIVE_POSTGRES_URL=postgresql://postgres:postgres@127.0.0.1:5432/postgres \
  bun --env-file /path/to/development.env packages/cli/test/native-agent-acceptance.ts \
  /tmp/chatjs-native-create-XXXXXX/app
```

Cloud mode requires a fresh `VERCEL_OIDC_TOKEN` with its project/team claims. It configures the native `VercelSandbox` environment, verifies creation, stops the sandbox, restarts the app, verifies the native file survives resume, and checks EVE deletes the sandbox on session end. Cleanup targets only resources bearing this run's unique tag. The application database and upload storage remain local; this does not deploy an application or migrate a remote database. Cloud sandbox usage can incur charges.
