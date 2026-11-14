# EVE agent-builder ecosystem research

Researched 2026-11-11. Scope: replacing ChatJS's AI Tools tab with an agent-configuration builder for instructions, tools, skills, and subagents. This is distinct from a coding agent that generates arbitrary applications. No implementation or runtime testing was performed.

## Findings

Follow-up: the [installation experiment](./eve-registry-installation-compatibility.md) subsequently tested official registry items against ChatJS's pinned fork. The no-installation statements below describe this earlier ecosystem review, not the later compatibility evidence.

EVE can support this experience: its native authoring model already represents the things the proposed UI edits. However, the inspected public ecosystem does not offer a supported, embeddable React agent-builder component covering all four requested categories. The practical direction is a ChatJS configuration UI that produces native EVE files or resolves configuration into EVE capabilities, with ChatJS owning its form state, validation, persistence, preview, and export mapping. The latter is an architectural inference, not a shipped EVE builder API. [EVE authoring model](https://github.com/vercel/eve/blob/main/docs/README.md)

### Existing builders and reusable pieces

| Project | Verified capability | Relevance and limits |
| --- | --- | --- |
| Vercel hosted Agent Builder | Creates an EVE agent, private Git repository, and deployed Vercel project; edits instructions, chooses an AI Gateway model, adds Next.js web chat/Slack and built-in/custom MCP connections. | Real shipped product, announced August 28, 2026. Good product precedent; the announcement does not claim skills/subagent editors or an embeddable UI SDK. |
| `eve init`, `eve add`, extension scaffold | Native scaffolding and integration installation. | Reuse conventions and generated artifacts; these are developer tooling, not browser form components. |
| EVE internal scaffold exports | `scaffoldBaseProject`, `ensureChannel`, `ensureConnection`, connection catalog. | Actual first-party Agent Builder integration, explicitly internal and unstable. Do not depend on it as a supported application API. |
| `@eve/catalog` | Typed integration identity, display names, descriptions, transports, and availability flags. | Useful catalog/schema precedent; private monorepo package, not a public generic agent-schema or UI package. |
| `andrewckor/evepad` | Local dashboard, editable instructions, coding chat, live graph, CLI and deployment workflows. | Open source UI reference; a local coding IDE, not a portable declarative configuration builder. |
| `ewhauser/eve-extensions` / `eve-agent-builder` | Experimental saved-agent domain, store, capability, runner, and publication workflow helpers. | Relevant control-plane reference; unreleased, EVE 0.91.0-specific, no visual builder or native project export. |

### Vercel's builder is available, but its UI is not established as reusable

The [official August 28 changelog](https://vercel.com/changelog/build-and-deploy-eve-agents-from-the-vercel-dashboard) documents its features and generated repository. The [public creation page](https://vercel.com/new/agent) currently asks what the agent should do and states that login is required before building. This research read the public page; it did not log in, create a project, or verify the entire authenticated flow. The [current product page](https://vercel.com/eve) shows instructions/model/channels/connections, consistent with the announcement.

No public reusable dashboard UI package was identified in the inspected framework package list. More concretely, [`src/internal/scaffold.ts`](https://github.com/vercel/eve/blob/main/packages/eve/src/internal/scaffold.ts) identifies itself as an internal Agent Builder integration and explicitly disclaims API stability. Its exports cover base-project creation and channel/connection mutation, not a comprehensive form schema, skills editor, or subagent editor. This proves shared scaffolding exists, but does not establish that Vercel's hosted UI can be embedded or copied from a supported package.

### Native EVE composition

The [CLI documentation](https://github.com/vercel/eve/blob/main/docs/reference/cli.md) and [package README](https://github.com/vercel/eve/blob/main/packages/eve/README.md) distinguish initialization from linking, browser authentication, and deployment. Initializing an agent is not itself production provisioning. The repository includes [templates](https://github.com/vercel/eve/tree/main/apps/templates) for chat, coding, company brain, Discord, council, Slack, voice, and personal agents. These are app starting points, not form-builder libraries.

[Extensions](https://github.com/vercel/eve/blob/main/docs/extensions/index.md) package tools, skills, subagents, instructions, channels, connections, schedules, and hooks. Their optional configuration uses Standard Schema; mounts add namespaces. This is a reusable capability-packaging mechanism, not a universal JSON representation of an agent. The extension root deliberately cannot own all runtime choices, including the parent agent's model/runtime configuration and sandbox.

The catalog's [`IntegrationEntry`](https://github.com/vercel/eve/blob/main/packages/eve-catalog/src/index.ts) distinguishes channels, connections, extensions, instrumentation, and memory, with `scaffoldable`, `registry`, and `gallery` flags. Its [`package.json`](https://github.com/vercel/eve/blob/main/packages/eve-catalog/package.json) marks `@eve/catalog` version `0.0.1` as private. Reuse the design idea or deliberately vendor compatible metadata; do not assume it is a supported npm dependency or that it describes arbitrary custom tools and subagents.

### evepad: useful UI source, different product architecture

The [author's README](https://github.com/andrewckor/evepad/blob/main/README.md) documents a community project, unaffiliated with Vercel, requiring macOS and Node 24+. It uses the Vercel/eve CLIs and OpenCode. The [package manifest](https://github.com/andrewckor/evepad/blob/main/package.json) reports version `0.10.2` (file modification August 30, 2026); its [license](https://github.com/andrewckor/evepad/blob/main/LICENSE) is Apache-2.0.

The [`app/build/page.tsx` source](https://github.com/andrewckor/evepad/blob/main/app/build/page.tsx) uses React Flow for tools, schedules, connections, and channels around the agent. Graph actions send editing prompts to a coding session; changes land in a local checkout. This is evidence for a useful visual inventory and edit affordances, not a schema-driven component export. Its inspected `AgentInfo` type does not contain skills or subagents. Porting the whole application would bring local filesystem/terminal/process assumptions into ChatJS; borrowing small patterns is more proportionate.

### Experimental saved-agent builder

The current [package README](https://github.com/ewhauser/eve-extensions/blob/main/packages/eve-agent-builder/README.md) describes an unreleased control plane targeting EVE 0.91.0, currently at PR 04 scope: PM → implementor → QA, immutable versions, owner-scoped stores, capability registry, and explicit publication. It expressly does not generate agent code or subagent directories. Saved-skill materialization and external invocation/triggers remain later work. Its deterministic-model evidence does not claim live-model obedience.

The [manifest](https://github.com/ewhauser/eve-extensions/blob/main/packages/eve-agent-builder/package.json) is version `0.0.0`, MIT-licensed, exposing domain/service/store/workflow/capability helpers and testing suites. The [domain source](https://github.com/ewhauser/eve-extensions/blob/main/packages/eve-agent-builder/extension/lib/domain.ts) is a relevant follow-up for saved-agent semantics, not an inspected drop-in UI. Search results still describe an older PR 02 foundation; the directly fetched current package README takes precedence.

### Avoid misleading matches

`Eldergenix/Eve-Agent-Builder` appears under an attractive builder name, but its inspected [README](https://github.com/Eldergenix/Eve-Agent-Builder/blob/main/README.md) reproduces EVE's framework introduction and Vercel links. It does not substantiate a distinct visual-builder product. Unrelated EVE games, crypto projects, and other agent frameworks were excluded.

EVE also has [local and remote self-modification](https://github.com/vercel/eve/blob/main/docs/guides/self-modification.md): a coding subagent can edit authored files locally or propose a draft PR remotely. This is useful for optional conversational editing later, but it is a different workflow from users deliberately assembling an agent through a form. Similarly, the [code extension](https://github.com/vercel/eve/blob/main/packages/eve-code/README.md) equips an agent for coding work; it is not an agent-configuration builder.

## Implication for ChatJS

Use the existing ChatJS registry as the selectable capability inventory. Add instructions, skill selection/authoring, and declared subagent configuration around it. Preserve native tool definitions and their schemas rather than translating them into an unrelated workflow graph. Export an inspectable EVE directory/package; treat preview as a separate capability whose behavior must be proven against the pinned runtime. These are recommendations based on the ecosystem findings and the parent investigation's supplied local context, not implementation results.

Before choosing dynamic saved configuration instead of generated source, verify the pinned fork's dynamic instructions/tools/skills/subagents contracts. Public current-main documentation is not compatibility evidence: inspected upstream `eve` is `1.0.0-rc.9`, while the parent investigation reports ChatJS pins `@chat-js/eve@1.0.0-rc.6-chatjs.1`. No installed package or live test was available in this research. [Current upstream package version](https://github.com/vercel/eve/blob/main/packages/eve/package.json)

Evidence was fetched from public official documentation and project-owned GitHub files on 2026-11-11. Branch links are mutable. The absence of a discovered embeddable builder is a bounded search finding, not proof that no such project exists.

## Addendum: the existing registry is the assembly mechanism

The initial recommendation understated EVE's ready-made installation layer. For the clarified question—one simple place to assemble existing EVE building blocks—the strongest starting point is a thin Create UI over **EVE's official registry and `eve add`**, supplemented by ChatJS-specific entries. Reimplementing each service integration is unnecessary. This is an architectural recommendation; no compatibility or execution test has been performed.

[Add Integrations](https://eve.dev/docs/install-integrations) documents official, namespaced third-party, and direct-URL installation; `registry list/search/view`; and skills.sh through `@skills`. Non-interactive installation emits NDJSON: exit 0 completes, 1 fails, and 2 requests input or a prerequisite. The final event gives the continuation command; non-secret answers use `--answer`, while secrets use environment variables or a secret store. A UI can collect answers and resume the installer. The generated files remain editable project code.

The inspected [official registry source](https://github.com/vercel/eve/blob/main/apps/docs/registry.json) contains 118 entries, including a hidden experimental alias—not 118 distinct public integrations. It supplies tools, extensions, memory providers, connections, channels, and instrumentation. Examples include agent-browser, browserbase, Linear, Notion, Slack, Discord, file memory, Supermemory, Braintrust, and PostHog. Item metadata declares title/description, packages, environment-variable placeholders, and file targets. Some items add `meta.eve.requires`, documentation links, install policy, or setup commands (`package`, `bin`, `args`). These are install manifests; they are not a complete universal configuration-form schema.

The [publishing guide](https://github.com/vercel/eve/blob/main/CONTRIBUTING.md#adding-an-integration-to-the-registry) requires source files and registry metadata, builds content into item JSON, and validates coverage/types. The underlying [shadcn item specification](https://ui.shadcn.com/docs/registry/registry-item-json) describes file/dependency distribution. Neither inspected specification declares every integration's configurable fields or an all-at-once form for them. Some configuration still means editing generated code or following provider-specific setup instructions.

For setup that supports the protocol, EVE already supplies generic question metadata: [`SetupWireQuestion`](https://github.com/vercel/eve/blob/main/packages/eve/src/setup/setup-question-wire.ts) represents confirm, text, sensitive environment-variable input, select, multi-select, and editable-select, with labels, hints, required/recommended values, and disabled/locked options. The [setup protocol](https://github.com/vercel/eve/blob/main/packages/eve/src/setup/registry-setup-protocol.ts) represents input/prerequisite blockers and completion facts. This supports an adaptive UI renderer rather than bespoke per-integration forms. These source types are internal evidence; consume the documented CLI behavior, version the adapter, and verify it against ChatJS's pinned fork instead of treating internal imports as stable APIs.

The resulting boundary is simple: ChatJS owns selection, instructions and declared-subagent editing, a workspace/job runner, generic setup-question rendering, preview/export, and any configuration the installer does not cover; EVE owns integration installation and supported setup. This approach requires a writable project and server/local process execution, not only a browser component. Existing app configuration can require manual composition, and third-party entries need not implement EVE's setup protocol. Preserve this fallback rather than claiming every registry item is fully configurable without code.
