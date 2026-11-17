# EVE registry installation experiment

Tested 2026-11-11 against ChatJS commit `4fc8f8cee`. This supplements the [builder research](./create-agent-builder-research.md) and [static semantic review](./eve-registry-semantic-compatibility.md). No application source in the working checkout was changed.

## Result

EVE already supplies the common assembly mechanism: its registry and `eve add`. Five representative official items installed into freshly generated ChatJS apps, passed TypeScript, were accepted by EVE discovery, and compiled with the pinned ChatJS EVE fork. A combined app containing all five also passed. No upstream runtime upgrade was needed for this sample.

Installation compatibility is stronger than previously established, but it is not full application compatibility. Small local execution probes confirmed gaps in native result rendering, tool-selection policy, Slack session identity, and memory backend selection. External services were not exercised.

The practical direction is an Agent tab over EVE's catalog/setup protocol, with a common ChatJS integration layer. We do not need to reimplement Slack transport, browser tools, Notion's connection definition, or the memory provider.

## Environment and method

- Archived committed source into a disposable directory; the active checkout and its dependencies were untouched.
- Used Bun `1.3.11`, Node `24.20.0`, and the repository's native Create selection test. The generator created a real standalone app, added a shadcn component, ran ChatJS sync twice, verified preservation, and passed standalone TypeScript.
- Selection: Vercel gateway; feedback, projects, and Langfuse plugins; word-count tool; memory storage. No sandbox provider selected.
- Runtime stayed `eve: npm:@chat-js/eve@1.0.0-rc.6-chatjs.1`. Inspected upstream CLI was `eve@1.0.0-rc.9`.
- Installed each item into a separate clone and then all five into one clone. Ran `tsc --noEmit`, `eve info --json`, and `eve build --skip-sandbox-prewarm`.
- The EVE build compiles/packages the agent. It is not a Next.js production build, deployment, live model turn, or service integration test.
- Used dummy application secrets and an unreachable database URL. No OAuth grants, project linking, service provisioning, deployment, Slack messages, or live browser sessions were performed. Setup detected the existing local Vercel login; no credentials were emitted in the evidence.
- Native Create uses a temporary loopback registry for local package tarballs. It is a fixture detail, not a proposed production dependency source.

## Installation matrix

| Official item | Files/dependencies added | Verified result | Remaining setup/runtime work |
| --- | --- | --- | --- |
| `tool/web_fetch` | `agent/tools/web_fetch.ts`, re-exporting `eve/tools/web_fetch`; no new dependency | Install, types, discovery, build pass; tool discovered | Common selection/accounting policy; no live fetch performed |
| `connection/notion` | `agent/connections/notion.ts`; `@vercel/connect` resolved to `2.9.1` | Install, types, discovery, build pass | Setup reports project-link prerequisite; Connect provisioning, user consent, and authenticated tool discovery remain untested |
| `channel/slack` | Initial registry install adds `@vercel/connect`; portable setup writes `agent/channels/slack.ts` and environment placeholders | Portable setup, types, discovery, build pass; Slack route discovered | Credentials, Slack app configuration, deployment, and ChatJS identity integration |
| `extension/agent-browser` | `agent/extensions/browser.ts`; `@eve/agent-browser@0.1.0-rc.1` | Install, types, discovery, build pass; **42 browser tools** discovered | A process sandbox with browser/system dependencies; native output rendering |
| `memory/file` | `agent/memory/file.ts`; no new dependency | Install, types, discovery, build pass; explicit in-memory backend executed successfully | Durable backend provisioning/configuration, scope and retention decisions |
| All five together | Combined dependencies and files | Types, discovery, build pass; diagnostics report zero errors/warnings | Same application-level work above |

`eve info` is a static capability inventory. The app's dynamic model/tool definitions and runtime connection tools are not all listed there; an empty static field is not evidence that they were removed. The original root agent, web channel, sandbox module, and Next.js configuration were byte-for-byte unchanged in the combined fixture.

The browser package's compiled extension declares `builtWithEve: 1.0.0-rc.7`; the pinned rc.6 ChatJS fork actually accepted it. This verifies this artifact/compiler combination, not arbitrary future release compatibility. Builds emitted an optional `pg-native` trace-resolution warning already present in the baseline.

As a narrow upstream comparison, rc.9's CLI reinstalled Notion with `--overwrite` into the combined pinned-fork app. It succeeded, produced **no file changes**, and retained the fork dependency. The experiment did not replace the runtime or certify rc.9 as a ChatJS upgrade.

## Setup is already machine-drivable

