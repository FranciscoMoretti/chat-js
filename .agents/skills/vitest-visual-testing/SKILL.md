---
name: vitest-visual-testing
description: Make @uiverify/vitest (Vitest browser-mode) captures deterministic so component visual tests stop coming back "changed" without a real change (flaky diffs). Use when setting up or debugging visual tests over Vitest browser-mode component tests, or rendering whole pages (including Next.js App Router pages) in browser mode. Focuses only on the run-to-run variation the capturer can't neutralize from outside your app — above all live/dynamic data, the highest-value step (freeze it with static fixtures and the whole content-noise class disappears), plus the clock, infinite JS animations, and non-Math.random randomness, and the one Vitest-specific trap - capturing before the component has settled.
---

# Deterministic Vitest captures (browser mode)

## Mental model — component isolation already removed most of the flake

`@uiverify/vitest` archives each **browser-mode test's final DOM + every resource it uses**; UI Verify re-renders and pixel-diffs that archive server-side. Because a browser-mode component test renders an **isolated component** (no page scroll, no A/B / analytics / chat / consent scripts, no lazy-load-on-scroll races), you get the same head start Storybook gives you: the determinism work here is **narrow**. If you reach for scroll-settling or third-party stubbing in a component test, you're fighting a problem component isolation already removed. Whole pages rendered in browser mode bring some of it back; see "Testing whole pages" below.

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

Every browser-mode test then archives its final DOM automatically; a test that calls `takeSnapshot('name')` archives those named snapshots instead.

**Load your app's global CSS + fonts once, in a setup file.** An isolated browser-mode test renders a single component — it does **not** import your app's entry/layout, so your global stylesheet and any icon-font CSS (`bootstrap-icons`, an icon pack) are never loaded, and the component captures with fallback fonts / tofu glyphs. This is a **setup** gap, not a per-test one: load them once in a `setupFiles` file (it runs in the browser, in the same document your components render into) so every test inherits them with no duplication:

```ts
// vitest.setup.ts   ← referenced from test.setupFiles
import "bootstrap-icons/font/bootstrap-icons.css"; // icon @font-face + .bi-* classes
import "./src/styles/globals.css"; // your tokens + base font
```

```ts
// vitest.config.ts
test: { setupFiles: ['./vitest.setup.ts'], browser: { /* … */ } }
```

Import fonts from an npm package or a same-origin asset (not a CDN `<link>`), so Vite serves the bytes and the archive stays self-contained. A font CDN or a third-party image (avatar generators, favicon services) is archived too, but it is downloaded again at every capture, so an outage or a rate limit becomes a missing font or image in that build. The test output then shows a `[uiverify] … could not archive …` warning naming it. Serve fixtures a local copy or a `data:` URI to keep the archive independent of those services.

The capturer then waits for these fonts like any other — but it can only wait for fonts the test actually loads; it can't declare one you never imported. To diagnose missing icon fonts, verify that the expected font family is registered in `document.fonts` and that its `FontFace.status` is `"loaded"`. `document.fonts.check()` alone cannot confirm this: it also returns `true` for an undeclared font family.

**Tailwind v4 in a monorepo.** Tailwind generates only the classes it finds in the files it scans, starting from where Vitest runs. When the visual tests run from another package than the app, add `@source` lines for the app's folders (`app/`, `components/`, `lib/`) to the CSS your setup imports; otherwise classes used only in those folders are missing and the capture differs from the real app with no error.

**UI Verify's capturer neutralizes these automatically — do NOT hand-fix them:** CSS animations & transitions (killed at render) and the Web Animations API (disabled); `prefers-reduced-motion: reduce` (**emulated**); `Math.random` (**seeded** before your app code runs); web fonts, `<img>` and CSS background images (`::before`/`::after` included) (**waited for** — the fonts your app actually loads, see the setup file above; `loading="lazy"` images below the viewport are switched to eager so they load too); **finite** JS animations (captured at their settled final frame). And unlike a real page (`playwright-visual-testing`), a browser-mode test has **no SSR** — no server-rendered random pick to reconcile. So the checklist below is only the remainder — what lives _inside your app_.

**The headline: freeze the data.** Once the list above is off the table, the one thing left that floods a component suite with false "changes" is **live/dynamic data** — star counts, follower counts, contributor lists, tiles, timestamps. Feed every component **static fixtures** and that entire class disappears at the source: static data can't churn run-to-run, so there is nothing to diff. This is the single highest-value determinism step here — do it first (step 1), and most components need nothing else.

## The one Vitest-specific trap: capture before the component settled

