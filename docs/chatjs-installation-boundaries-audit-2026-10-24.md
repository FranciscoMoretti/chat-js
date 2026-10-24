# ChatJS: installation boundaries and file ownership

Audited source revision: `75c87dc8` (2026-10-24). Scope: CLI/registry source inspection, not live provider acceptance. No production files changed. Links below are repository-relative source references; line numbers identify the inspected revision.

## Conclusion

**User-defined scope:** for now, core means everything that is not installable. This audit does not propose making accounts, history, or projects optional, nor a minimal embeddable runtime.

ChatJS has real installable boundaries, especially ordinary tools, document bundles and replaceable infrastructure providers. It does **not** yet have a complete, explicit ownership model for every scaffolded file. The core is largely the reference app minus exclusion/removal rules, while installables have positive manifests. Directory location alone cannot reliably distinguish core from installed source.

This is not evidence that all coupling is wrong: an extension needs stable host contracts. The issue is that some dependencies target public-looking contracts while others target app internals directly, and neither an explicit public import surface nor exhaustive file ownership is enforced by the installation metadata.

## Actual installation pipeline

1. `packages/registry/installation.ts:11` defines registry-address selections: features, gateway, storage, sandbox, tools. It has no composer/layout/model extension kind. `demoInstallation` uses this same shape (`:22`).
2. `packages/cli/src/registry/shadcn.ts:26` translates simple IDs to registry addresses; external addresses pass through. `readItem` validates shadcn items (`:42`).
3. `packages/cli/src/utils/installation-plan.ts:55` plans before writes, recursively visits `registryDependencies`, validates ChatJS metadata, enforces exclusive providers and explicit replacement, merges installed tool descriptors, validates dependencies/capabilities, and produces items/sources/replacements. The webSearch/codeExecution default dependency choices are special cases in this planner (`:261`).
4. Each registry item has a positive source-to-target file mapping. Ordinary tools map to `tools/chatjs/<id>/...` (`packages/registry/registry.ts:124`); document bundles use the same convention (`packages/registry/src/tools/documents.ts:5`).
5. `packages/cli/src/utils/install-plan.ts:144` protects targets, snapshots files, delegates to the shadcn installer, stages retired tool directories, runs registrations and dependency/environment updates, restores captured files on failure, then records hashes. This is substantial safety infrastructure, though its own failure message acknowledges new source/dependencies may remain (`:290`).
6. `packages/cli/src/utils/sync-tools.ts:418` discovers installed tools from descriptor directories, verifies generated registration baselines, and regenerates registries. Generated and user registration files are separated (`:17`, `:528`); custom tools/renderers survive sync and duplicate keys fail.
7. Features use specialized integration: `packages/cli/src/utils/sync-features.ts:313` composes MCP/upload/observability, edits literal UI contribution arrays, and generates installed-router/upload adapters. These are not general third-party contribution descriptors.
8. Dependency receipts track item dependencies and CLI-owned package versions (`packages/cli/src/utils/installation-dependencies.ts:10`). Replacement removes old item requirements (`:159`); pruning conservatively preserves dependencies mentioned by other source (`:75`).

## Axes and physical placement

| Axis | Canonical source | Installed placement | Classification |
| --- | --- | --- | --- |
| Tool + renderer + schemas | `packages/registry/src/tools/<id>` | `tools/chatjs/<id>` | Strong local boundary for ordinary tools |
| Document editor bundle | `packages/registry/src/tools/{text,code,sheet}-documents` | `tools/chatjs/<id>` | Installable editor/tool; document runtime/schema remain host infrastructure |
| Shared code-execution UI | `packages/registry/src/ui/code-execution` | `tools/chatjs/_shared/code-execution` | Explicit shared registry dependency, no ChatJS feature metadata |
| MCP | `packages/registry/src/features/mcp` | `features`, `agent`, `app`, `components`, `lib`, `trpc` | One manifest, many physically scattered targets |
| Uploads | `packages/registry/src/features/attachment-uploads` | `features/attachment-uploads` plus upload API route | Mostly local; host routing adapter outside directory |
| Observability | `packages/registry/src/features/<id>` | `features/<id>` | Good local source boundary; central integration code |
| Gateway | `packages/registry/src/gateways/<id>` | AI gateway path(s) under `lib/ai` | Exclusive provider overwrites shared destination |
| Storage | `packages/registry/src/storage/<id>` | `lib/storage-provider.ts` | Exclusive provider; ID not visible from directory |
| Sandbox | `packages/registry/src/sandboxes/<id>` | `lib/sandbox/{provider,adapter,persistent}.ts` | Exclusive provider; generated options and shared host code nearby |
| Deep research | `packages/registry/src/tools/deep-research` | tool directory plus `agent/subagents/...`, `agent/tools/deepResearch.ts` | Tool manifest spans several architectural layers |

