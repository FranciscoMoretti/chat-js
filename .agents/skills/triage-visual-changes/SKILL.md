---
name: triage-visual-changes
description: Triage a UI Verify build from your coding agent via the UI Verify MCP — bucket a build's changed stories into real regressions vs cosmetic reflow vs rendering noise, summarize the real regressions for a PR comment, and accept baselines in bulk. Use after a UI Verify build reports changes and you want the agent to review, summarize, or accept from the terminal instead of clicking through the dashboard. Triggers - "triage this build", "summarize the visual regressions", "accept all the new baselines".
---

# Triage a UI Verify build from your agent

When a build comes back **changed**, the dashboard shows a triptych per story (baseline / candidate / diff). This skill does that review from your agent over the **UI Verify MCP** — read what changed, look at the pixels when a number is ambiguous, then summarize or accept.

## Connect the MCP (once)

The server is a remote Streamable-HTTP MCP at `https://uiverify.ai/api/mcp`, authed with your project's `uv_proj_…` API key as a Bearer token. **Add it as a real MCP server in your agent — don't hand-roll `curl` against the endpoint.** Over raw `curl` the image tools come back as MCP image blocks a shell can't render, so the pixels are useless to a script; a native client shows them to the model directly.

**Claude Code:**

```sh
claude mcp add --transport http uiverify https://uiverify.ai/api/mcp \
  --header 'Authorization: Bearer ${UIVERIFY_API_KEY}'
```

**Cursor** — add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "uiverify": {
      "url": "https://uiverify.ai/api/mcp",
      "headers": { "Authorization": "Bearer ${env:UIVERIFY_API_KEY}" }
    }
  }
}
```

Any other MCP client (Codex, Copilot, Gemini): point it at the same Streamable-HTTP URL with the `Authorization: Bearer` header. If a client can only reach it over HTTP by hand, prefer the `get_diff` tool (it returns downloadable image **URLs**) over `render_diff_image` (inline pixels) — see the tool table below.

Tools it exposes:

| Tool | Does | Key args |
| --- | --- | --- |
| `list_builds` | Recent builds + gate status, to find the one to inspect | `branch?`, `status?`, `limit?` |
| `get_build` | Lean triage of one build — the gate + `counts {total, changed, failed, unchanged}`, the AI tally, and the **first page (25)** of changed/failed stories (each with a `diffResultId`, diff %, and when AI review is on the judge's `aiVerdict`, `aiConfidence`, and for a regression `aiFlagReason` = its one-line "what looks unintended"), the page carrying a `nextCursor`. It does **not** dump the unchanged list — `counts.unchanged` is the signpost; page the rest with `list_build_stories` | one of `commitSha` / `prNumber` / `buildId` |
| `list_build_stories` | Page through one build's stories by status — the only way to browse the full changed / failed / **unchanged** set beyond `get_build`'s first page. `counts.unchanged` from `get_build` is the exact count it pages | selector, `status: changed \| unchanged \| failed`, `cursor?`, `limit?` (default 25, max 100) |
| `get_diff` | Per-story diff metrics + **presigned image URLs** (baseline / candidate / diff) you can download to a file or link straight into a PR; when AI review is on, the judge's full call: `aiVerdict`, `aiConfidence`, `aiSummary` (what changed), `aiReasoning` (why), `aiFlagReason`. Pass `storyId` to pull one story **even if it didn't change** — you get its current baseline URL, so you can show "identical to baseline" on a passed build | same selector, optional `storyId` |
| `render_diff_image` | The actual **pixels** of one image, inline for the vision model to look at (not a URL): `baseline` / `candidate` / `diff`, or `before_after` for a before-and-after crop zoomed to the changed region — one crop per region, stacked, when the story moved in several far-apart places (a header and a footer) | `diffResultId` (or `storyId` for a story that didn't change), `which` |
| `review_diff` | Record a decision on one story | `diffResultId`, `decision: accept \| deny \| ignore` |
| `accept_build` | Accept **every** changed story in a build at once | same selector |

## Recipe 1 — "Triage this build"

Bucket the changes so the human sees signal, not 60 rows. Call `get_build` for the PR — it carries the AI judge's call per story (`aiVerdict`, and for a regression the `aiFlagReason`) for the **first page** of changes; if `counts.changed` is larger than that page, keep paging `list_build_stories { status: "changed" }` on the `nextCursor` until it runs out, so no regression slips past the page boundary. **Read the judge before you form your own view, and for anything that actually changed content, adjudicate it against the before image, not in isolation:**

- **Render BOTH images, not just the diff.** `render_diff_image` `which: "baseline"` **and** `which: "candidate"` and compare them. The green diff mask tells you _where_ pixels moved, never _whether the result is good_ — a code block that went dark-on-dark, text that lost contrast, a control that's now clipped all look like "some pixels changed" in the mask and only reveal themselves as regressions in the before/after. Judging the candidate alone is how "it has colours now → improvement" passes an illegible block. Pull `get_diff` for the judge's `aiReasoning` / `aiFlagReason` on the ones it flagged.

Report in four buckets, with real story names and % deltas:

1. **Regression — a real change that's wrong** — content changed and the after is broken or worse: illegible/low-contrast text, clipping, overlap, missing content, a control that stopped reading as itself. **A regression the current PR _caused_ is still a regression** — "my diff explains it" says nothing about whether it's correct. Never accept these; they're the reason to triage.
2. **Intended change** — content changed and the after is correct and matches the PR's stated intent (a deliberate restyle, new copy, a genuinely new story). These still want a human eye, but they're accept candidates.
3. **Cosmetic reflow** — real diff pixels, but the diff image shows the _same_ content shifted a few px (a row moved down ~5px, text ghosted lower). Not a content change.
4. **Rendering noise — safe to accept** — sub-0.4% jitter on chart edges / anti-aliased lines. Pure render jitter.

**The judge's `regression` verdict is a reason to look harder, never to dismiss.** If you're about to call a story the judge flagged "intended anyway", you need a concrete reason from the before/after that refutes its `aiFlagReason` — not "it's a colour change, probably fine." When you can't refute it, trust it.

Example output shape:

> **67 changed stories → buckets.** **⚠️ Regressions (2)** — real changes that look wrong, do NOT accept: `SetupWizard/Playwright` (8.3%, code block now dark-on-dark / illegible — judge flagged `regression`), `Card/Compact` (5.1%, title clipped) … **Intended changes (11)** — content changed, looks correct, accept candidates: `Hero/Default` (14%, new headline copy), … **Cosmetic reflow (9)** — real pixels, vertical shift only: `EventStatusCard/All Variants` (4.1%, rows shifted ~5px), `TestingInit/Playground` (3.7%), … **Chart anti-aliasing noise (6)** — sub-0.4% edge jitter, safe to accept: `FunnelChart/Smaller Screen` (3.2%), `UpliftChart` (single 1px mark), … **New stories (12)** — first baseline, nothing to compare: `Button/AllVariants`, …

Never accept from inside the triage step — surface the buckets and let the human decide, or do it explicitly in recipe 3.

## Recipe 2 — "Summarize the visual regressions"

Same read, but output the changes that need a human — the ⚠️ regressions first, then the intended content changes — in a PR-comment shape, one line each, no reflow/noise. This is the comment to drop on the PR:

> 🔎 **Visual review — 1 regression, 2 intended** (of 67 flagged; 64 reflow/noise, listed below the fold)
>
> - ⚠️ `SetupWizard/Playwright` — code block dark-on-dark, illegible (8.3%, judge: regression)
> - `Pricing/Card` — CTA button color changed blue→green (12.4%)
> - `Nav/Header` — logo 8px larger (3.1%)

## Recipe 3 — "Accept all the new baselines"

When the changes are all intended (a deliberate restyle) or all noise **and you've confirmed no regression is hiding in the list** (bucket ⚠️ empty), advance every changed story's baseline in one call:

```
accept_build { prNumber: 123 }
```

Don't let "the headline change is intended" halo onto the whole build — a global CSS or theme change sweeps into stories the PR never meant to touch, and "the PR caused it" is not "the PR intended it." Each changed story earns its bucket on its own before-and-after.

For a targeted accept (some real, some not), loop `review_diff` per `diffResultId` with `accept` / `ignore` / `deny` instead — accept the intended ones, ignore the noise, leave real regressions for a human.

## Recipe 4 — "Put the before/after in the PR"

Keep the human in the PR instead of sending them to the dashboard. After you've triaged, post the changed stories inline:

- **The fastest single image:** `render_diff_image` `which: "before_after"` gives you one PNG, before and after side by side, cropped to the changed region (one crop per region, stacked, if the story moved in several far-apart places) — the least to eyeball. Save it and attach it.
- **Downloadable files / durable links:** `get_diff` returns presigned `baselineUrl` / `candidateUrl` / `diffUrl`. Download them (`curl -L "$url" -o before.png`) to attach to the PR, or drop the build link and the URLs into a comment. Always include the build link (`https://uiverify.ai/builds/<id>`) so the reviewer can open the full triptych.

