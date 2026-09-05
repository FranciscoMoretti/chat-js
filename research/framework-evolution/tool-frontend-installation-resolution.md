# Portable installation of typed Eve tool frontends

Resolution of [Establish a portable installation path for typed Eve tool frontends](https://github.com/FranciscoMoretti/chat-js/issues/284), researched 2026-09-05. This answers feasibility and boundaries, not the human-owned ChatJS contract. No implementation or runtime tests were performed.

## Finding

Supported shadcn registry items can distribute an external Eve backend and a React companion together, with their selected dependencies and explicit destinations. Eve itself uses shadcn's installer. Neither installer automatically establishes ChatJS frontend registration, mounted tool identity, browser-safe inferred types, or UI lifecycle semantics. Those are application contracts still to define and prove.

Evidence pins: shadcn `7c9eaba1c0a6404c990c144a654792e3313c650d`; Eve `e6037391160b493e395f46a226878fc81ae1a1c0`; current ChatJS source reviewed at `8422c767f30a7586beb5d511ef12e88b1a29e845`. This report makes no claim that every released npm version exposes the inspected main-branch APIs.

## Installation surfaces

| Surface | Established behavior | Boundary |
| --- | --- | --- |
| Plain shadcn CLI/API | Resolves registry items and their dependencies; writes files, installs package dependencies, applies declared environment/CSS configuration | Does not execute Eve's custom integration setup orchestration |
| Universal registry graph | `registry:item`/`registry:file` items whose files all specify explicit targets need only registry configuration | Every transitive item must meet the universal condition; ordinary UI items require resolved project aliases/configuration |
| Eve add | Calls shadcn installation, adds Eve package selection, transaction and declared setup handling | Same format does not mean all setup behavior is identical to plain shadcn |
| Eve extension package | Packages backend contributions with typed configuration, a consumer mount and generated compatibility metadata | Extension runtime mounting and source registry installation are distinct operations |

The public `addRegistryItems` API accepts configuration explicitly, throws rather than exits, does not prompt, and skips existing files unless overwrite is enabled. File placement and overwrite do not establish a semantic merge strategy for user-modified sources. [Pinned public API documentation](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/api-reference.mdx)

The schema supports separate npm `dependencies`, `devDependencies`, `registryDependencies`, files and metadata. Explicit destinations are required for `registry:file` and `registry:page`. This is sufficient to describe a paired item or a parent item depending on separate backend/frontend items. It does not make arbitrary metadata executable or invent an optional-dependency selection protocol. [Pinned schema](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/packages/shadcn/src/registry/schema.ts)

Eve's command calls `addRegistryItems` with the selected address, configuration, root and overwrite option inside its own transaction path. Its CLI additionally supports configured addresses, URLs, component selection and integration setup continuations. A portable source item can avoid setup dependence; an item relying on Eve setup must document the additional operation when installed through plain shadcn. [Pinned Eve installer](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/cli/commands/registry.ts), [Pinned CLI documentation](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/reference/cli.md)

## Configuration clarification

The earlier composition note described differing namespace locations. More precisely, shadcn's `getRegistriesConfig` reads `components.json` when present and otherwise reads `package.json#registries`. Eve's registry project code reads/writes the package-level field. Therefore package-only universal projects already have an interoperable configuration path. The issue to settle is divergent mappings when both files exist, not a blanket incompatibility. Custom namespaces throughout a dependency graph must be available in the effective configuration. [Pinned shadcn configuration loader documentation](https://github.com/shadcn-ui/ui/blob/7c9eaba1c0a6404c990c144a654792e3313c650d/apps/v4/content/docs/registry/api-reference.mdx), [Pinned Eve configuration source](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/packages/eve/src/cli/commands/registry-project.ts)

## Identity is not a registry address

An install address identifies a distribution item. Eve names an ordinary authored tool from its file path; an extension consumer chooses a mount name that qualifies contributed tools. The same extension can expose `shared__search` in one agent and `company__search` in another. A renderer keyed only to an author's registry namespace cannot safely assume either runtime name. Consumer overrides can also replace or disable a contribution. [Pinned extensions documentation](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/extensions.md)

Eve supplies a useful backend precedent: published extensions expose tool definitions through a typed `./tools` export, and `toolResultFrom` can narrow a mounted result using the original definition. The documentation says descriptions must remain distinct for unambiguous definition identity. This demonstrates typed mounted-result recognition in consumer hooks; it does **not** establish that importing an executable backend definition into a browser bundle is supported or appropriate. A browser-safe equivalent or projected identity contract needs a proof. [Pinned extension result narrowing](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/extensions.md#use-an-extension-tool-result-in-a-hook)

ChatJS currently derives renderer props from installed AI SDK tool definitions and statically keys UI renderers by `tool-<name>`. Its CLI derives export names and modifies backend and UI indexes together. These are concrete prior seams, not already-compatible Eve mounting behavior. [Pinned renderer types](https://github.com/FranciscoMoretti/chat-js/blob/8422c767f30a7586beb5d511ef12e88b1a29e845/apps/chat/lib/ai/tool-renderer-registry.ts), [Pinned injection utility](https://github.com/FranciscoMoretti/chat-js/blob/8422c767f30a7586beb5d511ef12e88b1a29e845/packages/cli/src/utils/inject-tool.ts)

## Type and serialization boundaries

Eve's Zod/Standard Schema inputs infer executor input types; a plain JSON Schema yields a broader input type. Optional output schemas can type executor returns. Outputs must be JSON-serializable. `toModelOutput` can project a smaller model-facing result while channel events retain full output. Preliminary outputs replace snapshots, and background tools return task receipts rather than their eventual task output. A UI contract must distinguish these payloads and states rather than treating every action as a single final result. [Pinned tool documentation](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/tools/overview.mdx)

Feasible design space, not a selected API: installed source can reference shared types with type-only imports or a browser-safe contract module; generated/static project composition can preserve concrete names and generic relationships. The browser should not import backend executable values just to recover types or identity. Runtime validation remains necessary at serialized boundaries, including historical payloads produced by older tool versions. The research establishes ingredients, not a ready-made Eve React renderer inference API.

## Backend-only, frontend-only and paired installation

- **Backend-only:** an Eve tool or mounted extension can install without React. Whether ChatJS shows a generic activity/result view is a product decision.
- **Frontend-only:** source distribution is possible, but useful execution requires a compatible already-present tool contract and identity. The installer cannot create that compatibility from a name alone.
- **Paired:** one item can contain both source sets or depend on two items, expressing the required initial experience without forcing every tool into a universal React bundle. Exact split, naming and required shared runtime are undecided.

All three are distribution possibilities inferred from the supported schema. They are not a promise that the present ChatJS CLI accepts those item shapes.

## Selected dependencies and lazy loading

An external item graph can express its own file/package requirements without modifying ChatJS's upstream enumeration. However, a graph depending on an oversized shared package still installs that package's declared dependencies. Eve extensions may deliberately package many capabilities together; an installable item boundary does not guarantee per-tool package isolation. Selected-only installation therefore depends on publisher granularity and honest dependency graphs, not just a flag.

React lazy loading can defer an installed renderer until it is first rendered. This limits initial client download, while dependency selection limits what is installed; they are separate guarantees. Current ChatJS generated renderer imports are eager. Build-generated static lazy imports are one feasible route across hosts, but bundler behavior and browser/server isolation must be measured, not asserted from the registry manifest. [React lazy documentation](https://react.dev/reference/react/lazy), [Pinned current UI registry](https://github.com/FranciscoMoretti/chat-js/blob/8422c767f30a7586beb5d511ef12e88b1a29e845/apps/chat/tools/chatjs/ui.ts)

## Minimal later proofs and human questions

Use the existing demo's resolved configuration as the reference. No new flagship application is needed.

1. Install one externally hosted paired capability into that configuration using plain shadcn and Eve add in separate scratch copies; compare effective namespaces, files, dependencies and required setup.
2. Mount the same extension under two names and verify the intended renderer recognizes each call while preserving compile-time payload errors. Include a tool override and an unknown/missing renderer case.
3. Use a representative heavy renderer: verify no unrelated dependency is installed, no server implementation enters the browser bundle, and its chunk is not requested before activation.
4. Replay partial/final results and a serialized historical result to identify minimum renderer states/version compatibility. This is a protocol proof, not a commitment to all Eve execution modes in the MVP.
5. Repeat the same capability on the proposed second host after its selection; do not claim broad portability from the Next result alone.

Human-owned decisions remain: identity/override behavior; source versus package ownership; generic fallback versus required companions; schema/version compatibility; whether plain shadcn must finish every setup task; and how generated registration cooperates with user edits. These should become focused discussion/prototype work, not be silently resolved by this factual investigation.
