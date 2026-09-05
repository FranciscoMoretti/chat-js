# ChatJS expansion and installation axes

Axis inventory supporting [Define the minimum ChatJS core and the demo capability boundary](https://github.com/FranciscoMoretti/chat-js/issues/282). The user agreed the high-level minimum/core boundary and the catalog model of individual building blocks plus complete-feature bundles. This inventory identifies the areas to classify; exact contracts, packaging and first-release support remain dependent decisions. It is not a promise to implement every adapter or expose every choice in the initial builder.

## Three kinds of choice

1. **Capability selection:** what the application can do and which source/dependencies it installs.
2. **Implementation selection:** which compatible integration supplies a required service or host.
3. **Runtime configuration:** how installed behavior operates, including defaults, permissions and limits. Temporarily disabling a capability does not uninstall it.

The same product area can contain all three. File input is a capability; an object-store adapter is an implementation; maximum upload size is runtime configuration.

## Working inventory

| Area | Capability / extension axis | Implementation or runtime choices | Boundary to settle |
| --- | --- | --- | --- |
| Application layout | Single/two/three-panel layouts; sidebar and work area | Placement, sizing, default open panel | Replaceable user-owned composition with capability requirements |
| UI building blocks | Composer, transcript, tool cards, navigation, model picker | Styling and placement | Individual component installation versus feature bundles |
| Message presentation | Markdown, code highlighting, reasoning, sources, specialized parts | Visibility and presentation options | Optional heavier renderers versus shared baseline rendering |
| Conversation interactions | Editing, regeneration, branching, parallel responses | Available actions and parallel request limits | Optional controls/orchestration versus shared message/run identity |
| Tools | Search, URL retrieval, code execution, image/video generation, external tools | Tool provider, model and execution settings | Paired backend/UI installation and supporting dependencies |
| Agent behavior | Deep-research flows, follow-up suggestions and other agent recipes | Models, instructions, iteration and concurrency limits | Tool versus agent/recipe packaging; Eve remains the default execution foundation |
| Tool connections | MCP client integration and connection-management UI | Servers, credentials and permissions | Static installed companions versus dynamically discovered tool schemas |
| Artifacts/workspaces | Text, code, sheet, PDF and image viewing/editing capabilities | Workspace placement and editor behavior | Artifact type/editor selection independent from unrelated tools; some are future examples, not current shipped editors |
| Attachments/files | Uploading, previewing, generated file handling | Accepted types, size limits, storage implementation | Input/output capabilities may share file services without requiring all viewers |
| Identity | Login UI, authentication integration, anonymous access experience | Existing-app identity or selected providers | Account implementation optional; caller/session authorization contract remains necessary |
| Application records | Saved conversation lists, projects, settings, sharing, votes | Persistence adapter and retention/access policies | Independently installed feature schemas/routes versus common app persistence requirements |
| Usage controls | Credits, quotas and distributed rate limiting | Limits and accounting/cache backend | Demo operational policies do not become mandatory features of every app |
| Model access | Gateway/provider implementations; optional catalogs and selection UI | Fixed model, default model and exposed catalog | A fixed-model app needs model access but not necessarily discovery, selector or saved preferences |
| Object storage | Files SDK provider integration | Provider and connection/options | Included when selected features require stored bytes |
| Application database | Selected persistence implementation | Hosting and connection parameters | Cloud-independent PostgreSQL first; arbitrary SQL dialect support is a separate scope decision |
| Cache | Optional server cache and distributed cache integrations | Freshness, invalidation and failure semantics | Distinct from browser Query cache, rate limits and durable execution storage |
| Durable execution infrastructure | Compatible Workflow World/deployment recipe | World configuration and worker lifecycle | Required by selected Eve execution behavior; not an optional optimization or generic cache |
| Sandbox infrastructure | Execution sandbox implementation | Local/remote backend and isolation/resources | Required only by capabilities that execute sandboxed work |
| App host and desktop | Next integration, Vite proof, Electron shell | Deployment provider and desktop integration | Host choice is distinct from local-first/offline desktop behavior; wider support not promised |
| Development aids | Optional devtools/evaluation fixtures and integration checks | Logging/tracing/evaluation configuration | Potential later packaging axis, not additional MVP feature scope |

## Cross-cutting extension rules

- External registries should be able to contribute supported kinds of capabilities/integrations without a central source-code contribution. Not every matrix cell needs a custom plugin API; use upstream provider contracts where they fit.
- The browser rendering surface and server executable implementation must have separate import boundaries even when installed together.
- A feature bundle can depend on individual components and shared services. A checkbox is not automatically an independently meaningful package.
- The installer resolves selected requirements. Some choices are constrained: deep research needs search; persistent file outputs need storage; sandbox execution needs a sandbox; sharing saved conversations needs persistence and an access policy.
- Hiding a reasoning panel, changing a model ID, setting a quota or changing panel width does not by itself require an installation operation.
- Strong TypeScript, AI SDK 7 and Eve as the default behind an explicit boundary are settled foundations, not additional first-release dropdowns. React host portability is not a commitment to Vue/Svelte renderers or arbitrary agent runtimes.
- The demo's chosen implementations are preset selections, not mandatory defaults for every consumer.

## Evidence and gaps

Current explicit CLI choices are in [CLI types](../../packages/cli/src/types.ts) and [prompts](../../packages/cli/src/helpers/prompts.ts). The CLI currently labels attachments, parallel responses, documents, MCP and follow-up suggestions as core features; this label does not establish that they belong in the new mandatory core.

The reference feature set comes from [demo configuration](../../apps/chat/chat.config.ts), [gateway defaults](../../apps/chat/lib/ai/gateway-model-defaults.ts), [schema](../../apps/chat/lib/config-schema.ts) and behavior outside flags. Application records beyond visible feature toggles are evident in the [tRPC root](../../apps/chat/trpc/routers/_app.ts), including projects, credits, votes, settings, documents and MCP. The [feature docs](../../apps/docs/features/overview.mdx) describe additional behavior such as sharing and branching.

This is a capability inventory and proposed classification, not a measured dependency graph. Exact package/file boundaries, service implementations and contract formats belong in the dependent capability, UI, infrastructure and builder decisions.

## Agreed catalog granularity

The catalog exposes individual building blocks plus convenient complete-feature bundles, with the builder primarily selecting complete features and resolving their requirements. The simple path installs complete behavior while advanced users retain fine-grained composition. The precise schema, package/file boundaries and builder UI remain later decisions.
