# ChatJS framework evolution: discussion brief

Research date: 2026-09-05. This folder records research, agreed direction and remaining proposals. The agreed direction below reflects the user's subsequent approval; implementation details are not a finalized specification or release commitment.

The canonical decision map is now [Chart the ChatJS framework evolution](https://github.com/FranciscoMoretti/chat-js/issues/281). Continue through its native child issues and dependencies. These notes preserve the pre-map context; future resolutions belong in their decision tickets, with linked gists on the map. A shared research snapshot is available on [the foundations research branch](https://github.com/FranciscoMoretti/chat-js/tree/research/chatjs-framework-foundations/research/framework-evolution).

## Agreed direction

The user accepted the following recommendations before the research:

- Plan the project definition, architecture boundaries, staged MVP, migration strategy and X communications together.
- Prioritize the complete new-application onboarding journey while designing for adoption inside existing applications.
- Use Eve as the default execution foundation behind an explicit boundary; defer deciding whether to ship another execution adapter until its cost and demand are understood.
- Preserve the current Next.js application and prove reuse in one second host before promising a broad framework support matrix.
- Complete extensive research and high-level discussion before creating decision tickets. This phase is complete; the user has now requested continuing the wayfinder flow.

After reviewing the findings, the user explicitly selected **AI SDK 7** as the target baseline and accepted the recommendations presented in the research discussion:

- Define ChatJS around composing complete AI applications, with chat as one surface in a broader agent workspace.
- Use the existing `apps/chat` demo and its resolved default configuration as the reference application definition. The user's subsequent clarification replaces the suggestion to invent a new flagship application. Smaller configurations and alternate layouts of these existing capabilities can demonstrate composition.
- Reuse Eve's authoritative session state; use scoped Zustand UI state and React Query for application records without independently writable copies of the same transcript.
- Distribute customizable layouts, renderers and application composition as editable source, with difficult runtime invariants maintained in versioned packages.
- Have the website and CLI consume the same starting configuration; after generation, developer-owned source is authoritative and later CLI changes are explicit and reviewable.
- Treat selective dependency installation, lazy loading of installed heavy UI, and removal of unused exports as distinct requirements.
- Derive known integration types from the consumer's installed composition; validate runtime-discovered/external payloads.
- Use Vite React plus an Eve Node service backed by Postgres as the second-host proof, while retaining Next.js. The exact compatible package versions and deployment setup remain to be verified.
- Treat preservation of arbitrary branching and parallel responses as a major acceptance criterion; investigate supported Eve/upstream integration before considering scope reduction. The integration mechanism remains unresolved.
- Keep the existing application usable during the transition.
- Develop publicly through demonstrated milestones, followed by a larger announcement when the complete creation-and-extension journey works.

AI SDK 7 is a planning decision, not a completed upgrade. The working application and thread package still target AI SDK 6 at this research snapshot. Choose and verify a compatible AI SDK/Eve/provider-package version set during migration. No implementation start, X publication, or ticket creation is implied by accepting this direction.

Original constraints remain: strong TypeScript safety; composable UI; website/CLI configuration; shadcn-compatible distribution; frontend companions for tools; external tool/gateway authorship; selectable infrastructure; and installing only the capabilities and dependencies an application needs.

## Existing demo as the reference application

The user clarified that the repository already contains the demo application and its default configuration can define the intended demo. Start from [apps/chat/chat.config.ts](../../apps/chat/chat.config.ts), with [schema/default resolution](../../apps/chat/lib/config-schema.ts) and [gateway defaults](../../apps/chat/lib/ai/gateway-model-defaults.ts). The resolved configuration matters: not every enabled feature is written explicitly in `chat.config.ts`.

At the inspected checkout, the demo explicitly selects attachments, parallel responses, three sign-in providers, desktop support, Vercel AI Gateway, web search, URL retrieval, code execution, MCP, follow-up suggestions, image generation and deep research. Text/code/sheet documents are enabled through gateway defaults; video generation remains disabled through those defaults. Anonymous users have a separate tool allowlist, currently empty. This is a source-level configuration inventory, not a fresh runtime verification. Existing behavior such as branch navigation that is not represented by its own flag must also be preserved by the acceptance inventory.

The architectural change is how applications acquire those capabilities:

- The demo is a full reference composition of the framework's installable capabilities.
- A generated application contains its selected capabilities and their necessary transitive dependencies.
- The demo's broad feature set does not become the mandatory framework core or every generated application's dependency set.
- Installation selection determines which code is present. Runtime configuration still controls behavior and availability of installed capabilities; temporary disabling need not remove code.

Recommended proof: reconstruct the existing demo through the same composition/installation path available to users, then generate a smaller subset and verify that excluded feature code/dependencies are absent. This avoids a special demo implementation drifting from the distributed framework. The user has settled the demo definition; the exact migration mechanism remains open.

Current scaffolding copies the app/template and performs selected transformations, including resetting installable tools and choosing storage. [Scaffolding](../../packages/cli/src/helpers/scaffold.ts) and [package normalization](../../packages/cli/src/helpers/package-manifest.ts) do not establish general removal of every unselected feature dependency. This is the limitation the new composition model must address.

Preserve the intended product behavior rather than freezing incidental current model IDs, credentials, marketing text or implementation choices. The AI SDK 7/Eve migration and infrastructure choices remain agreed parts of the evolution.

## Research index

- [Eve execution, client state, tools and branching](./eve-runtime.md)
- [Composition, distribution, source ownership and contribution history](./composition-distribution.md)
- [Infrastructure, Workflow Worlds and second-host options](./portability.md)
- [X history, audience questions and communications implications](./x-history-and-positioning.md)

These investigations use the current repository, primary documentation, pinned upstream source and the X API. They establish documented/source-level feasibility, not tested integration. No application code, runtime prototype or deployment was changed. Upstream beta/main findings must be checked against the exact version selected for implementation.

## Agreed product direction

ChatJS can own **the composition of complete AI applications**: developers select capabilities, receive working application behavior and editable interfaces, and evolve those choices without adopting a mandatory hosting service.

A capability is proposed here as a useful unit of installation, not yet an agreed glossary term. It may include a backend tool, its typed frontend presentation, supporting application services and dependencies. A layout arranges installed capabilities. A recipe describes a starting composition. These are distinct concerns even if a single CLI command assembles them.

The durable product value is the integration work saved over an application's lifetime: state/interaction conventions, useful tool experiences, installation, coherent defaults and tested deployment paths. A large number of flags or supported libraries alone does not demonstrate that value.

## Where ChatJS fits in the ecosystem

| Project | Responsibility established by primary sources | ChatJS relationship |
| --- | --- | --- |
| AI SDK | Typed model/provider interaction and AI application APIs; already fundamental to current ChatJS | Reuse through Eve and relevant application integrations; preserve a clear version boundary |
| Eve | Filesystem-authored agents, durable execution, client store and frontend helpers | Delegate execution/session machinery; add application composition and richer user-facing capabilities |
| shadcn | Editable source distribution, registry dependency resolution, presets and creation tooling | Reuse distribution; define application recipe/compatibility conventions above it |
| AI Elements | Customizable React UI components distributed into the consumer's project | Reuse visual components where appropriate; supply application state/behavior and whole-feature integration |
| assistant-ui | Composable chat primitives plus a runtime layer adapting state/backends; persistence can use its cloud or custom adapters | Substantial overlap in state-aware chat UI; differentiate through the complete application construction experience rather than pretending the overlap does not exist |
| AG-UI | Event protocol for agent/application interaction | Track as a potential interoperability boundary; not an automatic benefit of adding Eve and not a substitute for installation/application architecture |

Primary sources: [AI SDK source overview](https://github.com/vercel/ai/tree/main/packages/ai), [Eve frontend](https://github.com/vercel/eve/blob/e6037391160b493e395f46a226878fc81ae1a1c0/docs/guides/frontend/overview.mdx), [shadcn introduction](https://ui.shadcn.com/docs), [AI Elements introduction](https://github.com/vercel/ai-elements/blob/main/apps/docs/content/docs/index.mdx), [assistant-ui architecture](https://www.assistant-ui.com/docs/architecture), [assistant-ui primitives](https://www.assistant-ui.com/docs/primitives), [AG-UI overview](https://docs.ag-ui.com/introduction).

Interpretation: “composable AI components” alone is already a populated category. ChatJS should demonstrate complete behavior from installation to deployed application, including the hard seams between these existing projects. Eve also supplies a basic web-chat integration, so “a frontend for Eve” does not fully express the proposed value.

## Agreed ownership direction

Prefer explicit ownership to a new universal abstraction:

| Concern | Intended owner |
| --- | --- |
| Agent execution, waits, durable events, reconnect protocol | Eve and its selected Workflow World |
| A live session's projected state and commands | One retained Eve-backed client store, accessed through a ChatJS scope |
| Layout selection, active panels, temporary editor state | Scoped UI state, with Zustand where useful |
| Lists, application records and ordinary server queries | Application services and React Query/tRPC where appropriate |
| Users, access rules, conversation organization, references to execution sessions | Application database/services, with replaceable host integration |
| Rich tool UI and application composition | ChatJS conventions and installable source |
| Framework routes, cookies, process lifecycle, build integration | Host-specific adapters and deployment recipes |

This model avoids making the same transcript independently writable in Eve, Zustand and React Query. It also avoids making tRPC the mandatory transport for an upstream event protocol it does not need to replace.

Two conversation views may share a session, or intentionally display different sessions. Composition therefore requires explicit scope and lifetime, even if most components no longer receive data through a long prop chain. “No prop drilling” should not become implicit global ownership.

## Five product boundaries that change the size of the project

### 1. Conversation-centered apps versus agent workspaces

A two/three-panel configurator can produce variants of one chat application, or genuinely different applications: document workbenches, research workspaces, comparison tools, and approval-driven workflows. The user accepted the broader agent-workspace direction.

The existing demo's resolved default configuration defines the reference experience. Composition can be demonstrated through smaller selections and alternate layouts of its current chat, document and research capabilities; a new flagship use case is unnecessary. Chat may be a secondary panel in those variants.

### 2. Editable source versus maintained runtime invariants

Agreed ownership: user-facing layouts, tool renderers and application composition are editable source; durable protocol/state invariants live in versioned dependencies. Developers can customize a document workspace without forking a stream reducer to change a layout.

This hybrid distribution direction does not settle how every adapter is packaged. The user should understand which files become theirs, which files are regenerated, and what upgrades may affect. Small source copies do not guarantee small installed graphs if their runtime dependency vendors large assets.

### 3. A builder that generates an app versus one that keeps editing it

Agreed initial promise: the website helps select a valid starting recipe and preview it; the CLI consumes that same recipe. Once a developer edits code, the code is authoritative. Subsequent layout changes produce a reviewable change around a known composition boundary.

Full round-trip editing of arbitrary customized source is a separate, much larger product. A conventional layout file provides an address, but not safe semantic merging. A recipe should also distinguish pinned/reproducible dependencies from requests for current latest items.

### 4. Portable infrastructure versus every interchangeable backend

Agreed first proof: test a Vite React client plus a long-running Eve Node service backed by Postgres as the architectural second host. Use explicit supported deployment recipes. A complete TanStack Start starter and wider database compatibility remain later scope decisions.

This proves more than merely self-hosting Next, while remaining smaller than implementing every framework/ORM/cache matrix. Database provider, SQL dialect, JavaScript runtime, app framework, model gateway, workflow world and agent runtime are separate axes.

### 5. Branching as a differentiating guarantee

Current ChatJS branches arbitrary selected histories and supports concurrent siblings. Eve's inspected public API does not establish equivalent fork/history-import support. Its headless store and durable input handling are promising, but do not settle this.

Preservation is an agreed major acceptance criterion; the mechanism remains the main uncertainty that could change migration sequencing. Investigate a supported Eve fork/import path or upstream collaboration before considering scope reduction. A staged transition must keep the existing application usable. Treating a transcript pasted into a new prompt as a real fork would lose important execution semantics.

Audience evidence reinforces the importance: users specifically asked about branching after struggling with AI SDK, as well as integration into existing React apps and other agent backends. [Branching question](https://x.com/franmoretti_/status/2019015275988042235), [existing React app](https://x.com/franmoretti_/status/2019381035654328726), [Mastra integration](https://x.com/franmoretti_/status/2019258203285123108).

## What an extension ecosystem needs to make possible

The defining demonstration should be an independently hosted tool or gateway installed without editing ChatJS upstream. A tool installation connects a server definition to a typed frontend experience; its heavy viewer/editor loads when needed. Validity is inferred from the consumer's installed composition, not a central union of all known community providers.

The guarantee has three independent parts:

1. Unselected feature source and dependencies are absent from a fresh project.
2. Installed heavy UI is excluded from the initial client download.
3. The chosen build eliminates unused exports where the dependency structure supports it.

Removal after arbitrary user edits is a separate promise. The CLI cannot infer that every dependency originally installed for a tool is now unused by user code.

Strong typing applies to compiled, known contracts. Runtime-discovered tools and externally sourced payloads still require validation and a fallback path. Custom renderers should not import server executors or credentials just to recover an output type.

## Communications and continuity

The X API review covered 84 unique author posts across keyword searches and 104 unique posts across three launch conversations. The project has consistently emphasized reusable foundations, efficient UI, sensible defaults and provider choice. The proposed framework follows that history.

The February ChatJS launch had 83,528 impressions and 1,130 bookmarks at retrieval; the earlier fine-grained streaming demonstration had 56,678 impressions and 802 bookmarks. These are descriptive observations, not causal marketing evidence. The strongest proposed communication direction combines a practical application outcome with a technical demonstration. [ChatJS launch](https://x.com/franmoretti_/status/2019002475865571370), [streaming demonstration](https://x.com/franmoretti_/status/1956297942375055641).

Agreed communications approach: develop publicly through demonstrated milestones, then announce more broadly when the complete creation-and-extension journey works. Potential milestones include two application shapes, an external tool with UI, and durability on a supported alternative deployment. No release date or campaign schedule is set; publication requires its own instruction.

Maintain the existing usable application during exploration. Whether the new architecture lands through incremental extraction, a parallel next-generation starter, or a versioned migration depends especially on branching and compatibility. **AI SDK 7 is the agreed target.** Current Eve's published metadata also requires Node 24+, while the thread package still targets AI SDK 6; the upgrade and compatibility checks remain implementation work.

## Next conversation

Continue at product level before package names or ticket boundaries:

- What does the minimum supported application require, and which application services remain optional installations?
- Which developer-owned customizations and existing user data must have an upgrade/migration path?
- What compatibility and maintenance promise distinguishes an officially supported integration from a community registry item?
- What capacity and timing can maintenance, framework development and communication receive?

The specialist notes retain their original research-time recommendations and uncertainties. This brief's agreed-direction section records subsequent user decisions; an accepted direction does not establish untested upstream compatibility.
