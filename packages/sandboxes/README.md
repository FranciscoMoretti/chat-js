# @chat-js/sandboxes

Shared sandbox infrastructure contracts and lifecycle coordination for ChatJS.

Sandboxes are optional. An app that installs sandbox infrastructure selects one provider, independently of its tools. Built-in Vercel and Daytona implementations live in `packages/registry/src/sandboxes/`; the CLI installs the selected implementation into `lib/sandbox/`.

- `@chat-js/sandboxes/provider`: `SandboxProvider`, command-oriented `Sandbox`, non-secret `SandboxScope`, and consumer-owned `SandboxOwnership` contracts.
- `@chat-js/sandboxes/runtime`: `withSandbox(provider, options, execute)` reserves a durable allocation before creation, records creation before executing, and releases ownership only after confirmed deletion. Execution has a five-minute deadline. Cancellation requests deletion.
- `@chat-js/sandboxes/definition`: versioned registry metadata, Python and JavaScript capabilities, and environment requirements.

The package owns no database, SDK credentials, tool registration, UI or usage billing. Consumers supply durable ownership callbacks. ChatJS implements these through EVE and uses the same provider for execution and conversation-deletion cleanup.

Creation failures can leave uncertain allocations. Their intents survive for reconciliation. Cleanup failures also retain ownership. A missing resource alone does not prove that an uncertain creation cannot still complete. Drain allocations before switching providers or rotating credentials; historical cleanup fails closed when the configured scope differs.

```bash
bunx @chat-js/cli add --sandbox-provider daytona
bunx @chat-js/cli add code-execution
```

The first command installs infrastructure without a model tool. The second installs a consumer. Both can be combined in one command. Replace an existing provider using `--sandbox-provider vercel --replace`.

This layout targets newly scaffolded apps. Earlier generated apps and allocation identities are not supported. Provider IDs, accounts and deployment scopes all participate in allocation identity.

## Persistent conversation filesystems

`@chat-js/sandboxes/persistent` adds an optional `SandboxProvider.persistent` capability. It supports explicit creation, opening an existing resource, stopping while preserving files, and deletion with confirmed absence. It includes filesystem and process operations for consumers such as EVE. Disposable `withSandbox` execution remains separate and deletes its resources after use.

ChatJS always uses the installed app provider for EVE persistent filesystems. The Vercel implementation supplies this capability; Daytona currently does not. There is no native-provider selector or compatibility mode. Use a fresh world and the current schema; existing native bindings are not migrated. Copies receive fresh sandboxes.

ChatJS owns session/resource records and checks the original provider, account, scope, and owner before access. Retirement fences cached handles as well as new opens. An interrupted create remains pending and cannot be automatically recreated or considered deleted. Pending allocations require reconciliation; changing providers does not transfer ownership.

Persistent operations use a dedicated pool of two database connections per server process and serialize within each root conversation. They can queue across conversations when both connections are busy. The Vercel adapter bounds provider calls to 30 seconds; initialization shares one 30-second budget across creation and all file writes. Detached output streams expire 30 seconds after spawning, and each process wait is bounded to 30 seconds. Long-running detached process streaming and large initial workspaces that exceed that budget are unsupported. A timeout does not prove that a remote allocation or process stopped; uncertain initialization requires reconciliation. These bounds keep remote operations from indefinitely holding retirement locks.

In development, ChatJS requires `bun dev:supervise`; generated apps include a `dev:supervise` script runnable with their selected package manager. The supervisor stops only its run's resources after terminating workers. Stop preserves files, not running processes. Failed cleanup retains its local intent. If the supervisor exits without confirmed worker termination, the next launch blocks: stop the orphan workers and reconcile the retained intent before restarting. Automatic recovery after a supervisor crash is not supported. Persistent resource cleanup participates in the existing local PostgreSQL conversation-deletion flow; managed-world deletion remains unavailable.

Distribution requires a version of this package containing the new `persistent` export before publishing the updated registry or scaffolding template. The changeset prepares that release; it does not publish it.
