# Composition and distribution research

Research date: 2026-09-05. Planning evidence, not an implementation commitment. Local checkout: `8422c767f30a7586beb5d511ef12e88b1a29e845`. Eve source inspected at `e6037391160b493e395f46a226878fc81ae1a1c0`. Online documentation is moving; verify versions when implementation begins.

## What the evidence supports

ChatJS can plausibly become a framework whose runtime contracts are versioned packages and whose customizable application surfaces are installed source. Standard shadcn distribution already covers considerably more than UI primitives. The hard ChatJS-specific work is deciding the composition contract, capability requirements, source ownership and compatibility rules. A second registry transport is unlikely to be the differentiator. This is an inference from the source and documentation below, not a settled product decision.

User direction carried into this research: new-app-first onboarding with an architecture that permits existing-app adoption; Eve as the default behind an explicit boundary; retain the Next application and prove a second host before claiming broader support.

## What shadcn already offers

The current CLI supports initializing an existing project or creating one with a name, framework template and preset. `create` aliases `init`. `add` accepts named, URL and local items, installs dependencies, and offers dry-run, diff and overwrite controls. Overwrite defaults to false. Presets can also be applied to existing projects, including theme/font-only changes. These facts provide a close precedent for initial composition and later extension; they do not establish an application-layout migration engine. [CLI reference](https://ui.shadcn.com/docs/cli)

The stable programmatic surface includes registry resolution/installation and preset encoding/decoding. `addRegistryItems` accepts configuration explicitly; it does not discover project configuration itself. Universal item graphs can work with registry-only configuration, while ordinary UI graphs require resolved aliases and project paths. Presets encode visual configuration into a short URL-safe code. ChatJS can reuse those APIs while defining a separate, versioned application recipe for capabilities/layout/runtime choices. The latter is a proposed extension, not a feature currently provided by shadcn presets. [Programmatic API](https://ui.shadcn.com/docs/registry/api-reference)

Registry items can declare npm dependencies and registry dependencies. File targets can explicitly place config/routes or use aliases such as `@components/`, `@ui/`, `@lib/` and `@hooks/`. `~` means project root. This is enough to ship a conventional layout file. It does not answer whether replacing that file preserves user edits or whether its current imported components remain needed. The item schema's `meta` allows custom metadata, but distribution metadata must not be mistaken for an enforced runtime protocol. [Item schema](https://ui.shadcn.com/docs/registry/registry-item-json)

Namespaces provide external registry addresses and allow dependencies across configured sources. Every namespace in the resolved graph must be known to the installer. Public GitHub repositories can also act as registries. This lowers the contribution barrier: providers can own their adapters without ChatJS merging their implementation. [Namespaces](https://ui.shadcn.com/docs/registry/namespace), [Registry setup](https://ui.shadcn.com/docs/registry/getting-started)

GitHub item references can be pinned to tags or full commit SHAs. Dependency references need their own pin; pinning a parent does not automatically pin its children. Therefore a shareable builder recipe needs to distinguish a reproducible composition from a request for latest components. [GitHub registries](https://ui.shadcn.com/docs/registry/github)

Shadcn intentionally hands developers editable source. That philosophy supports user-owned layouts and renderers, but creates an upgrade responsibility. A file-address convention tells a CLI where to write; it cannot alone determine whether a customized layout is safe to replace. A useful ChatJS product policy would distinguish generated artifacts, editable installed source and versioned runtime dependencies. This policy is a recommendation derived from open-code ownership, not an existing shadcn automatic merge guarantee. [Shadcn introduction](https://ui.shadcn.com/docs)

## Eve interoperability

Eve's `add` accepts official items, configured namespaced items and URLs. It can expose separately selectable components within a product integration. Its CLI stores added registry mappings in `package.json#registries`; universal items with explicit targets need no shadcn project configuration. It also adds setup flows and resumable setup behavior on top of file installation. Plain shadcn installation should not be assumed to reproduce those Eve-specific setup steps. [Eve CLI documentation](https://github.com/vercel/eve/blob/main/docs/reference/cli.md)

Source inspection confirms that Eve imports `addRegistryItems` from its compiled shadcn registry module and passes item address, registry config, application root and overwrite setting. Its own installation path wraps this with transaction/setup behavior. This means interoperable JSON/source distribution is real, rather than merely similar vocabulary. It also means ChatJS should explicitly reconcile namespace configuration locations and distinguish portable file installation from Eve-specific orchestration. [Eve registry command source](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/cli/commands/registry.ts), [Eve project registry configuration](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/cli/commands/registry-project.ts)

A candidate distribution shape is a backend item, a frontend companion item and a combined convenience item depending on both. It supports the requested paired MVP and leaves backend-only installation possible later. However, declaring JSON dependencies only copies a graph of files: a shared tool identity, serialized input/output contract, rendering states and registration discovery still need ChatJS conventions. Third-party Eve tools cannot automatically acquire a purpose-built ChatJS UI merely by using the same installer. This is architectural inference.

## Current ChatJS foundations and gaps

| Existing source | Foundation | Limitation relevant to this effort |
| --- | --- | --- |
| [CLI create](../../packages/cli/src/commands/create.ts) | Prompts for gateway, storage, tools, authentication, core features, document types and Electron; assembles configuration | Template-first process; no common website/CLI application recipe found |
| [Registry schema](../../packages/cli/src/registry/schema.ts) and [resolver](../../packages/cli/src/registry/resolve.ts) | Files, package dependencies and transitive named item dependencies | Custom ChatJS file types/schema; resolves dependencies through one selected registry template |
| [Registry fetcher](../../packages/cli/src/registry/fetch.ts) | Alternative registry URL and local sources already supported | Not evidence of shadcn namespaces or interoperable universal registry items |
| [Injection utility](../../packages/cli/src/utils/inject-tool.ts) | Paired server/UI registrations, repeatable marker-based insertion | Fixed export naming and eager renderer imports; connection requires CLI mutation of both indexes |
| [Renderer types](../../apps/chat/lib/ai/tool-renderer-registry.ts) and [installed tools](../../apps/chat/lib/ai/installed-tools.ts) | Inferred backend input/output becomes typed renderer props | App-specific AI SDK type graph; no external runtime contract version described |
| [Gateway registry](../../apps/chat/lib/ai/gateways/registry.ts) | Types derive from concrete gateway factories | All supported gateways imported centrally; additional schemas/defaults/CLI choices also need edits |
| [Chat layout composition](../../apps/chat/components/chat.tsx) | Main/secondary panels already compose through layout elements | Application-specific layout and props, not a declared installable composition surface |
| [Thread architecture](../../packages/thread/ARCHITECTURE.md) | Framework-neutral core, React adapter, observable state contract, concurrent branching | AI SDK behavioral/transport commitments remain important integration constraints |

The scaffold clears copied registry tools and installs selected ones, a useful existing start. It does not establish that every disabled feature and unused dependency is removed from the complete copied application. [Scaffold](../../packages/cli/src/helpers/scaffold.ts), [package normalization](../../packages/cli/src/helpers/package-manifest.ts)

The site contains a thread playground model. A filename inventory found no dedicated builder/create application surface; this is limited reconnaissance rather than proof of absence. [Thread playground](../../apps/site/components/thread-playground-model.ts)

## What contribution history actually says

**Accepted:** “feat: add LiteLLM gateway provider” was merged. The maintainer documented follow-up work for model endpoint correctness, runtime validation, tests, CLI/env wiring and generated-app smoke testing. Its changed-file list spans provider code, schemas, defaults, docs, CLI and package versions. This is concrete evidence that central registration imposes integration work outside the adapter itself. [LiteLLM maintainer comment](https://github.com/FranciscoMoretti/chat-js/pull/200#issuecomment-4874031876)

**Deferred direction:** “feat(web-search): add SERPdive as a search provider” is closed. The maintainer asked the contributor to hold while a way to support more tools was being developed. This directly aligns with external tool extensibility, without establishing a final extension contract. [SERPdive maintainer comment](https://github.com/FranciscoMoretti/chat-js/pull/259#issuecomment-5077157653)

**Rejected implementation:** “feat: add OrcaRouter gateway” is closed. The closing explanation cites readiness and unverifiable affiliation, plus request-path correctness, bounded validated model discovery, fallback catalog, incomplete CLI registration and unrelated churn. It invites a smaller replacement. It would be inaccurate to describe this as a blanket refusal of external providers. [OrcaRouter closing explanation](https://github.com/FranciscoMoretti/chat-js/pull/273#issuecomment-5413323325)

**Existing exploratory work:** “Move built-in tools to the registry runtime” remains open. Its proposed capability-based tool context is potentially relevant prior art, but must not be described as shipped architecture. Review the actual branch when evaluating reuse. [Open registry-runtime proposal](https://github.com/FranciscoMoretti/chat-js/pull/213)

## Three separate meanings of “only what you need”

| Promise | What would establish it | What does not establish it |
| --- | --- | --- |
| Only chosen feature source/dependencies installed | Resolve selected capability graph and install its transitive requirements | Disabling features in a config after copying a full application |
| Installed heavy UI absent from initial client download | Lazy imports at real renderer/interaction boundaries, verified in produced chunks | Merely marking a module optional in a manifest |
| Unreferenced exports absent from bundles | Bundler dead-code elimination with suitable imports/side-effect declarations | A runtime registry that references every implementation |

React `lazy` defers loading component code until first rendering, commonly using dynamic import and Suspense. Thus an installed PDF editor can be absent from initial loading while still existing in source/dependencies. Its loading/error behavior is part of the component contract. [React lazy](https://react.dev/reference/react/lazy)

Tree shaking removes unused exports based on static module structure and side-effect information; it is a build concern, not an installer feature. This distinction prevents overpromising that lazy loading satisfies the stronger requirement of no unused dependencies. [Webpack tree-shaking guide](https://webpack.js.org/guides/tree-shaking/)

Proposed acceptance examples: a text-only generated app contains no PDF/editor package; installing the PDF capability adds precisely its required graph; opening normal chat does not request the PDF chunk; activating a PDF view loads it. Removal is a separate ownership problem because shared dependencies and user-authored imports may survive removal of an originally installed feature.

## Strong types without central provider enumerations

Current gateway types are inferred from a concrete registry, showing that inference is already useful. A project-local typed composition can import only chosen providers and derive its valid IDs and configuration. Either user-authored composition or build-generated static imports could preserve this property. A global upstream union of every community provider is unnecessary; a finite local compilation graph is still needed. These are candidate approaches, not selected implementation details.

TypeScript `satisfies` validates compatibility without widening away the expression's more specific inferred type. That is useful for preserving literal identifiers and per-provider configuration in locally assembled manifests. It does not validate downloaded JSON at runtime or give compile-time types to arbitrary plugins discovered only after deployment. Runtime-loaded unknown tools require a validated dynamic boundary with weaker static knowledge. [TypeScript satisfies](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)

Keep install/catalog metadata separate from executable definitions: JSON is appropriate for files, dependency addresses and descriptive metadata; TypeScript carries actual factories, schemas and lazy loaders. Runtime validators protect external data; generic APIs preserve relationships inside the compiled project. An optional generated index could connect discovered files while keeping server imports out of client values. This is a hypothesis to test, particularly for Eve type inference and framework-independent code splitting.

## Product decisions worth discussing before tickets

1. Is the builder an initial app generator, a continuing configuration editor, or both? Supporting round-trip editing after users modify source is a materially larger promise.
2. Which parts are editable source versus versioned runtime packages? Candidate split: layouts/renderers/adapters as source, lifecycle/protocol invariants as packages.
3. Does an installable capability mean a single tool, a tool plus renderer, or a feature spanning routes/storage/UI? The catalog needs a human-readable unit while preserving separate dependencies.
4. Does choosing a new layout replace one owned file, generate a proposed diff, or compose a layout from smaller slots? User modification policy should precede an overwrite convention.
5. Does the supported ecosystem guarantee installation, compilation, or tested behavior on named hosts/runtime versions? These are different compatibility claims.
6. Is removal and automatic dependency cleanup part of the first promise, or is the initial guarantee confined to fresh generation and additive installation?
7. How much of a third-party registry is trusted by default, and what is required for an official catalog listing? External ownership reduces merge burden but does not remove API-quality and compatibility needs visible in prior PRs.

The strongest next proof would be one externally hosted capability with a typed Eve backend and lazy React companion, installed into the retained Next app and a second host using the same source contract. Its success criteria should include no unrelated installed dependency, no central upstream provider edit, and an understandable upgrade/layout-change experience. That experiment would test several product promises without committing to an exhaustive framework matrix.
