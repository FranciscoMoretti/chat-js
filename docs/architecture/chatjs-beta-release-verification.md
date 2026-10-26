# ChatJS beta release verification — 26 October 2026

The user authorized prereleases only: no major bumps and no stable promotion. Descriptor `contractVersion: 2` remains the Base UI compatibility boundary; it is not an npm major version.

## Release correction

The release attempt incorrectly submitted registry `2.0.0` and CLI `1.0.0`. The user explicitly authorized withdrawing both. npm accepted unpublishing them and the registry stable tag was restored to `0.1.2`. The original CLI publication finished processing after the first withdrawal; its now-public `1.0.0` was then explicitly unpublished again. Subsequent verification must check both version absence and stable tags, not just the unpublish command's exit status.

Stable targets remain CLI `0.8.0` and registry `0.1.2`. Gateway and sandbox contract packages `0.2.0` were published and their public integrity hashes matched the audited archives. No production site deployment was promoted.

## Beta release artifacts

Both package manifests default `publishConfig.tag` to `beta`; publication also passes `--tag beta` explicitly. The website's generated command uses `@chat-js/cli@beta`. Generated applications pin `https://unpkg.com/@chat-js/registry@0.2.0-beta.0/dist/r/{name}.json`, preserving existing applications' configured namespaces.

| Package | Version | Audited archive SHA-256 |
| --- | --- | --- |
| `@chat-js/cli` | `0.9.0-beta.0` | `7ed627cfb6e1a4058da9be7f49170dc3511cf84d441bfe12dcb85fe108ada9d5` |
| `@chat-js/registry` | `0.2.0-beta.0` | `ed324ab8c26091315c5935ea1a39b75f7963cfe29ebdf4238e133a6873c362b4` |

Archives are in `/tmp/chatjs-beta-release`. The audit inspected 1,117 files with no findings: no environment files, credentials, build/test artifacts, or workspace-only public dependency specifiers. Native activity/composer sources match the scaffold. Both betas are public under `beta`; public SHA-512 integrity matches the audited archives. Cache-busted registry checks confirm CLI `1.0.0` and registry `2.0.0` are absent, with stable latest still CLI `0.8.0` and registry `0.1.2`. Machine-readable evidence: `/tmp/chatjs-beta-public-integrity.json`.

## QA findings and fixes

1. A deployed production build reproduced a history race: choosing a theme immediately after Undo could retain the discarded Redo branch. The history hook now ignores only an acknowledgment matching its selected history entry, rather than dropping the next update unconditionally. The browser test makes the immediate edit and verifies Redo clears.
2. A stronger capture check found the loading overlay could remain after browser Back/Forward restored an already-hydrated iframe. The host now requests another readiness acknowledgment; the preview responds only to messages from its same-origin parent. The test verifies the rendered preview is visible and the loading overlay is gone.
3. Browser checks now accept `CREATE_BASE_URL` and an optional `CREATE_STORAGE_STATE` file for protected deployments. Secrets remain outside the repository. The visual capture script explicitly finalizes its archive index so newly added stories are included.

CLI unit tests: 323 pass. Create installation-model tests: 3 pass. Create activity/history suite: 6 pass, including eight styles and five icon libraries. Lint and all nine workspace type checks pass. Existing Create interactions, failure/retry and in-flight updates were exercised locally and against Vercel previews. One remote lifecycle run timed out at five seconds during rapid scene changes; the isolated rerun passed, so that timeout remains recorded rather than hidden.

The final full deployed suite passes. Remote lifecycle/recovery waits now allow 15 seconds, matching the preview recovery window; assertions remain intact. A separate deployed check verifies history branching and restored-preview readiness.

