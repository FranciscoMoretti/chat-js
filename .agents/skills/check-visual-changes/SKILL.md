---
name: check-visual-changes
description: Check the visual impact of an edit mid-task with `uiverify check` — render just the components you're touching on the UI Verify fleet and diff them against the real CI baseline, without opening a PR, posting a check, or moving a baseline. Works for every capture method (Storybook, Playwright, Vitest archives, and raw screenshots). Use when a coding agent has changed UI and wants a fast, authoritative "would this pass" answer before pushing — "check my visual changes", "did I break anything visually", "preview this diff", "run uiverify check". Hands off to triage-visual-changes for the pixel review.
---

# Check your visual changes mid-edit

`uiverify check` is the **interactive preview build** — the agent edit-loop counterpart to the CI `uiverify upload`. You're mid-task, you've changed a component, and you want to know _now_ whether it changed anything visually and whether that change is intended — without opening a PR, waiting for CI, or touching a baseline.

It renders on the **same fleet** and diffs against the **same resolved CI baseline** a real build would, so the answer is authoritative (not a local macOS screenshot that won't match Linux). But it's walled off from CI:

- **No GitHub check** — invisible on the PR.
- **Never advances a CI baseline.** Accepting a preview build writes a branch-scoped _preview baseline_, so your own accepted change stops re-flagging on the next check, while CI's baseline is untouched.

A `changed` verdict exits 0 — it's the expected result to review, not a gate. Only a real `failed`/`blocked` or an operational error exits non-zero.

## The one rule: scope it to what you touched

This is the whole point, and it's the opposite of CI. CI computes the _transitive_ affected set from the dependency graph — editing one primitive can mark a third of the suite affected. That's correct for CI (it writes the baseline and can't under-render) but useless in an edit loop: it's slow, expensive, and drowns the signal you actually want.

So **you** choose what to render — the stories for the component you're editing, plus the specific places it matters, not everything the graph lights up. Under-scoping is safe here: a preview build is never a baseline, so the worst case is you didn't preview a story you didn't ask about, and the exhaustive CI build catches it later. Name the few things that matter.

## Prepare the capture, then check — per method

`check` is a **dumb HTTP client**: it uploads what you built or captured and asks the fleet to render it. It does **not** run your build or your tests for you — you prepare the capture input first, exactly the same input the matching capture skill produces (`storybook-visual-testing`, `playwright-visual-testing`, `vitest-visual-testing`), then point `check` at it.

Before upload, inspect the capture input for secrets, PII, and private customer content. Capture public pages or sanitized fixtures only; regenerate any unsafe archive or screenshot set before continuing.

`UIVERIFY_API_KEY` (a `uv_proj_…` project key) must be set. All four methods take `--strict`/`--no-strict` and `--working-directory` like `uiverify upload`.

### Storybook — `--target` is required

Storybook builds the **whole** suite (there's no single-story build), so you must name what to render. The build is monolithic; only the named stories actually render on the fleet.

```sh
npm run build-storybook            # or: storybook build --stats-json
uiverify check --static-dir storybook-static --target 'components-button--*' --target 'pages-checkout--default'
```

Pass `--target` per id; each is an exact story id (`components-button--default`) or an anchored glob (`components-button--*`). Render the component you changed **plus** the one or two pages where it actually appears — not the whole `components-*` tree.

### Playwright / Vitest archives — `--target` optional

Run **only the tests you care about** to produce the capture archive, then check it. The archive already contains just those captures, so the uploaded artifact _is_ the render set — no `--target` needed.

```sh
# Playwright: run only the specs you touched, producing the archive
npx playwright test tests/checkout.spec.ts
uiverify check --static-dir <archive-dir>

# Vitest browser-mode component tests: run only the touched files
npx vitest run src/components/Button.test.tsx
uiverify check --static-dir <archive-dir>
```

You _can_ still pass `--target` to narrow further (it matches the capture/test ids the SDK emitted, e.g. `--target 'checkout/*'`), but the usual discipline is "run the tests you want, then check the archive."

### Raw screenshots — `--target` optional

Upload exactly the PNGs you produced (native / mobile / React Native, or any surface we don't render). The upload is inherently scoped to the screens you took.

```sh
uiverify check --screenshots ./screenshots
```

Narrow with `--target` against the image path keys if you want (`--target 'settings/*'`), but it's optional.

## Read the verdict, then hand off to triage

`check` prints the changed-story list and an MCP handoff. When it comes back **changed**, don't eyeball the diff numbers alone — use the **`triage-visual-changes`** skill to review the actual pixels over the UI Verify MCP (`get_diff` / `render_diff_image`), bucket real regressions vs cosmetic reflow vs noise, and accept the baselines you mean to keep. Accepting establishes the branch-scoped preview baseline, so a re-run of `check` comes back clean for the change you just approved while a fresh change still flags.

Rule of thumb for the loop: **edit → `check` the few things you touched → triage the diff → accept what's intended → keep editing.** The exhaustive answer still comes from the real CI build on your PR; this is the fast, scoped preview that keeps you moving.
