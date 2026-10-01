# Optional web installation contracts (stage A)

Stage A of [#485](https://github.com/FranciscoMoretti/chat-js/issues/485), tracked in [#486](https://github.com/FranciscoMoretti/chat-js/issues/486), establishes these contracts. It preserves existing runtime behavior. B–H own implementation moves, new registrations, prompts, flag removal, and final regeneration.

## Selection and planning

`packages/registry/installation.ts` exports `installationSelectionSchema`, `InstallationSelection`, and `demoInstallation`. Selections contain registry item names or standard shadcn addresses, never presence flags:

```ts
{
  gateway: "vercel",                    // optional for add
  storage: { source: "vercel-blob", options: {} },
  tools: ["text-documents", "tavily-search"],
  features: ["mcp"],
}
```

`tools` and `features` default to empty arrays. Omitted gateway/storage means no request for that provider. Storage options remain user configuration and are not credentials. Parallel responses and follow-up suggestions stay core configuration; Electron and dependency optimization are outside this selection.

`packages/cli/src/utils/installation-plan.ts::planInstallation(cwd, selection)` resolves registry dependencies before writes, merges requested tool/feature metadata with installed descriptors, and validates tool requirements, document kinds, registration keys, and exclusive provider slots. Gateway and storage each have one slot in the resolved request graph; tool slots remain those in `toolDefinitionSchema`. A conflicting provider fails before installation. A does not implement replacing an installed provider; G owns explicit replacement.

The result is `{ selection, sources, expected, features }`: `sources` goes to the existing shadcn `installItems`; `expected` goes to `syncTools`; `features` contains requested/transitive feature descriptors (not all installed features). Create uses the full selection; add puts its unclassified addresses in `tools` and lets registry metadata identify tools/features, preserving the existing command. Registry items without ChatJS metadata may remain shadcn dependencies.

`packages/registry/metadata.ts` exports `FeatureDefinition` and `featureIdSchema`. Supported boundaries are `mcp`, `attachment-uploads`, `vercel-analytics`, `vercel-speed-insights`, and `langfuse`. Feature descriptors retain `{ contractVersion: 1, kind: "feature", id }` and may declare `requiresFeatures` and `envRequirements`. All listed feature requirements must exist in the resulting installation; shadcn `registryDependencies` carries source installation dependencies. Dependency cycles are visited once. Optional fields do not alter existing descriptors. Only MCP has runtime sync wiring today; recognizing a feature descriptor does not implement its integrations.

The demo preset records currently available implementations. C extends it with D/E items once published, including all three observability integrations to preserve demo behavior. G must default all three observability selections off for new apps and implements the grouped prompt. A does not apply the preset to the demo or create commands.

## Concrete runtime interfaces

`apps/chat/lib/installation-contracts.ts` is core source copied into scaffolds. It exports direct types, with no discovery/runtime plugin layer:

| Export | Integration and owner |
| --- | --- |
| `InstalledRouters` | Generated `features/installed-routers.ts` uses `satisfies InstalledRouters`. B moves MCP source; `trpc/routers/_app.ts` continues spreading this map. Core names `credits`, `eve`, `project`, `settings` are reserved. Keep inference by using `satisfies`, not a map annotation. |
| `FeatureUiContribution` | Composer controls and settings items reuse the existing `ComposerControl`/`SettingsItem` types. B/C retain editable `composer-controls.ts` and `settings-items.ts`, with create/add defaults and sync preserving user order. |
| `AttachmentUploadState` | Core passes persisted `DraftAttachment[]` and its setter. |
| `AttachmentUploadBehavior` | D returns state plus `upload(File[]): Promise<void>` and `uploadQueue: string[]`, matching current upload behavior. |
| `AttachmentUploadIntegration` | D supplies `useUploads(state)` and composer `controls`; call the chosen hook unconditionally. D owns picker/camera/paste/drop/preprocessing and upload route; historical display/download, file ownership/storage/lifecycle, and tool output remain core. |
| `InstalledLayoutComponent` | E supplies no-prop components; user-owned layout decides placement. Generated registrations must use type-only contracts and import only installed implementations. |
| `InstrumentationRegistration` | E supplies `(context: { appPrefix: string; runtime: string | undefined }) => void | Promise<void>`. The composition awaits each installed registration; core EVE initialization/logging/errors run independently. No framework-specific exporter abstraction. |

D/E own the generated attachment/layout/instrumentation registration files and consumer wiring; C syncs those files into the demo after the implementations exist. There are no empty runtime adapters or unconditional future imports in A.

## Required credentials

`apps/chat/lib/required-credentials.ts` exports `requireCredentials(integration, requirements, env)` and `MissingCredentialsError`. Use it at the installed integration's first server entry point before external I/O. It reuses `EnvRequirement` and existing satisfaction rules: each requirement is required, `options` are alternatives of complete key sets, `allOf` requires all subgroups, and Vercel OIDC runtime auth is accepted when declared.

Failure has `name: "MissingCredentialsError"`, `code: "CHATJS_MISSING_CREDENTIALS"`, `integration`, `requirements` (only the unsatisfied groups), and a readable message listing required key names. Never pass credential values as descriptor descriptions or include values in errors. Missing required credentials must fail explicitly; optional parameters can supply defaults. Existing integrations are not migrated in A; E adopts this contract for Langfuse and B/D use it wherever their required credentials enter.

## Source and file ownership

- Canonical optional implementations and descriptors: `packages/registry/src`. B moves MCP out of `apps/chat` (the current exception); D/E add their source here. Registry descriptors, not a second manifest, identify installed source.
- Core source: `apps/chat`, including contracts, file lifecycle and configurable follow-up suggestions/parallel responses. Optional copied source in the demo is a selected consumer once C lands.
- Generated registrations: `tools/chatjs` generated indexes and `features/installed*.ts`; `sync-tools` and `sync-features` own them. Keep the existing tool content checks and custom registration escape hatches.
- User-owned composition/configuration: `composer-controls.ts`, `settings-items.ts`, layouts, `chat.config.ts`, storage options, and `custom-tools.ts`/`custom-ui.ts`. Sync does not reset user composition. Create initializes defaults; add inserts supported contributions idempotently.
- B owns MCP source and its sync changes. C owns demo preset consumption, explicit demo sync, and full-source drift checks. D/E own their integration wiring. F then G own shared config schema and CLI files; coordinate any common changes there. H owns final regeneration and cross-feature verification.

Lifecycle is creation and add. There is no managed removal/upgrade API, backward compatibility layer, migration, or test-declaration framework. Existing feature flags remain until their assigned stages remove them.
