# @chat-js/registry

Published ChatJS registry artifacts and authoring types.

The package is distributed through npm. The CLI consumes the published
`items/*.json` manifests from the package contents via the default npm-backed
registry URL, so there is no separate registry deploy step.

This package contains:

- `index.json` with the registry index
- `items/*.json` with generated registry tool manifests
- `ToolEnvVars` for typing static `toolEnvVars` exports in `tool.ts`

The repository root also exposes a shadcn-compatible source registry for
reusable hooks and components. For example:

```bash
bunx shadcn@latest add FranciscoMoretti/chat-js/thread#main
```

The source registry is declared in `/registry.json` and is intentionally
separate from the ChatJS CLI tool manifests in this package.
