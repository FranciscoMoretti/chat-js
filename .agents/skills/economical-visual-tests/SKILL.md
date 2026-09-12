---
name: economical-visual-tests
description: Author economical visual tests — full visual coverage in the fewest billable snapshots. Applies to any per-snapshot visual tool (UI Verify, Chromatic, Percy, Playwright screenshots), which all bill and diff per rendered story/test. Use when a component's variants/states are exploding into one snapshot per combination, when the visual-testing bill or noise is driven by snapshot count, or when writing new stories/captures and you want the cheapest layout that still covers every variant. Covers gallery/matrix stories, data-driven states, and the coarse-granularity tradeoff.
---

# Author economical visual tests

Every per-snapshot visual tool — UI Verify, Chromatic, Percy, Playwright screenshots — renders and bills **per story**. So the number of stories _is_ the cost and the noise surface. The naive pattern (one story per variant × state × theme) multiplies both fast: a component with 5 sizes × 3 states × 2 themes is **30 snapshots** the naive way. This skill collapses that to a handful while keeping full coverage.

The technique is tool-agnostic; the payoff (fewer billed shots, fewer places to flake) is the same everywhere.

## Move 1 — one "all variants" gallery story, not N stories

Render the whole matrix **together** in a single story: a grid of every size/state side by side. One snapshot then covers the entire matrix.

```tsx
// Button.stories.tsx — ONE story covers every size × variant
export const AllVariants = () => (
  <div
    style={{
      display: "grid",
      gap: 16,
      gridTemplateColumns: "repeat(3, max-content)",
    }}
  >
    {(["sm", "md", "lg"] as const).flatMap((size) =>
      (["primary", "secondary", "danger"] as const).map((variant) => (
        <Button key={`${size}-${variant}`} size={size} variant={variant}>
          {size}/{variant}
        </Button>
      ))
    )}
  </div>
);
```

9 buttons, **1 snapshot** instead of 9.

## Move 2 — drive states from data/props, not from N stories

For a component that normally _fetches_, don't write a story per response state. Render each state from a fixed fixture — a table of props/mock-responses — in one story. Deterministic input in, deterministic pixels out, many states, few shots.

```tsx
const CASES: { label: string; items?: Item[]; error?: string }[] = [
  { label: "empty", items: [] },
  { label: "one", items: [fixtures.one] },
  { label: "many", items: fixtures.many },
  { label: "error", error: "Failed to load" },
];

export const AllStates = () => (
  <div style={{ display: "grid", gap: 24 }}>
    {CASES.map((c) => (
      <section key={c.label}>
        <h4>{c.label}</h4>
        <List items={c.items} error={c.error} />
      </section>
    ))}
  </div>
);
```

(If the component fetches internally rather than taking props, mock the request instead — see `storybook-visual-testing`, "mock data." The point is the same: fixtures, not N stories.)

## The tradeoff — say it out loud, don't just merge everything

Consolidating into one snapshot is **coarser granularity**: a diff _anywhere_ in the gallery flags the whole story, and you lose the per-variant baseline/accept. So this is a balance, not "merge everything":

- **Merge** variants that change together and share one component — a pure component matrix (sizes, states, themes of one Button). This is where consolidation wins cleanly.
- **Keep separate** genuinely independent surfaces — different pages, different flows, things that evolve on their own timelines. Collapsing those just couples unrelated diffs.
- UI Verify's AI review + per-region diff soften the coarse-granularity cost (it can tell you _which_ cell in the gallery moved), so lean toward consolidation for component matrices.

## Estimate the win

When you refactor, state the delta so the value is legible:

> This collapses **28 stories → 2 snapshots** (the size×variant×theme matrix into one gallery, the four data states into one story). ~93% fewer billed shots, same coverage.

## Anti-patterns

- **One story per prop combination** → gallery story (move 1).
- **One story per fetch state** (`Loading`, `Empty`, `Error`, `Loaded` as four stories) → one data-driven story (move 2).
- **Merging independent pages into one snapshot** → over-consolidation; you've coupled unrelated diffs. Keep those separate.