Evidence: `src/features/mcp.ts:6`, `src/features/attachment-uploads.ts:6`, `src/features/observability.ts:46`, `src/storage/catalog.ts:54`, `src/sandboxes/catalog.ts:20`, `src/tools/research.ts:5`, `src/tools/documents.ts:164` within `packages/registry`.

## Ownership is partial, not exhaustive

- **Manifest coverage is positive only for installables.** Registry items enumerate installed targets, but the CLI's template source is the reference app (`packages/cli/src/helpers/scaffold.ts:253`, `:378`). There is no corresponding complete positive core manifest in this pipeline.
- **Core is inferred as a complement.** `scaffold-content.ts:21` maintains repository-only exclusions; `:137` copies everything else allowed by generic filters. `scaffold.ts:411` removes demo providers and selected dependencies, `:492` removes MCP/upload manifest lists, `:119` resets the complete installed-tool directory. `sync-observability.ts:152` separately removes observability bundles. Adding a reference-app file can therefore change scaffold output without assigning that file a core owner.
- **A source receipt is not an ownership manifest.** `.chatjs/installed-source.json` is path → digest (`install-plan.ts:35`). It does not store item ID, provenance, core/installable class, dependency relationships, or shared ownership. `.chatjs/installed-dependencies.json` does record item IDs, but only for npm dependencies.
- **Some ownership is deliberately shared.** Both MCP and research install `src/session-identity.ts` into `lib/eve/session-identity.ts` (`src/features/mcp.ts:46`, `src/tools/research.ts:41`). This is better represented as one shared contract dependency than two apparent owners. Providers similarly share targets, but their exclusivity makes that relationship intentional.
- **Generated state and editable extension points share a directory.** `sync-tools.ts:403` lists generated registries plus `custom-tools.ts`/`custom-ui.ts` under `tools/chatjs`. Generated comments/hash checks distinguish them, but directory-only classification cannot.
- **Demo baseline does not classify the whole app.** `packages/registry/scripts/demo-sync.ts:105` materializes selected registry source and generated descriptors; it maintains drift/baseline checks (`:400`) for that generated subset. It should not be mistaken for an exhaustive core file inventory.

## Concrete coupling and limitations

1. **Feature extensibility remains centrally closed.** `packages/registry/metadata.ts:133` enumerates five feature IDs. The CLI support whitelist and feature-specific registration logic (`sync-features.ts:33`, `:313`) require central modifications for a new feature kind/contribution. External addresses are supported, but arbitrary external feature IDs are not.
2. **Host internals are available to every registry item.** `packages/registry/tsconfig.json:2` extends the reference application's tsconfig and maps `@/*` to all of `apps/chat` (`:7`). Registry type-checking therefore does not establish independence from optional demo features or private host details.
3. **Concrete internal dependencies exist.** Image generation imports EVE generated files, costs, tool models, image context and usage from app-specific modules (`src/tools/generate-image/image-request.ts:12`). Deep research imports document tools, connection options and shared messages (`src/tools/deep-research/steps.ts:3`). MCP DB files import the host DB/schema directly (`src/features/mcp/lib/db/mcp-connector-queries.ts:2`). These may be valid platform services, but the public extension boundary is not declared.
4. **MCP omission removes feature source, not all domain substrate.** MCP manifest removal is explicit, but MCP tables remain in `apps/chat/lib/db/schema.ts:321` and `:356`, which the generic scaffold copies. This must be an explicit product decision: core database capability versus truly optional schema/migration. Do not describe omission as complete feature erasure.
5. **Replacement retirement assumes tool-local ownership.** `install-plan.ts:157` and `:239` retire only `tools/chatjs/<previous.id>`. This works for ordinary exclusive tools. A future slot/document bundle with out-of-directory files can leave old files behind; the schema permits item file targets independent of that directory. This is a structural limitation, not a reproduced defect in a current built-in replacement.
6. **No general removal command exists.** CLI entrypoint registers create/add/sync/config (`packages/cli/src/index.ts:19`). “Installable” currently means selectable at creation/addable/replaceable, not a complete arbitrary uninstall lifecycle.
7. **Existing coverage is useful but not an isolation proof.** `registry-coverage.test.ts:112` enforces renderer visual test coverage. It does not classify all host files or reject forbidden cross-feature imports. Minimal-install and contract tests are relevant existing checks, but they do not replace positive ownership metadata.

## Recommended organization

Keep the current working installer and improve its input model incrementally:

