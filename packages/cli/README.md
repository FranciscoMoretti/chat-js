# @chat-js/cli

CLI to scaffold and extend ChatJS apps.

## Usage

```bash
npx @chat-js/cli@latest
```

Or with the command alias:

```bash
npx @chat-js/cli@latest create
```

After install, the binary is:

- `chat-js`

Choose the existing app's gateway interactively, or pass a built-in name,
external registry item URL, or local JSON path:

```sh
chat-js create my-chat --gateway vercel
chat-js create my-chat --gateway https://example.com/r/acme-gateway.json
chat-js create my-chat --gateway ./acme-gateway.json
```

The CLI installs only that item's adapter files and declared dependencies.
`@chat-js/gateways` supplies shared contracts and utilities, with no gateway
implementations. Third-party items declare their own ID, defaults, capabilities,
and credentials; the CLI has no fixed gateway enum. See
[gateway authoring](https://github.com/FranciscoMoretti/chat-js/blob/main/packages/registry/src/gateways/README.md) for the version 1 contract.

Run `bun --filter @chat-js/cli test:gateways` from the repository root to verify
independent installs of all built-ins and an external registry gateway.

## Installation and migration

The CLI uses unmodified shadcn 4.21.0 for registry resolution and installation.
New apps use the invoking package manager, with Bun as the fallback. Existing
apps use their standard package metadata and lockfiles. Dependencies install
immediately. `--no-install`, `--package-manager`, and `--registry` are removed.
Configure registry namespaces in `components.json` instead:

```json
{ "registries": { "@acme": "https://example.com/r/{name}.json" } }
```

```sh
chat-js add @acme/my-tool --yes
chat-js add word-count --overwrite
chat-js sync
```

Tools install under `tools/chatjs`; `paths.tools` is no longer configuration.
Generated server/client indexes merge user-owned `custom-tools.ts` and
`custom-ui.ts`. Known legacy built-in indexes are migrated automatically. For
customized legacy indexes, move registrations into the custom modules and remove
the old indexes before syncing. Tool source remains yours to edit. Missing
descriptors and manually edited generated indexes cause an actionable error.

Direct shadcn tool installation requires `chat-js sync` afterward. A gateway is
selected during creation; this release does not replace gateways in existing apps.
For `create --from-git`, a recognized ChatJS clone receives the selected gateway
in its existing slot and a new configuration. Unsupported clones are left without
ChatJS installation. Registry/package installation is not transactional; repair a
partial tool installation and rerun `chat-js sync`.
