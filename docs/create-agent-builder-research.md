# Create → Agent builder research

Researched 2026-11-11 against ChatJS checkout `4fc8f8cee` and current public EVE documentation. Scope confirmed by the user: replace Create's **AI tools** tab with an **Agent** builder for instructions, tools, skills, and subagents. This is research for discussion, not an implementation proposal approved for execution.

## Assessment

Follow-up evidence: the [disposable installation experiment](./eve-registry-installation-compatibility.md) now verifies five official registry items individually and together against the pinned fork. It supersedes the original no-runtime-test limitation below and identifies the shared ChatJS compatibility work.

Follow-up clarification: the user primarily wants to assemble capabilities EVE already ships, such as Slack and ready-made tools. The strongest reuse point is **EVE's integration registry and `eve add`**, not just its runtime APIs. Current docs describe one installation interface for channels, connections, extensions, memory, instrumentation, tools, and skills, including guided setup. This materially narrows the custom work for a catalog-oriented Agent tab. The larger estimates below apply to free-form authoring and live preview, not merely selecting existing integrations. [Add Integrations](https://eve.dev/docs/install-integrations).

This is a good fit for EVE. ChatJS already runs EVE and distributes native EVE tools, so the main addition is an authoring and export layer. Reuse the current tool catalog inside an Agent tab. EVE provides the runtime concepts; ChatJS must define how users configure, preview, save, and export them.

There are existing builders, including Vercel's hosted builder. The public evidence reviewed does not establish a maintained, embeddable React Agent-builder component that we can install into Create. See the [ecosystem research](./eve-builder-ecosystem-research.md) for source-level findings and candidate limitations.

## What the Create code already does

| Area | Evidence in this checkout | Implication |
| --- | --- | --- |
| Tool selection | [ToolsConfiguration](../apps/site/components/create-preview/tools-configuration.tsx) filters registry items of kind `tool` and renders `FeatureChoices`. | Keep this catalog and dependency handling as the Tools section of Agent. |
| Shared installation contract | [installation.ts](../packages/registry/installation.ts) accepts plugins, gateway, storage, sandbox, and tool addresses. [installation-catalog.ts](../packages/registry/installation-catalog.ts) resolves dependencies, provider requirements, and conflicts. | Extend the overall Create document with agent authoring data; tool selection already has a working model. |
| Share/export | [create-model.ts](../apps/site/components/create-model.ts) produces a CLI command. [app-preset.ts](../packages/registry/app-preset.ts) encodes fixed built-in choices in a versioned bitset. [create.ts](../packages/cli/src/commands/create.ts) scaffolds, installs registry items, and writes configuration. | Instructions and skills cannot fit the existing compact choice encoding. Add a versioned document/file import-export path or saved preset reference. |
| Native tools | [Authoring Tools](../apps/docs/tools/authoring.mdx), [execution.ts](../apps/chat/integrations/tools/execution.ts), and [installed.ts](../apps/chat/agent/tools/installed.ts) compose native EVE tool definitions. | No runtime migration is needed to make the tab agent-oriented. |
| Agent model and instructions | [agent.ts](../apps/chat/agent/agent.ts) uses dynamic model selection with ChatJS accounting. [instructions/chat.ts](../apps/chat/agent/instructions/chat.ts) loads [systemPrompt](../apps/chat/lib/ai/prompts.ts). | Builder settings need explicit integration points that preserve model accounting and application-owned instructions. |
| Multi-agent bundle | [research.ts](../packages/registry/src/tools/research.ts) installs the research workflow plus planner, researcher, compressor, and writer subagents. | There is already a concrete distribution pattern for a preset containing multiple EVE agents. It is a fixed research bundle, not a general subagent editor. |
| Preview | [scenarios.ts](../apps/site/components/create-preview/scenarios.ts) builds sample messages and explicitly states no external services are called; [chat-preview.tsx](../apps/site/components/create-preview/chat-preview.tsx) renders those fixtures. | Current preview demonstrates appearance and interactions. It cannot validate edited instructions, skill selection, or delegation behavior. |

## What EVE supplies

These are current upstream capabilities, not a claim that every option is available unchanged in ChatJS's pinned fork.

