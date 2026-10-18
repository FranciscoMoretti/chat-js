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