1. Define explicit classes: core implementation, public extension contracts, application composition/configuration, generated registrations, installable-owned source, repository-only tooling/tests. A file's ownership class is separate from whether users may edit it.
2. Build a machine-readable ownership inventory from existing registry manifests, their generated/configuration targets, and the complete shipped-file inventory. Classify core as the complement, following the user’s definition; an explicit derived core inventory can make that complement reviewable. Require every shipped source file to have one owner, or an explicitly declared shared owner. Reject accidental duplicate targets; model exclusive-provider target slots separately.
3. Co-locate extension implementation under one root per extension. Route files can remain in framework-required `app/` locations as thin generated/importing adapters. MCP business logic and DB access should have a clearly owned module, even if tables remain core by design.
4. Expose a narrow core contract surface for tools/features (identity, file storage, document operations, billing/usage, runtime execution, UI slots). Restrict registry imports to those contracts plus self-owned files and declared dependencies. Avoid demanding “zero coupling”: enforce intentional coupling to stable services.
5. Put editable app selections/order in composition files; keep generated output in visibly generated directories; keep extension implementations separate from both. Introduce contribution descriptors for router/settings/composer/observability instead of growing CLI switch statements.
6. Derive omission/replacement/retirement from ownership metadata. Preserve current digest protection and conservative dependency pruning. Add provenance/owner fields to source receipts before implementing general remove or safe layout replacement.
7. Verify with one minimal scaffold, each extension's declared dependency closure, representative provider replacement, and a full demo. Assert absence of unselected implementation and dependencies, and fail imports from core into optional implementations except at composition boundaries.

This report proposes architectural boundaries; it does not claim these changes are already implemented or that a full import graph has been audited.

## Runtime/configuration evidence from the parallel audit

The following source findings were supplied by the coordinating audit and reinforce the installation observations:

- `apps/chat/lib/config-schema.ts:48`, `:127`, `:200` knows optional deep research, document kinds, image and video options. Installation omission and configuration shape are therefore separate concerns.
- `packages/gateways/src/defaults.ts:24` makes gateway defaults know tool-specific defaults, coupling gateway and tool axes. A gateway model/capability contract plus extension-owned defaults would make ownership clearer.
- `apps/chat/lib/env-schema.ts:31`, `:98`, `:116`, `:125`, `:142` knows MCP, Daytona, Firecrawl and Tavily. Configuration descriptors could supply extension environment requirements without every installed credential shape becoming a manually maintained core list.
- `apps/chat/lib/ai/types.ts:4` contains closed tool/UI identifiers. A new installable can therefore need core type edits despite registry-based installation.
- `apps/chat/lib/installation-contracts.ts` depends on composer component and EVE draft attachment types. Public contracts currently span UI/runtime implementation locations; separating those contracts would clarify allowed imports without introducing a new product scope.
- `packages/registry/src/tools/text-documents/comparison.tsx` uses the concrete `trpc.eve.document` interface. The document extension's dependence on document services is valid, but its current transport-specific API should be documented as public or replaced by an intentional host adapter.

Under the user's definition these central files remain core unless owned by an installable. The issue is mixed responsibility and discoverability, not a request to make all these facilities optional. A useful inventory can retain the binary core/installable distinction while annotating core files as runtime, public contracts, composition/generated, app-owned configuration, or framework entrypoints.

## Concrete folder direction, preserving framework discovery

One possible target structure (proposal, not an implemented migration):

```text
app/                         # Next-required route/layout entrypoints; thin adapters
agent/                       # EVE-required discoverable entrypoints; thin adapters
core/                        # Explicitly core-owned implementation and services
core/contracts/              # Allowed contracts consumed by installables
features/<id>/               # Installable feature implementation, UI, queries, descriptor
providers/<axis>/<id>/       # Installable gateway/storage/sandbox implementation
tools/<id>/                 # Installable tool/editor/workflow implementation
composition/generated/       # Installer-generated registration and provider selections
composition/custom/          # User tool/renderers/contribution overrides
chat.config.ts               # App-owned runtime preferences
composer-controls.ts         # App-owned order/selection
settings-items.ts            # App-owned order/selection
.chatjs/                     # Source/dependency receipts plus derived ownership inventory
```

Retaining existing `tools/chatjs/<id>` is also reasonable to reduce migration cost. The essential distinction is ownership and allowed imports, not renaming every directory. Route and agent adapters retain installable ownership in the inventory even though framework discovery forces their paths outside the feature directory. Shared services such as session identity should have one core/shared owner. Provider shared destinations should become explicit composition adapters or exclusive ownership slots.

The inventory should answer “who owns this path?” including generated files, declared shared resources and framework adapters, then derive core as everything remaining. A boundary checker should validate imports against that ownership, not assume a path outside `features/` must be core.

## Validation limits

