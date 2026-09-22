# EVE visual verification follow-up — 2026-09-22

The focused local browser checks passed. No additional product defect was demonstrated in the reviewed headers, projects/sidebar, documents or loading states. Hosted verification remains blocked by a confirmed capture-project mismatch, not an unexplained render error.

Implementation: `80e5b6364c62262f29a240f6f495730e05854caa`. Main UI reference: `4584f093835f1667c010c8fc20c502fa3f2bde41` (the same reference as the original audit; not a claim about the latest remote main).

## Hosted failure root cause

The available `UIVERIFY_API_KEY` belongs to the ChatJS **Vitest** project, whose existing baseline is the documentation suite.

1. The original raw-screenshot check failed before processing any images. The dashboard explains: “The uploaded bundle is in screenshot format, but this project expects archive format.” CLI 1.4.2 prints “Bundling Storybook” unconditionally, even when its screenshot bundler was correctly selected. That log line did not identify the cause.
2. A one-image, sanitized reproduction with CLI 1.6.0 failed identically, both without targets and with an explicit `conversation-loader` target. [Reproduction build](https://uiverify.ai/builds/01a0ca0e-43cf-718d-9276-85d2ad66f460), [explicit-target build](https://uiverify.ai/builds/01a0ca0e-c6a2-7136-b40f-a9f0b1f0dd2a).
3. Capturing real DOM/resource archives with the official `@uiverify/playwright@1.1.0` SDK corrected the format. Registration then rejected the SDK/project mismatch explicitly: “This is a vitest project, but you uploaded with the @uiverify/playwright SDK.”

The correct remaining setup is a **separate Playwright visual project and project key** for the chat application, followed by archive upload with `uiverify check --static-dir <archive-directory>`. Keep the existing Vitest project/key for docs. Changing its type would disrupt the existing suite; stripping or falsifying the archive's producer would hide the incompatibility. Neither was done. No baseline was accepted or modified.

The CLI and SDK trials were installed in temporary tooling directories; repository dependency manifests and the deliberately pending EVE release lockfile were left unchanged. Once the project exists, wire the Playwright SDK into the retained chat capture tests and add it through the normal dependency workflow. The one-off archives establish the compatible capture format; they are not a deterministic CI baseline (test titles, relative timestamps, history and model output vary).

## Local verification

All tests used isolated local databases (`chatjs_visual_test`, `eve_visual_test`) and the worktree's discovered port 3150. The source app/database were not changed. The reference main checkout used its existing isolated audit database and port 3070.

Six distinct browser scenarios passed:

- Document completion opens once; replay/history and an existing panel retain their intended behavior.
- Document tool loading/error states fit desktop and mobile widths.
- Native documents, manual saves, revision history, reload and shared access.
- Header rename/pin optimism and rollback, project breadcrumb, mobile sharing and public header.
- Restoring a saved chat shows a spinner without visible runtime wording, then the composer.
- Project instruction/name editing, native conversation creation, history after reload and cleanup.

The first launch accidentally resolved Node 20 from the shell. Four tests stopped at `Promise.withResolvers`, and lint stopped at `Set.union`. Running the repository's required Node 24 fixed those environment errors without changing application or test code. The corrected focused run passed 5/5; the separate document replay scenario had already passed. Root lint and all seven type-check tasks passed under Node 24. Next MCP reported no compilation issues, configuration errors or session errors. The live browser also exposed the expected React component tree.

Reproduce from a configured worktree with Node 24 on `PATH`:

```sh
bun dev:info --json
bun dev
# In another terminal, with the same Node 24 PATH:
bun x dotenv -e .env.worktree.local -e .env.local -- bun run worktree-env chat -- sh -c 'cd apps/chat && bun x playwright test --config playwright.eve-ui-parity.config.ts eve-loading.e2e.ts eve-header-parity.e2e.ts eve-project-ui.e2e.ts eve-document-auto-open.e2e.ts eve-document-tools.e2e.ts'
bun lint
bun test:types
```

## Visual evidence and limits

The paired captures use Chromium, light theme, 1440×1000 desktop and 390×844 mobile viewports, and the same project title/instructions and chat title. Development overlays were hidden. The header comparison concerns the header/menu region: main contains a seeded user message while EVE also has a generated reply and suggestions. Composer model preferences differ. These are not whole-page pixel-equality comparisons.

| Surface | Main reference | EVE candidate | Assessment |
| --- | --- | --- | --- |
| Desktop header/menu | [Main](verification-2026-09-22/main-header-desktop.png) | [EVE](verification-2026-09-22/eve-header-desktop.png) | Same menu actions, header controls and layout structure. |
| Mobile header/menu | [Main](verification-2026-09-22/main-header-mobile.png) | [EVE](verification-2026-09-22/eve-header-mobile.png) | Rename, Pin, Share and Delete remain readable; docs/GitHub actions fit. |
| Desktop empty project | [Main](verification-2026-09-22/main-project-desktop.png) | [EVE](verification-2026-09-22/eve-project-desktop.png) | Matching title/edit/instructions, composer and empty-state card. Minor vertical offset; differing selected model. |
| Mobile empty project | [Main](verification-2026-09-22/main-project-mobile.png) | [EVE](verification-2026-09-22/eve-project-mobile.png) | Matching wrapping and controls; no horizontal clipping. |
| Sidebar search | Existing main source contract | [EVE](verification-2026-09-22/eve-sidebar-search.png) | Projects/Chats groups, query input, date group and loaded results are visible. |
| Native code document | Existing main source contract | [EVE](verification-2026-09-22/eve-document-code.png) | Settled code editor, Run/version/copy controls and original chat context. |
| Mobile historical document | Existing main source contract | [EVE](verification-2026-09-22/eve-document-mobile.png) | Readable content, version actions and Restore/Back to latest footer fit. |
| Conversation loading | Requested spinner behavior | [EVE](verification-2026-09-22/eve-loader.png) | Centered spinner; no “Restoring conversation” wording. |

All linked images were inspected. The sidebar and document captures supplement functional tests and the original source audit; they are not new paired main/EVE fixtures. No hosted pixel-diff pass is claimed. Remaining work is project/key provisioning, reproducible SDK capture integration, and review of the first legitimate hosted chat baseline.
