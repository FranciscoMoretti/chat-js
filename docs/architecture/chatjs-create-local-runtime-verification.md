# Create → generated app local verification

Verified on 2026-10-26 without publishing packages. The local CLI and registry are built from the worktree, gateway/sandbox contracts are packed locally, and the generated apps live outside the monorepo. This catches missing template dependencies, installation drift, runtime initialization failures, and differences between Create's theme and the installed app that a source type check cannot catch.

## Repeatable commands

Use Node 24 and Bun. First run `bun dev:info --json` and start the site with `bun dev:site`. Set `CHATJS_CREATE_URL` to that worktree's `/create` URL.

The ignored `.env.worktree.local` must contain a loopback `DATABASE_URL` (or `CHATJS_NATIVE_POSTGRES_URL`) whose role can create disposable databases. The runner refuses remote hosts, creates a fresh `chatjs_native_*` database, runs the generated app's own `setup`, and drops only that database after stopping its server. It chooses an unused app port and creates fresh auth/EVE secrets; it does not write credential files into the generated app.

```bash
# Minimal Nova app, including a real AI Gateway response and reload persistence.
# Requires AI_GATEWAY_API_KEY in the ignored environment file.
CHATJS_NATIVE_SCENARIO=minimal \
CHATJS_NATIVE_RUNTIME=1 CHATJS_NATIVE_LIVE=1 \
CHATJS_KEEP_NATIVE_FIXTURE=1 \
CHATJS_CREATE_URL=http://localhost:3172/create \
bunx dotenv -e .env.worktree.local -- \
  bun --cwd packages/cli test:native-create b0

# Rhea/blue/Inter/small radius, default documents, uploads, OpenRouter, and S3.
CHATJS_NATIVE_RUNTIME=1 CHATJS_KEEP_NATIVE_FIXTURE=1 \
CHATJS_CREATE_URL=http://localhost:3172/create \
bunx dotenv -e .env.worktree.local -- \
  bun --cwd packages/cli test:native-create b27I2r8C
```

Omit `CHATJS_NATIVE_RUNTIME` for generation/add/sync/type checks only. Omit `CHATJS_NATIVE_LIVE` for startup and browser checks without making a model request. Omit `CHATJS_CREATE_URL` when the site is unavailable; this explicitly skips the cross-app comparison. Run cases sequentially: the local registry server temporarily points the scaffold's sandbox dependency at its contract tarball and restores the template manifest on exit.

Each preserved fixture contains the resolved native preset, generation/type logs, and `runtime/report.json` with screenshots. Runtime logs use owner-only file permissions. The runner forwards only the test case's AI Gateway key; it does not inherit deployment, shared workflow, or storage credentials.

# W8 verification update (26 October)

The matrix was rerun from current W5/W8 source. All three cases passed generation, exact native preset resolution, native Accordion addition, repeated sync with configuration byte preservation, standalone TypeScript, isolated setup, browser runtime, and Create theme/command parity:

| Scenario | Preset | Additional runtime evidence | Fixture |
| --- | --- | --- | --- |
| Minimal Vercel, no documents/uploads | `b0` (Nova) | Real response; transcript and existing-chat draft reload | `/tmp/chatjs-native-create-Pqnzm7/runtime` |
| Vercel with default documents, no uploads | `buFzURs` (Lyra, Tabler, Inter, square corners) | Real response, draft reload, real document creation and reopening after reload | `/tmp/chatjs-native-create-RZbV2l/runtime` |
| OpenRouter, S3 uploads, default documents | `b27I2r8C` (Rhea, blue, Inter, small radius) | Upload input/menu and installed documents; additional ChatJS uploads add | `/tmp/chatjs-native-create-iVDYHA/runtime` |

Every case also rendered all seven tool states, a zero result, an error, and native highlighted TypeScript through **the generated app's own imports**. Keyboard collapse/expand, exact code clipboard content, token colors, and mobile overflow passed. These captures use a test-only route written into the disposable fixture; it is absent from the shipped scaffold. Both light/desktop and dark/mobile captures are in each runtime directory. No uncaught browser errors remained in the final runs. All temporary servers stopped and no `chatjs_native_*` databases remained.

Run the additional case with the same environment and loopback database safeguards:

```bash
CHATJS_NATIVE_SCENARIO=documents \
CHATJS_NATIVE_RUNTIME=1 CHATJS_NATIVE_LIVE=1 \
CHATJS_KEEP_NATIVE_FIXTURE=1 \
CHATJS_CREATE_URL=http://localhost:3172/create \
bunx dotenv -e .env.worktree.local -- \
  bun --cwd packages/cli test:native-create buFzURs
```

The runtime harness uses a separate authenticated page for the activity fixture so navigating away does not abort pending conversation display requests. Setup, auth, and data remain local. Real model requests use only the explicitly forwarded AI Gateway key.

## Earlier W3/W4 results

| Case | Result |
| --- | --- |
| Minimal `b0` (Nova), Vercel gateway, no documents/uploads | Exact preset with no fallbacks; native Accordion add; repeated ChatJS sync with byte preservation; standalone TypeScript; generated database/EVE setup; dev login; actual model response; transcript and existing-conversation draft survive reload |
| `b27I2r8C` (Rhea, blue, Inter, small radius), OpenRouter/S3, uploads/default documents | Exact preset with no fallbacks; native Accordion + ChatJS uploads add; repeated sync with byte preservation; standalone TypeScript; generated database/EVE setup; dev login; uploads input and menu available |
| Both generated apps versus Create | Matching rendered background/foreground/primary colors and radius in light and dark modes; matching native `--preset`, `--base base`, `--no-rtl`, `--pointer` handoff; matching gateway/uploads/storage options; desktop light and 390px mobile dark screenshots; no horizontal mobile overflow; no uncaught browser or console errors |
| Cleanup | Both servers stopped and zero `chatjs_native_*` databases remained |

Final evidence directories for this run:

- `/tmp/chatjs-native-create-yH7VeU/runtime` — minimal; five automated captures plus a manual Chrome capture. The app/model picker was also reviewed in the user's Chrome profile.
- `/tmp/chatjs-native-create-1KS96E/runtime` — enriched; four automated captures.

The minimal app was generated immediately before removing the now-unused `use-stick-to-bottom` dependency. The enriched app was generated after that cleanup. Both include the new upstream message/scroller and composer composition.

## Scope boundaries

- OpenRouter completion and an actual S3 upload are not asserted: this case uses explicit non-secret placeholder credentials to exercise startup and installed UI. It does not claim either external service works.
- OAuth is not exercised; browser authentication uses the generated development-only `/api/dev-login` route.
- Unsent **new-chat** text currently does not survive a reload. Only an accepted creation intent is retained there. Existing-conversation drafts do persist and are covered by the live case.
- Create uses sample conversation/tool content, so theme and native command parity do not imply pixel-identical app chrome or full EVE behavior in the preview.
- The minimal case intentionally uses `--no-documents`; Create currently emits the CLI default document selection. The enriched case exercises that default.
- Publication, production deployment, and the deferred Radix base are outside this local verification.