This was a read-only source investigation plus this report. No production code, install operation, test suite, or provider deployment was changed. An attempted runtime import of `packages/registry/registry.ts` to enumerate duplicate target owners could not resolve `@chat-js/sandboxes/definition` in the current local workspace; no aggregate ownership counts are claimed. Shared-target and other findings above come from directly inspected source.

## Implemented decisions after this audit

The sections above describe the initial checkout. The implementation on `francisco/installation-ownership` now follows these user decisions:

- Core is the complement of installable ownership, not a smaller embeddable chat product.
- `bun architecture:inventory` derives owners from manifests before a broad folder reorganization. It reports imports against declared dependencies and explicitly reviewed core contracts.
- Session identity belongs to core. MCP and research no longer both install it.
- MCP owns `features/mcp/db/mcp-schema.ts` and its encryption implementation. `features/installed-database.ts` composes the selected schemas with core for Drizzle.
- Fresh creation excludes demo migrations and generates a baseline after installing dependencies, without a database connection. Add/sync preserve the application's own history and do not apply SQL.
- ChatJS supports new installations. Compatibility with older generated templates is outside scope, so the old MCP approval-column upgrade guard was removed.
- The public configuration interface remains one `chat.config.ts`. Installed tool schemas now supply its tool-specific types, defaults and validation through `tools/chatjs/installed-config.ts`. Missing tool options are rejected by types and runtime validation.

Validation of the database boundary covered fresh baselines both with and without MCP, later addition of MCP without changing the first migration, rejected invalid schema ownership paths, encryption and OAuth queries. Drizzle reports no schema changes against a temporary copy of the demo migration history. Before the environment-reader pass, the inventory reported 159 installable files, no ambiguous ownership or missing targets, and 273 import crossings still requiring review. Those crossings are evidence for the next pass, not automatically approved dependencies.

Configuration follow-up findings:

- `attachments` is still consumed by core attachment restoration and message validation, so the whole block cannot be assigned to upload UI merely because that feature is installable.
- Document assistant actions formerly in core now belong to their document bundles. `tools/chatjs/document-actions.ts` composes them for core, keeping action-specific configuration reads with the owner.
- Gateways now publish generic model roles. The user selected the final names `smart`, `balanced` and `fast`, with optional `image` and `video` roles. Tool schemas own research limits and select model defaults from those roles. Existing selected model IDs were preserved.
- Environment readers belong to each installable, rather than a composed global `env`. Search/retrieval tools and sandboxes now own their readers; MCP validates its encryption key at feature use. Proxy URL validation lives in the selected gateway. Core no longer declares optional integration credentials or the unused Exa key. `check-env` continues to gather presence requirements from installed manifests. Credential readers stay separate from client-visible configuration schemas.

## Review of remaining import crossings

The final environment-reader inventory contains 162 installable files and 1,069 core files. There are no shared targets, missing targets, unresolved local imports or unclassified local imports. All six cross-installable imports use declared registry dependencies.

The 269 remaining review findings were inspected by destination and integration role:

| Direction | Count | Review disposition |
| --- | --: | --- |
| Installable to core | 260 | Most use host types, renderers, UI primitives, configuration, logging and runtime helpers. They are candidates for an explicitly documented host interface, not automatic additions to the public contract allowlist. |
| Core to installable | 9 | Three imports in user-editable composer/settings registries and six imports of selected gateway, storage or sandbox implementations. These are intentional composition points, not arbitrary feature imports from core business logic. |

The following existing dependencies remain architectural follow-up:

- Document tools use `lib/db/eve-documents.ts` and `lib/eve/conversation-scope.ts` directly. A future document service interface must preserve ownership checks and transaction semantics before hiding this persistence/authorization implementation.
- MCP OAuth locking uses core database configuration and environment directly. Its lock-pool lifetime and concurrency contract need a deliberate design before extraction.
- Research progress/update schemas and MCP name/result helpers are feature-specific in purpose but remain core under the agreed complement rule. Moving them requires deciding whether their runtime consumers use a generic host contract or a separately installed contribution.
- Core provider loading and editable app registries are legitimate composition points. A future enforcement rule should identify those exact edges rather than allow arbitrary core-to-installable imports.

No new correctness or specification defect was found in the implementation review. This PR establishes ownership and composition for schema, tool configuration, model defaults and environment readers; it does not claim to finish all host-interface extraction. `architecture:inventory --check` intentionally continues to fail on imports without an approved policy. It is not enabled as a CI gate.

Validation includes the nine workspace type checks, 167 registry tests, 63 environment/runtime tests, local scaffold configuration probes and template/demo consistency. Full packaged CLI installation remains deferred until before publication; its last attempt timed out in setup without identifying the slow subprocess. Inspect or instrument setup before rerunning that expensive test.