The new history capture covers only the affected host toolbar; iframe content has separate preview-route captures. Local screenshots retain the complete rendered page. The [final UI Verify build](https://uiverify.ai/builds/01a17971-b5fa-7443-9dce-47023f46ab31) has one new toolbar capture, reviewed with zero rendering failures. No UI Verify baseline was accepted or changed.

## Public consumer verification

Using a fresh Bun cache, the public `bunx @chat-js/cli@beta create` command generated `/tmp/chatjs-native-create-pUPcCj/app`, without local registry or package overrides. The native preset resolves exactly to `buFzURs` (Base Lyra, Tabler), and the generated namespace pins registry `0.2.0-beta.0`. Adding the native accordion and running public CLI sync twice preserve customization. The standalone type check passes. Evidence: `/tmp/chatjs-beta-public-create.log`.

That same app passes browser runtime checks with real AI Gateway chat and persisted document reopening, using an isolated local database. Evidence: `/tmp/chatjs-beta-public-runtime-final.log` and `/tmp/chatjs-native-create-pUPcCj/runtime`. The first run completed the behavior but recorded an aborted background tRPC fetch at an intentional reload. The harness now waits for those queries to settle before testing reload persistence; it still fails on console errors. The rerun passes, and temporary app/database resources are cleaned up.

## Deployment and remaining coverage

Preview deployments use an isolated source copy with local environment files and symlinks excluded. A mistaken Vercel command briefly created a separate `chat-js-1` project; the upload was canceled and that new project was removed. The existing `chat-js-site` and `chat-js-app` production deployments were not changed.

The verified [Create preview](https://chat-js-site-evyvje601-francisco-morettis-projects.vercel.app/create) includes the history/readiness fixes and beta install command. Manual QA in the user's Chrome confirmed the tools scene and command dialog. Screenshots are in `apps/site/uiverify-screenshots/create-beta-preview-chrome.png` and `create-beta-command-chrome.png`. This is a preview deployment only; production promotion remains pending.

The temporary automation bypass created for protected-preview QA was revoked after verification, without generating a replacement. Temporary credential and browser-cookie files were removed; normal deployment protection remains in place.

The Vercel development environment has OAuth credentials but no OpenRouter/S3 credentials. Real OpenRouter completion, S3 transfer and OAuth browser sign-in are still unverified. These are separate provider-coverage gaps, not prerequisites for verifying this UI work; the user explicitly confirmed that any working gateway/storage combination is sufficient. UI integration uses AI Gateway and private Vercel Blob. W8 already verified real AI Gateway chat and persisted document reopening in disposable local apps. Full Base UI/Radix support remains W9.

## UI verification follow-up

The remaining attachment integration suite passes all five tests (37.1 seconds) against a fresh app generated by the public beta, using AI Gateway, private Vercel Blob and the Vercel persistent sandbox provider. Fixture: `/tmp/chatjs-native-create-iANaLn/app`; final log: `/tmp/chatjs-public-upload-verified.log`. Generation uses native preset `buFzURs`, with native add/repeated sync preservation and standalone types verified again. The app runs with `bun dev:supervise` and an isolated loopback database.

Verified behavior:

- Real image upload, model recognition, transcript display and opening the decoded image.
- Removing/replacing attachments, sending multipart messages, editing with the original attachment retained, and reloading during a response.
- Failed creation retains the attachment summary and retries the identical request after reload.
- Stored bytes have authenticated ownership; foreign attachments are rejected.
- An orphaned file stops serving before physical deletion.

The suite needed updates for existing application behavior: signed storage URLs replace the old `blob:` assumption; logical chat IDs resolve through the active conversation before querying file references; failed creation uses the dedicated recovery screen. Cleanup subprocesses now close their PostgreSQL pool and have a bounded timeout instead of hanging after successful deletion. Product UI source was not changed. Lint, all nine type tasks and `git diff --check` pass.

The original local Blob token referred to a public store and failed the private adapter's upload. The existing Vercel development token passed a private write/delete probe and now overrides the stale token only in ignored `.env.worktree.local`. Remote configuration is unchanged. All test files, two allocated sandboxes and the isolated database were cleaned up. Temporary pulled credential files were removed. Screenshots in the fixture's `tests/eve-results/screenshots` were inspected.

**Resolved locally: uploads require a persistent sandbox.** The no-sandbox fixture `/tmp/chatjs-native-create-pIcXBG/app` confirmed EVE could store an upload but could not stage it for the model. The agreed fix enforces the existing provider contract instead of introducing sandbox-free delivery. Create now includes `--sandbox-provider vercel` when uploads are enabled, explains the credential requirement, and preserves the dependency across shared links. CLI planning validates `supportsPersistentSandbox` in selected registry source or installed source without executing application code. Missing or incompatible providers are rejected, including provider replacement in apps with existing upload plugins. Existing v1 upload descriptors retain the requirement by built-in ID. The theme/preset forwarding contract is unchanged.

Verification: planner regression reproduced the missing rejection before the fix; requirement, prompt and Create handoff tests pass. A fresh local package/registry installation at `/tmp/chatjs-native-create-trfBsh/app` passed native preset resolution, shadcn add, attachment re-add, repeated sync preservation and standalone types. The complete runtime attachment suite above remains the evidence for the unchanged sandbox-enabled runtime. No package versions or dist-tags changed, and no production deployment was promoted. Published beta.0 does not yet contain this CLI enforcement.

Final checks for the dependency fix: 316 CLI tests, 185 registry tests, four Create model tests, `bun lint`, and `bun test:types` passed. Full Create browser behavior passed on rerun, including link restoration, toggling uploads, copied commands, mobile layout and preview failure recovery. The first full UI run timed out waiting for recovery; the unchanged recovery check passed on rerun. The first CLI suite used newer system Node and failed on a deprecation-warning assertion; all 316 passed under Node 24.

[UI Verify installation review](https://uiverify.ai/builds/01a179a7-5050-7524-ad87-216e01f21a00) rendered both desktop and mobile captures with zero failures. These are two new archive capture IDs, so there is no prior baseline for this focused pair. Both fleet images were inspected: dependency copy is readable, controls fit, and the mobile dialog scrolls. Existing baselines were not accepted or changed. Next.js reports no configuration or browser-session errors. The initial raw screenshot upload used the archive project's wrong format; the linked archive check supersedes that failed upload.
