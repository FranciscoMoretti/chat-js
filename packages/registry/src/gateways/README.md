# Gateway registry

Gateway items use the shadcn `registry-item.json` format. ChatJS reads
`meta.chatjs` to select the adapter and configure the existing app during creation.
The ChatJS CLI performs this activation; running shadcn's file installer alone
does not configure `chat.config.ts`.

```sh
chat-js create my-chat --gateway vercel
chat-js create my-chat --gateway https://example.com/r/acme-gateway.json
chat-js create my-chat --gateway ./acme-gateway.json
```

Without `--gateway`, the interactive CLI offers the bundled gateway items.
`--yes` selects Vercel. Use standard namespaces in `components.json` for external
registries, or pass a complete item URL/local JSON path.

Run `bun --filter @chat-js/registry build` to generate `dist/r/*.json` from the
real adapter source files. The CLI reads those standard artifacts through shadcn.
There is no offline adapter bundle or custom registry resolver.

## Author an item

Use a built item as a starting point. Declare:

- `type: "registry:item"`, a name, and `files` with source paths and explicit targets.
  shadcn build embeds the source content in the published JSON.
- `dependencies` / `devDependencies`: npm names with optional versions.
- `registryDependencies`: standard shadcn addresses to supporting registry items.
  Use namespace addresses or absolute URLs for portable dependencies.
- A file targeting `~/lib/ai/gateway.ts`, exporting a `Gateway` constructor.
  Supporting files live under `~/lib/ai/gateway/`.
- `meta.chatjs`: `kind: "gateway"`, `contractVersion: 1`, a unique literal `id`,
  `capabilities: { image, video }`, `defaults`, and `envRequirements`.

Each environment requirement has `options: string[][]`: outer entries are
alternatives, and every variable within one alternative is required. Separate
requirements must all be satisfied. `optionalEnv` declares optional variables
that the adapter also needs. The app passes only these declared variables to it.

`defaults` contains provider order, model lists, workflow models and tool defaults;
its complete validated shape is exported as `GatewayDefinition` from
`@chat-js/gateways/definition`. The installer writes selected defaults with
`satisfies GatewayModelDefaults<InstanceType<typeof Gateway>>` so the generated
app checks them against the actual adapter, not a list of known gateway names.

An item can instead install a tiny entry file importing `Gateway` from an author's
npm package and list that package in `dependencies`. No ChatJS CLI change is
needed for a new gateway ID. Registry dependencies may contain supporting files. ChatJS checks the root
item's contract and gateway slot, while shadcn owns dependency resolution and
existing-file behavior. Type-check the installed app to verify the adapter and
configuration agree. There is no general compatibility solver.

The registry supplies files and dependencies; it does not execute installation
hooks. Standard package-manager behavior still applies when dependencies install.

## Verify

Type-check an independently installed generated app, including its generated
config. Test model creation and discovery through `GatewayProvider` with injected
fixtures. The integration suite in `packages/cli/test/gateway-selection.test.ts`
uses an HTTP registry with an unknown `acme` gateway and a separate adapter item.
No paid provider credentials are required for these tests.

ChatJS integration rejects symlinked configuration output paths during preflight.
Source installation uses shadcn's own destination checks.
These checks protect against symlinks already present in a cloned app. They are
not an atomic filesystem sandbox against processes concurrently modifying the
same destination with the user's permissions.