The auto-snapshot fires at the **end of every test** (a failed one too, so a broken component shows up as a visual change rather than vanishing from the build), and `takeSnapshot()` fires **the moment you call it**. If the component is still resolving a promise, running a transition, or hasn't rendered its data yet, you archive a half-rendered frame. Drive it to its final state first — await your render helper, wait for the content to appear, then let the test end (or call `takeSnapshot()`):

```ts
import { render } from 'vitest-browser-react'; // or your framework's browser render helper
import { takeSnapshot } from '@uiverify/vitest';
import { expect, test } from 'vitest';

test('user card', async () => {
  const screen = await render(<UserCard id="u_1" />); // render() is async - await it, or `screen` is a Promise
  // expect.element retries until the content shows; a bare .query() checks once and does not wait.
  await expect.element(screen.getByText('Ada Lovelace')).toBeVisible();
  await takeSnapshot();
});
```

This is the analog of a Playwright test's navigation + assertions: your `render` + waits _are_ the determinism surface.

Wait for **everything** the component loads, not only the part you assert on: a sidebar, a balance or an avatar that loads on its own request can still be loading when your assertion passes. With TanStack Query, wait until no query or mutation is in flight (`queryClient.isFetching() === 0 && queryClient.isMutating() === 0`); with other clients, until your fetch mock has answered every request. If a JS-driven layout keeps moving after the content shows (a chat that scrolls itself to the bottom, a measured highlight), also wait until element positions and scroll offsets stop changing for a few frames. Put these waits in one helper the tests share. On Vitest 4.1 and later the automatic snapshot is taken as soon as the test body finishes, before any `afterEach` hook (except for concurrent tests and with `sequence.hooks: "parallel"`), so a wait in an `afterEach` comes too late: call the helper from the test (or have that hook call `takeSnapshot()` itself). If you turn the automatic snapshot off (`disableAutoSnapshot()`) and call `takeSnapshot()` at the end of that helper, every capture is guaranteed to come after the wait.

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

**Copy the example — it's the reference implementation.** The `*.visual.test.tsx` files in [`examples/vitest`](https://github.com/uiverify/uiverify/tree/main/examples/vitest) are real `@uiverify/vitest` tests with this exact shape: render the component → `await expect.element(...).toBeVisible()` → `await takeSnapshot()`, all data static.

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
- **Test-only switch for Motion (framer-motion).** `MotionGlobalConfig.skipAnimations = true` (from `motion/react` or `framer-motion`) in your setup file makes every Motion animation jump to its end state, including height and scroll animations no CSS can stop. No app change needed.
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

## Testing whole pages

Browser mode can render a whole page, not just a component: render the page's own component inside the same layouts and providers your app wraps it in (router, theme, data client), so the capture shows the real header, sidebar and layout. This works in any framework; you need no running app, dev server or database. Replace only the boundary, once, in the setup file, and keep everything inside it real:

- **data**: answer the page's API calls (REST, GraphQL, tRPC) from per-test fixtures with a stubbed `fetch` or a mock of your data module, failing loudly when a test hits a call it has no fixture for;
- **the request**: the current path, search params, cookies and signed-in user, read from a small per-test object by your router and auth doubles;
- **what only runs on a server**: database clients and other server-only modules, and any framework API that reads the incoming request.

Then follow the rest of this skill as for components: fixtures for every piece of data, a frozen clock (`vi.useFakeTimers({ toFake: ['Date'] })`), the app's global CSS and fonts in the setup file, and the shared settle helper above. Capture each page in the sizes and themes your users see (for example desktop and mobile, light and dark), and skip a variant only where it looks identical to another one.

**Next.js App Router.** Import the route's `page.tsx` and wrap it in its `layout.tsx` files. React does not officially support async components on the client, but React 19 still renders an async server component there when it sits inside `<Suspense>`, logging a console error per async component (filter those in the setup file). Because the client re-runs the component on every retry, keep its awaited work settling: return the same promise or cached data on each run rather than starting a new request. Replace `server-only`, `next/headers` (`cookies()`, `headers()`), `next/cache`, `next/navigation` and `next/link`, plus the data functions the route files call on the server, and load the fonts `next/font` provides in the app.

## Anti-patterns

- **A test that fetches live data** → mock it (`vi.mock` / MSW).
- **`takeSnapshot()` (or letting the test end) before the component committed or rendered its data** → archives a half-rendered or blank frame; `await render(...)` (it is async), then await the settled state.
- **Disabling CSS animations / seeding `Math.random` / waiting on fonts by hand** → wasted effort; the capturer already does all three. Spend the effort on the clock, settling, and infinite loops.
- **Unseeded `crypto`/`uuid`/faker or a bare `Date.now()`** → fixtures + freeze the clock.
- **Reaching for scroll-settle / A-B stubbing in a component test** → wrong path; that's a page concern. Whole pages rendered in browser mode use the shared settle helper above.
