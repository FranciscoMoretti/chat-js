---
name: vitest-visual-testing
description: Make @uiverify/vitest (Vitest browser-mode) captures deterministic so component visual tests stop coming back "changed" without a real change (flaky diffs). Use when setting up or debugging visual tests over Vitest browser-mode component tests. Focuses only on the run-to-run variation the capturer can't neutralize from outside your app — above all live/dynamic data, the highest-value step (freeze it with static fixtures and the whole content-noise class disappears), plus the clock, infinite JS animations, and non-Math.random randomness, and the one Vitest-specific trap - capturing before the component has settled.
---

# Deterministic Vitest captures (browser mode)

## Mental model — component isolation already removed most of the flake

`@uiverify/vitest` archives each **browser-mode test's final DOM + every resource the page loaded**; UI Verify re-renders and pixel-diffs that archive server-side. Because a browser-mode component test renders an **isolated component** (no page scroll, no A/B / analytics / chat / consent scripts, no lazy-load-on-scroll races), you get the same head start Storybook gives you: the determinism work here is **narrow**. If you reach for scroll-settling or third-party stubbing, you're fighting a problem component isolation already removed (that's a real-page concern — see `playwright-visual-testing`).

> Whatever the component **is at the end of the test** (or at your `takeSnapshot()` call) is baked into the archive forever. Your job is to drive it to one canonical state before capture.

Integration is one plugin (no per-test code):

```ts
// vitest.config.ts
import { playwright } from "@vitest/browser-playwright";
import { uiverifyPlugin } from "@uiverify/vitest/plugin";
export default defineConfig({
  plugins: [uiverifyPlugin()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
});
```

Every browser-mode test then archives its final DOM automatically; `takeSnapshot('name')` adds an intermediate checkpoint.

**UI Verify's capturer neutralizes these automatically — do NOT hand-fix them:** CSS animations & transitions (killed at render) and the Web Animations API (disabled); `prefers-reduced-motion: reduce` (**emulated**); `Math.random` (**seeded** before your app code runs); web fonts and `<img>` loading (**waited for**); **finite** JS animations (captured at their settled final frame). And unlike a real page (`playwright-visual-testing`), a browser-mode test has **no SSR** — no server-rendered random pick to reconcile. So the checklist below is only the remainder — what lives _inside your app_.

**The headline: freeze the data.** Once the list above is off the table, the one thing left that floods a component suite with false "changes" is **live/dynamic data** — star counts, follower counts, contributor lists, tiles, timestamps. Feed every component **static fixtures** and that entire class disappears at the source: static data can't churn run-to-run, so there is nothing to diff. This is the single highest-value determinism step here — do it first (step 1), and most components need nothing else.

## The one Vitest-specific trap: capture before the component settled

The auto-snapshot fires at the **end of a passing test**, and `takeSnapshot()` fires **the moment you call it**. If the component is still resolving a promise, running a transition, or hasn't rendered its data yet, you archive a half-rendered frame. Drive it to its final state first — await your render helper, wait for the content to appear, then let the test end (or call `takeSnapshot()`):

```ts
import { expect } from 'vitest';
import { render } from 'vitest-browser-react'; // or your framework's browser render helper
import { takeSnapshot } from '@uiverify/vitest';

test('user card', async () => {
  const screen = await render(<UserCard id="u_1" />); // render() is async - await it, or `screen` is a Promise
  await expect.element(screen.getByText('Ada Lovelace')).toBeVisible(); // wait for settled content
  await takeSnapshot();
});
```

This is the analog of a Playwright test's navigation + assertions: your `render` + waits _are_ the determinism surface.

## The checklist (only what the tool can't do for you)

### 1. Freeze the data — the one that actually matters

A component fed live/dynamic data is flaky by construction: the stars, followers, contributor list, tile order, and timestamps move between runs, so the diff lights up with no code change. **Give every component static fixtures and the whole class is gone.** Never let a test hit a real backend.

Concrete — feed fixed, ordered, complete fixtures:

- fixed **counts** (stars, followers, downloads) — literal numbers, not a live fetch;
- a fixed **contributor/author list**: fixed names **and** avatar URLs (or inlined avatars), in a fixed order;
- a fixed set of **tiles/rows in a fixed order** (a live "trending" sort reorders every run);
- fixed **timestamps** (pair with the clock, step 2).

Two ways to inject them, both fine:

```ts
// (a) pass fixtures as props — the simplest, when the component takes its data as props
await render(<LibraryTile name="ktor" stars={12873} platforms={['jvm', 'js', 'native']} />);

// (b) mock the data module the component imports — when it fetches internally
vi.mock('../api/library', () => ({ getLibrary: () => fixtures.ktor }));
```

If a page is a server component that fetches, render its **client presentational subtree** with fixture props instead of the fetching wrapper — a browser-mode test has no server to run the fetch anyway. MSW in a setup file also works for `fetch`-based components; the rule is only _no real request_.

**Copy the dogfood — it's the reference implementation.** `apps/docs/e2e/docs-visual.browser.test.ts` is the in-repo example: call `takeSnapshot('name')` after the page settles, with static content.

**One canvas per component, not N stories.** Render every variant × state of a component (a Button's sizes/states, every tile kind) in a **single grid** and take **one** snapshot — cheaper (one screenshot), and you eyeball the whole component's surface at once. Keep each page/component in **its own test file** so `--only-changed` carries the untouched ones forward, and add a path filter so the visual job only runs on UI PRs — both keep the suite cheap at scale.

### 2. Freeze the clock

The one thing the capturer deliberately does **not** do. Any component that reads the clock — a relative timestamp, a date defaulting to "today", a chart's day axis — drifts every run. Pin it with Vitest's fake timers before you render:

```ts
import { beforeEach, afterEach, vi } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2020-01-01T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());
```

If a component animates on mount and fake timers freeze it half-way, advance to the end (`vi.runAllTimers()`) or set the time _after_ the render settles.

### 3. Infinite JS animations

A CSS/WAAPI/finite animation is handled for you (above). What's left is an **infinite** JS loop with no final frame — framer-motion pulsing dots, a Lottie loop, an autoplay spinner, or a `<canvas>` / `requestAnimationFrame` loop (which no media query can reach). Two fixes:

- **Preferred — honor reduced motion.** The capturer emulates `prefers-reduced-motion: reduce`, so make the component respect it (framer-motion: `<MotionConfig reducedMotion="user">`, or gate the loop with `useReducedMotion()`). One line, and it's good app behavior anyway.
- **Escape hatch — detect the capture** and render the end state (for a `<canvas>` rAF loop: `if (isUIVerify()) drawOneStaticFrame(); else startRaf();` in the effect). The canonical helper reads two signals — a `UIVerify` `navigator.userAgent` marker and a `window.__UI_VERIFY__` global:
  ```ts
  export const isUIVerify = () =>
    (typeof navigator !== "undefined" &&
      navigator.userAgent.includes("UIVerify")) ||
    (typeof window !== "undefined" && "__UI_VERIFY__" in window);
  ```
  ```tsx
  <RadarChart isAnimationActive={!isUIVerify()} />
  ```
  In Vitest **browser mode** the load-bearing signal is the `window.__UI_VERIFY__` global (the browser provider owns the context, so the SDK sets the global, not the UA marker) — use the helper as-is; the global is what fires here.

### 4. Non-`Math.random` randomness

`Math.random` is seeded for you, but `crypto.randomUUID()`, a `uuid` library, or faker are **not**. Use fixed fixtures for anything that reaches the DOM (an id, a faker name), or set a fixed faker seed.

### 5. Dynamic layout

A JS-measured layout that reflows or reorders on its own (packing driven by measured size, a shuffled list) can vary run-to-run even with identical content. Force a deterministic variant (a fixed order/size), or mask the region.

One measured-layout case the SDK already handles: a component that measures text width **on mount** (a sliding tab or switch highlight) can bake a 1px-shifted position if the font wasn't ready at that first layout. The SDK preloads fonts before each test so the first measurement uses real metrics. If your CSS or a font registers late (an unusual setup) and you still see a sub-pixel shift, call `preloadFonts()` from `@uiverify/vitest` **before** `render()` to force it - settling after render can't undo a measurement already taken.

## Anti-patterns

- **A test that fetches live data** → mock it (`vi.mock` / MSW).
- **`takeSnapshot()` (or letting the test end) before the component committed or rendered its data** → archives a half-rendered or blank frame; `await render(...)` (it is async), then await the settled state.
- **Disabling CSS animations / seeding `Math.random` / waiting on fonts by hand** → wasted effort; the capturer already does all three. Spend the effort on the clock, settling, and infinite loops.
- **Unseeded `crypto`/`uuid`/faker or a bare `Date.now()`** → fixtures + freeze the clock.
- **Reaching for scroll-settle / A-B stubbing** → wrong path; that's a real-page concern.