| Desired builder concept | EVE support | ChatJS work |
| --- | --- | --- |
| Instructions and model | Agent files and `defineAgent`; static and dynamic model selection. [Configuration](https://eve.dev/docs/agent-config) | Editors, defaults, model compatibility, generated bindings to existing accounting. |
| Tools | `defineTool`, validation, approvals, output policies; authored workflow tools. [Tools](https://eve.dev/docs/tools) | Reuse current registry; expose selected settings and preserve receipts/renderers. |
| Skills | Markdown or `SKILL.md` packages and `defineSkill`; on-demand loading, optional assets. [Skills](https://eve.dev/docs/skills) | Import/editor/catalog, dependencies, validation, export, loading feedback. |
| Specialists | Declared subagents with their own model, instructions, tools, skills, and nested agents. [Subagents](https://eve.dev/docs/subagents) | Specialist editor, permitted tools, name collision checks, export, useful result presentation. |
| External services | MCP and OpenAPI connections with authentication and operation filters. [Connections](https://eve.dev/docs/connections) | Configuration/account UI and connection binding; retain or explicitly adapt existing ChatJS MCP integration. |
| Reusable bundles | Extensions package multiple capabilities and mount them into an agent. [Extensions](https://eve.dev/docs/extensions) | Curated presets and app-side metadata. EVE extension discovery does not register ChatJS renderers, billing receipts, database contributions, or composer entries. |
| Testing and frontend | Evals exercise a real server; frontend hooks expose the running agent. [Evals](https://eve.dev/docs/evals), [frontend integration](https://eve.dev/docs/guides/frontend) | Live preview service, session lifecycle, configuration versions, spend controls, test UI. |

Skills teach procedures; they do not install tools. A skill that tells an agent to search still needs a search capability. Supporting skill assets can need sandbox file tools. The current root agent explicitly sets `defaultTools: false`, so enabling skills requires checking the pinned runtime's loader and asset-access behavior rather than assuming upstream defaults apply. [Skills](https://eve.dev/docs/skills), [local agent configuration](../apps/chat/agent/agent.ts).

Declared specialist subagents also differ from a workflow graph: the model can choose when to delegate, while an authored workflow encodes a required sequence. The existing research bundle uses the latter pattern. A first version should expose specialists/presets without promising a general visual workflow editor. [Subagents](https://eve.dev/docs/subagents), [local research implementation](../packages/registry/src/tools/deep-research/agent/tools/deep-research.ts).

## Existing builders and reusable pieces

- **Vercel hosted builder:** officially supports instructions, model selection, Next.js or Slack interfaces, and built-in/custom MCP connections. It creates a repository and deployment. This is a real product precedent; the announcement does not establish a skills/subagents editor or an embeddable builder SDK. [Official announcement](https://vercel.com/changelog/build-and-deploy-eve-agents-from-the-vercel-dashboard), [entry page](https://vercel.com/new/agent).
- **EVE CLI and extension ecosystem:** `eve init` scaffolds agents, and extension packages compose capabilities. These are useful construction primitives beneath a builder. [Getting started](https://eve.dev/docs/getting-started), [extensions](https://eve.dev/docs/extensions).
- **Evepad:** community EVE development environment; a useful reference for editing and running an agent, but not demonstrated as a supported drop-in configuration tab. [Repository](https://github.com/andrewckor/evepad).
- **`eve-agent-builder` in `ewhauser/eve-extensions`:** experimental programmatic builder/control-plane work, not a ready visual editor. Its scope, version, and missing features are detailed in the companion report. [Repository](https://github.com/ewhauser/eve-extensions).

## Suggested implementation boundary

Keep **Appearance / Plugins / Agent / Setup**. Agent contains **Instructions, Model, Tools, Skills, Specialists**. Existing search, generation, document tools, and their UI stay useful inside it.

Introduce one validated, versioned Create document containing the existing installation selection plus agent configuration. Treat this as editable authoring data that generates normal EVE files and ChatJS bindings, not a second runtime. Use one translation path for the preview and exported app so they do not quietly behave differently. Make exports reproducible and preserve user-editable generated source.

Free-form prompts and skill packages need a different transport from today's short preset code. An initial downloadable configuration file plus a CLI import path is bounded work. Shareable saved drafts require persistence and ownership. Secret values should use environment/account references rather than shared URLs or exported browser state.

Preserve application-owned authentication, accounting, tool availability, and document ownership logic when generating the agent. Avoid replacing `agent/agent.ts` with a bare upstream sample or blindly appending duplicate instruction modules. The builder should customize designated surfaces within the current application contract.

For live preview, dynamic EVE definitions can select known tools and provide instructions/model/skills from application data. Arbitrary new TypeScript and arbitrary new local subagent trees need a build/export execution path: dynamic subagent configuration still uses filesystem-built child capabilities. Therefore a catalog-backed preview is substantially smaller than a hosted environment that builds any user-authored EVE project. [Dynamic capabilities](https://eve.dev/docs/guides/dynamic-capabilities).

## How much is custom?

| Scope | Reuse | New work / relative size |
| --- | --- | --- |
| Agent tab with instructions, model, existing tools, and simple Markdown skills; export app | Create shell/catalog, CLI, EVE runtime, chat UI | **Medium:** configuration schema, editors, export/generation, round-trip checks. |
| Specialist presets and editable specialist definitions | EVE delegation and current research bundle | **Medium–large:** per-agent tool/skill scopes, naming/dependency validation, generation, useful preview. |
| Real test conversation in Create | EVE sessions/client and ChatJS conversation components | **Large:** preview backend, authenticated isolation, configuration snapshots, credentials, spend limits, cancellation/cleanup. |
| Arbitrary code tools, graphs, multi-channel deployment, production draft/publish management | Some EVE runtime and platform primitives | **Very large:** effectively a hosted agent development product. |

Most runtime foundations are reusable. Most builder-specific UX and the connection from configuration to generated application are ours. The feature is a meaningful extension to Create, but does not require writing an agent framework.

As a planning estimate only, a constrained export-first release is plausibly a few engineering weeks for one engineer familiar with this repo. Live preview and general specialist authoring should be estimated as separate milestones after a small end-to-end spike. No implementation or prototype was run, so a more precise duration or reuse percentage would be misleading.

Recommended first proof: configure a support agent with custom instructions, one search tool, one Markdown skill, and one specialist; export a fresh app and demonstrate that each choice affects behavior. That resolves the main schema/generation/runtime questions before designing the full editor.

## Evidence limits

The checkout pins `eve` to `npm:@chat-js/eve@1.0.0-rc.6-chatjs.1` in [package.json](../apps/chat/package.json) and [bun.lock](../bun.lock). Public Vercel pages advertise a newer release candidate. Older repo research notes mention 0.61.0 or rc.1 and must not be treated as current version evidence. Installed EVE docs were unavailable because this checkout has no `apps/chat/node_modules/eve`; no dependencies were installed and no runtime tests were executed. Code observations are source inspection; ecosystem capabilities are documentation/source evidence. Only research Markdown files were added.
