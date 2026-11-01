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

Single quotes keep `${UIVERIFY_API_KEY}` a reference that Claude Code expands each time it connects, so the key itself is never written into its MCP config.

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

Set `UIVERIFY_API_KEY` in the environment inherited by Cursor when it starts. Keep the `${env:UIVERIFY_API_KEY}` reference in the JSON; Cursor expands it at runtime, so the key itself stays out of both project and global configuration files.

Any other MCP client (Codex, Copilot, Gemini): point it at the same Streamable-HTTP URL with the `Authorization: Bearer` header. If a client can only reach it over HTTP by hand, prefer the `get_diff` tool (it returns downloadable image **URLs**) over `render_diff_image` (inline pixels) — see the tool table below.

Tools it exposes:

| Tool | Does | Key args |
| --- | --- | --- |
| `list_builds` | Recent builds + gate status, to find the one to inspect | `branch?`, `status?`, `limit?` |
| `get_build` | Lean triage of one build — the gate + `counts {total, changed, failed, unchanged}`, a build-wide `comments {total, unresolved}` review-comment tally, the AI tally, and the **first page (25)** of changed/failed stories (each with a `diffResultId`, diff %, and when AI review is on the judge's `aiVerdict`, `aiConfidence`, and for a regression `aiFlagReason` = its one-line "what looks unintended"), the page carrying a `nextCursor`. It does **not** dump the unchanged list — `counts.unchanged` is the signpost; page the rest with `list_build_stories`. `comments.unresolved > 0` means a human/agent left an open note — read it with `list_comments` before you accept | one of `commitSha` / `prNumber` / `buildId` |
| `list_build_stories` | Page through one build's stories by status — the only way to browse the full changed / failed / **unchanged** set beyond `get_build`'s first page. `counts.unchanged` from `get_build` is the exact count it pages. Every changed-story row (here and in `get_build`) carries its own `comments {total, unresolved}` | selector, `status: changed \| unchanged \| failed`, `cursor?`, `limit?` (default 25, max 100) |
| `get_diff` | Per-story diff metrics + **presigned image URLs** (baseline / candidate / diff) you can download to a file or link straight into a PR; when AI review is on, the judge's full call: `aiVerdict`, `aiConfidence`, `aiSummary` (what changed), `aiReasoning` (why), `aiFlagReason`; and a per-story `comments {total, unresolved}` (same signpost as `get_build`, scoped to the one story). Pass `storyId` to pull one story **even if it didn't change** — you get its current baseline URL, so you can show "identical to baseline" on a passed build | same selector, optional `storyId` |
| `render_diff_image` | The actual **pixels** of one image, inline for the vision model to look at (not a URL): `baseline` / `candidate` / `diff`, or `before_after` for a before-and-after crop zoomed to the changed region — one crop per region, stacked, when the story moved in several far-apart places (a header and a footer). When the story has an unresolved review comment, a text note saying so comes **before** the image | `diffResultId` (or `storyId` for a story that didn't change), `which` |
| `get_pr_changeset` | The **cumulative** "This PR vs base" changeset: what the _whole pull request_ did to the UI vs the branch it merges into — `new` / `changed` / `removed` stories, each with review status (and the judge's verdict when AI review is on), plus `counts {new, changed, removed, unchanged}` and the **first page (25)** of each list. **Distinct from `get_build`**, which is one commit's gate: this survives in-PR accepts **and** merge, and catches an added-then-accepted story and a **removed** one that no single build's diff can see | one of `commitSha` / `prNumber` / `buildId` |
| `list_pr_stories` | Page one bucket of the PR-vs-base changeset beyond `get_pr_changeset`'s first page | selector, `kind: new \| changed \| removed`, `cursor?`, `limit?` |
| `review_diff` | Record a decision on one story. `accept` and `ignore` are **refused** while the story has an unresolved review comment; `deny` always works | `diffResultId`, `decision: accept \| deny \| ignore` |
| `accept_build` | Accept **every** changed story in a build at once. **Refused, accepting nothing,** while any changed story has an unresolved review comment — the error names those stories | same selector |
| `list_comments` | Read the review comments a designer/QA (or another agent) left on a build's diffs — every live comment across the build, each carrying its `diffResultId`, `authorType`, `body`, `side`, `parentId` (a reply's thread root), `anchor` (a point/region on the image), and `resolved`. This is the thing `get_build`/`get_diff`'s `comments` count points you to | one of `commitSha` / `prNumber` / `buildId` |
| `post_comment` | Leave a comment (or a threaded reply) on one story's diff — e.g. reply to a reviewer's question, or flag a regression back to them. Authored as the **agent**; a new root comment is refused if a newer build exists on the branch (comment on the latest), but replies are always allowed | selector + `diffResultId`, `body`, `side?`, `anchor?`, `parentId?` (reply to a root's id) |
| `resolve_comment` | Resolve (or reopen) a comment thread once its note is addressed | `commentId` (thread root), `resolved` |
| `update_comment` / `delete_comment` | Edit or remove a comment — an agent key may only touch **agent-authored** comments | `commentId` (+ `body` for update) |

The comment tools (`list_comments` and the writes) are behind the team's image-comments feature; if they are not exposed on your MCP connection, your team does not have it enabled, and `get_build`/`get_diff` will simply report `comments {total: 0, unresolved: 0}`.

## Recipe 1 — "Triage this build"

Bucket the changes so the human sees signal, not 60 rows. Call `get_build` for the PR — it carries the AI judge's call per story (`aiVerdict`, and for a regression the `aiFlagReason`) for the **first page** of changes; if `counts.changed` is larger than that page, keep paging `list_build_stories { status: "changed" }` on the `nextCursor` until it runs out, so no regression slips past the page boundary. **Read the judge before you form your own view, and for anything that actually changed content, adjudicate it against the before image, not in isolation:**

- **Render BOTH images, not just the diff.** `render_diff_image` `which: "baseline"` **and** `which: "candidate"` and compare them. The green diff mask tells you _where_ pixels moved, never _whether the result is good_ — a code block that went dark-on-dark, text that lost contrast, a control that's now clipped all look like "some pixels changed" in the mask and only reveal themselves as regressions in the before/after. Judging the candidate alone is how "it has colours now → improvement" passes an illegible block. Pull `get_diff` for the judge's `aiReasoning` / `aiFlagReason` on the ones it flagged.

- **Read the human's comments before you decide.** If `get_build`'s `comments.unresolved > 0` (or a `get_diff` story shows `comments`), a designer/QA or another agent has left a note on this build — `list_comments` reads them, each tied to its `diffResultId` so you can match a note to the story in your buckets. A comment is context the pixels don't carry ("this spacing is intentional, don't revert it" / "the logo is wrong here"), so read it before you bucket the story. You can't accept over one anyway: `accept_build` and `review_diff` accept/ignore refuse a story with an **unresolved** comment. The loop is read the note → do what it asks (often a code change and a new push) → `resolve_comment` → accept. Never resolve a note just to unblock the accept; resolve it because you addressed it.

Report in four buckets, with real story names and % deltas:

1. **Regression — a real change that's wrong** — content changed and the after is broken or worse: illegible/low-contrast text, clipping, overlap, missing content, a control that stopped reading as itself. **A regression the current PR _caused_ is still a regression** — "my diff explains it" says nothing about whether it's correct. Never accept these; they're the reason to triage.
2. **Intended change** — content changed and the after is correct and matches the PR's stated intent (a deliberate restyle, new copy, a genuinely new story). These still want a human eye, but they're accept candidates.
3. **Cosmetic reflow** — real diff pixels, but the diff image shows the _same_ content shifted a few px (a row moved down ~5px, text ghosted lower). Not a content change.
4. **Rendering noise — safe to accept** — sub-0.4% jitter on chart edges / anti-aliased lines. Pure render jitter.

**The judge's `regression` verdict is a reason to look harder, never to dismiss.** If you're about to call a story the judge flagged "intended anyway", you need a concrete reason from the before/after that refutes its `aiFlagReason` — not "it's a colour change, probably fine." When you can't refute it, trust it.

Example output shape:

> **67 changed stories → buckets.** **⚠️ Regressions (2)** — real changes that look wrong, do NOT accept: `SetupWizard/Playwright` (8.3%, code block now dark-on-dark / illegible — judge flagged `regression`), `Card/Compact` (5.1%, title clipped) … **1. Intended changes (11)** — content changed, looks correct, accept candidates: `Hero/Default` (14%, new headline copy), … **2. Cosmetic reflow (9)** — real pixels, vertical shift only: `EventStatusCard/All Variants` (4.1%, rows shifted ~5px), `TestingInit/Playground` (3.7%), … **3. Chart anti-aliasing noise (6)** — sub-0.4% edge jitter, safe to accept: `FunnelChart/Smaller Screen` (3.2%), `UpliftChart` (single 1px mark), … **New stories (12)** — first baseline, nothing to compare: `Button/AllVariants`, …

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

## Recipe 5 — "What did this whole PR do to the UI?"

`get_build` answers one commit — _is anything unreviewed on this build_. It does **not** prove the **whole PR** did what you intended, and it's blind to two things by construction: a story you **added and accepted earlier in the PR** (the latest build renders it clean, so it never shows as changed) and a **removed** story (a deleted or renamed baseline — no build renders it, so no per-build diff flags it). `get_pr_changeset` is the only surface that catches both, so run it before you call a PR done.

Pull it for the PR and read the whole head-vs-base picture:

```
get_pr_changeset { prNumber: 123 }                  → new / changed / removed vs the base branch
list_pr_stories  { prNumber: 123, kind: "removed" } → page any one bucket
```

Hold every entry to one bar: **can you attribute it to something this PR's diff actually did?**

- **Yes, and it's correct** → the intended visual impact of the PR.
- **A change you can't attribute to your own diff** → stop. Don't accept it, don't dismiss it as flake, don't "re-run and see." Say so and flag it for a human — the likely cause is a baseline that moved when it shouldn't have, which is silent by construction.
- **A `removed` story you didn't intend** → an accidental deletion (or an unintended rename, which reads as a remove plus an add). Flag it loudly; don't let a green check ship it.

The changeset is GA — no flag to enable, and on a **public** project anyone can read it for a build without logging in.

## Recipe 6 — "Answer or resolve a review comment"

When a reviewer's note is a question you can answer, or points at something you just fixed, close the loop from the agent instead of making them chase you. Read the thread with `list_comments`, then:

- **Reply in the thread** — `post_comment { diffResultId, body, parentId }` where `parentId` is the root comment's `id` (a reply inherits the root's side and needs no anchor of its own). Use it to answer "why did this move?" with the diff you made, or to confirm "fixed in the next push."
- **Flag a regression back** — `post_comment { diffResultId, body, anchor? }` as a new root, to point the reviewer at a story you're leaving for them (pair it with the ⚠️ bucket from Recipe 1).
- **Resolve** — `resolve_comment { commentId, resolved: true }` once the note is addressed (you made the change it asked for, or answered the question). Resolve **before** you accept: an open thread makes `accept_build` / `review_diff` refuse that story. Only reach for this when the thread is genuinely done; the open comment is the signal that stops a premature accept.

Your key authors comments as the **agent**, and can only edit/delete comments it authored — never touch a human's comment.

## Passed build? You can still show the pixels

A build with no changes shows no triptych — but the components still rendered, and "nothing changed" is only trustworthy if you can see it. **Enumerate the unchanged set** with `list_build_stories { status: "unchanged" }` (page it on the returned `nextCursor`), then pull any story's current image by id: `get_diff { buildId, storyId }` for its baseline URL, or `render_diff_image { storyId, which: "baseline" }` for the pixels. Use it to confirm a component looks right on a green build, or to hand the reviewer "here it is, identical to baseline" without opening the dashboard.

## Guardrails

- **Read before you write.** Always `get_build` (and `render_diff_image` for anything ambiguous) before `review_diff` / `accept_build`. Don't accept a build you haven't looked at.
- **Compare before-and-after, never the after alone.** For any story that changed content, render `which: "baseline"` AND `which: "candidate"` and look at both — the diff mask shows where, the pair shows whether it got worse (contrast/legibility, clipping, layout). "It has colours / it moved" is not "it's better."
- **The AI judge's `regression` is a signal to trust by default.** Overriding it needs a concrete reason from the before/after that refutes its `aiFlagReason`, not a hand-wave. Attributable-to-this-PR is not a reason to dismiss it.
- **Bulk-accept is a baseline change.** `accept_build` makes the candidate the new truth for every changed story — only reach for it when you've confirmed there's no real regression hiding in the list.
- **An unresolved comment blocks the accept.** `get_build`'s `comments.unresolved > 0` means a human left a note you haven't read — `list_comments` it and honor it before `review_diff` / `accept_build`. A reviewer commenting "don't accept this" that an agent bulk-accepts anyway is exactly the failure this count exists to prevent.
- **Distinguish "new story" from "changed story."** A first-baseline story has nothing to diff; it's not a regression, just needs a baseline. Bucket it separately.