The [documented installer](https://eve.dev/docs/install-integrations) supports `--non-interactive`, returning structured setup events and a continuation command. Exit `2` means input or a prerequisite is needed; it is not an installation failure. This protocol was exercised using the pinned fork:

1. Slack requested a `slack-credentials` choice between Vercel and portable credentials.
2. Continuing with `--answer 'slack-credentials="portable"'` wrote the channel and `.env.example` entries. Completion reported `deploymentRequired: true` and `eve deploy` as the next step. We stopped there.
3. Notion and file-memory setup requested `eve link`. We stopped before linking or provisioning.

Important distinction: current `channel/slack` registry JSON has no source files of its own. `--skip-setup` installs its dependency but does **not** create a working Slack channel. The setup continuation creates that file. A builder should track installed, configured, connected, and deployed status separately.

The portable Slack instructions print the generic `/eve/v1/slack` route. This ChatJS app explicitly mounts `agents: { chat: "." }`; the pinned Next.js documentation says named mounts use `/eve/<name>/v1/*`. Its public webhook configuration should therefore use `/eve/chat/v1/slack`. This is a static routing inference, not a live webhook verification.

## Application compatibility: confirmed gaps

A disposable Node/tsx probe executed seven assertion groups against the generated app and pinned runtime:

1. **Slack identity:** a native Slack authenticator is not a ChatJS account session, and the generated app's empty session-profile registry rejects it. Choose a separate Slack profile/agent or implement verified account mapping and conversation binding. Renaming the authenticator alone is insufficient.
2. **Native result dispatch:** names such as `notion__search`, `browser__screenshot`, and `file__save_memory` are classified as MCP by ChatJS's parser. Native output lacks the `chatjs.mcp-result` envelope expected by that renderer. The real memory save result also failed this envelope validation. Static component inspection confirms this becomes a false failure display; no browser screenshot test was run.
3. **Tool usage receipts:** a native MCP-style result does not carry ChatJS's tool-cost receipt. Static accounting code therefore records no tool charge. Existing root-model accounting remains intact; service/sandbox costs need an explicit policy.
4. **Tool availability:** the installed-tool middleware left foreign native tool names unchanged. Registry additions do not automatically inherit the current ChatJS selection restrictions.
5. **Browser prerequisite:** the tested Create selection exposes `supportsPersistentSandbox === false`. Compilation succeeds, but browser execution needs a suitable selected sandbox and browser dependencies.
6. **Memory backend:** `fileMemory()` without configuration rejected recall outside Vercel and EVE dev, requiring an explicit backend.
7. **Memory functionality:** `fileMemory({ backend: inMemory() })` successfully saved and recalled a fact across separate session contexts within the process. This proves the local provider path, not persistence across restarts.

The [semantic review](./eve-registry-semantic-compatibility.md) links the exact ChatJS boundaries. Web users already have stable principal identity that Connect can use; a new identity system is not inherently necessary for Notion. Connect grants remain separate from ChatJS's existing MCP grants, and its real consent/resume UI still needs a live check.

## Minimum builder scope

Reuse EVE for registry discovery, generated integration files, dependency installation, supported setup questions, and channel/tool execution. Build these ChatJS pieces:

- A catalog/selection UI and persisted integration choices in Create's export contract.
- A workspace installer runner and generic setup-question/continuation UI. Some providers will retain manual steps; registry metadata is not a universal configuration-form schema.
- Shared native-tool selection and output dispatch, plus an explicit policy for service costs.
- Channel-specific account/session mapping, starting with Slack; use the actual named public routes.
- Provider prerequisites for sandboxes/memory, then live verification of credentials, consent, and representative execution.

A catalog/export builder is materially smaller than implementing each integration. Full live preview, arbitrary code authoring, and production publish/version management remain separate features. This experiment supports the integration approach; it does not justify an exact delivery estimate.

## Reproduction and evidence

Disposable fixture root: `/tmp/chatjs-eve-compat-qgs7m2n2`. Baseline generated app: `/tmp/chatjs-native-create-aISCt0/app`. Evidence includes registry item snapshots, before/after package manifests, file differences, individual command outputs/exit codes, combined discovery/build output, and semantic probes. Temporary paths may be cleaned by the host.

Representative commands from an already generated app, using its installed EVE binary:

```sh
bunx --no-install eve add tool/web_fetch --skip-setup --non-interactive
bunx --no-install eve add connection/notion --skip-setup --non-interactive
bunx --no-install eve add channel/slack --skip-setup --non-interactive
bunx --no-install eve add extension/agent-browser --skip-setup --non-interactive
bunx --no-install eve add memory/file --skip-setup --non-interactive
bunx --no-install eve add channel/slack --skip-install --non-interactive --answer 'slack-credentials="portable"'
bunx --no-install tsc --noEmit
bunx --no-install eve info --json
bunx --no-install eve build --skip-sandbox-prewarm
```

Actual harness invocations used the absolute Node 24 binary and local CLI entry points to avoid the machine's default Node 22. No root-repository lint/type run was needed for these Markdown-only additions; types and agent compilation were exercised in every generated fixture.