A good PR comment: the one-line-per-regression summary from Recipe 2, the before/after image for the regressions, and the build link. Post it, don't make them go looking.

## Passed build? You can still show the pixels

A build with no changes shows no triptych — but the components still rendered, and "nothing changed" is only trustworthy if you can see it. **Enumerate the unchanged set** with `list_build_stories { status: "unchanged" }` (page it on the returned `nextCursor`), then pull any story's current image by id: `get_diff { buildId, storyId }` for its baseline URL, or `render_diff_image { storyId, which: "baseline" }` for the pixels. Use it to confirm a component looks right on a green build, or to hand the reviewer "here it is, identical to baseline" without opening the dashboard.

## Guardrails

- **Read before you write.** Always `get_build` (and `render_diff_image` for anything ambiguous) before `review_diff` / `accept_build`. Don't accept a build you haven't looked at.
- **Compare before-and-after, never the after alone.** For any story that changed content, render `which: "baseline"` AND `which: "candidate"` and look at both — the diff mask shows where, the pair shows whether it got worse (contrast/legibility, clipping, layout). "It has colours / it moved" is not "it's better."
- **The AI judge's `regression` is a signal to trust by default.** Overriding it needs a concrete reason from the before/after that refutes its `aiFlagReason`, not a hand-wave. Attributable-to-this-PR is not a reason to dismiss it.
- **Bulk-accept is a baseline change.** `accept_build` makes the candidate the new truth for every changed story — only reach for it when you've confirmed there's no real regression hiding in the list.
- **Distinguish "new story" from "changed story."** A first-baseline story has nothing to diff; it's not a regression, just needs a baseline. Bucket it separately.
