import { takeSnapshot } from "@uiverify/vitest";
import geistMonoUrl from "geist-mono.woff2";
import geistSansUrl from "geist-sans.woff2";
import { MotionGlobalConfig } from "motion/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect } from "vitest";
import { page } from "vitest/browser";

// Load the app styles once here instead of in every tool's visual test. This
// wrapper pulls in the app's globals.css and widens Tailwind's content scanning
// to the app component tree (see visual.css) so the harness generates every
// utility the rendered components use — otherwise app-only classes are dropped
// and the snapshot drifts from the real chat.
import "./visual.css";

// Read a served asset and inline it as a base64 `data:` URI. The archive replays
// on the UI Verify server long after this vitest run — and its dev server — has
// exited, so a `url(http://localhost:<port>/…)` reference resolves to nothing
// there (fonts render serif, media renders broken). A `data:` URI travels inside
// the archive, so replay always has the real bytes.
export const assetDataUri = async (
  url: string,
  mime: string
): Promise<string> => {
  const response = await fetch(url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCodePoint(byte);
  }
  return `data:${mime};base64,${btoa(binary)}`;
};

// The app renders in Geist (via next/font). next/font can't run here, so
// `--font-geist` would be undefined and text would fall back to a system font
// with different metrics — which throws off line-height and icon alignment.
// Load the real Geist woff2 and wire the same CSS variables the app uses.
let fontsReady: Promise<void> | undefined;

const ensureFonts = (): Promise<void> => {
  if (fontsReady) {
    return fontsReady;
  }

  fontsReady = (async () => {
    const [sansSrc, monoSrc] = await Promise.all([
      assetDataUri(geistSansUrl, "font/woff2"),
      assetDataUri(geistMonoUrl, "font/woff2"),
    ]);
    const style = document.createElement("style");
    style.textContent = `
    @font-face {
      font-family: "Geist";
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
      src: url("${sansSrc}") format("woff2");
    }
    @font-face {
      font-family: "Geist Mono";
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
      src: url("${monoSrc}") format("woff2");
    }
    :root {
      --font-geist: "Geist";
      --font-geist-mono: "Geist Mono";
    }
  `;
    document.head.append(style);

    await Promise.all([
      document.fonts.load('16px "Geist"'),
      document.fonts.load('700 16px "Geist"'),
      document.fonts.load('16px "Geist Mono"'),
    ]);
    await document.fonts.ready;
    // Fail loudly rather than silently capturing a fallback font.
    if (
      !document.fonts.check('16px "Geist"') ||
      !document.fonts.check('16px "Geist Mono"')
    ) {
      throw new Error("Geist fonts did not load in the visual harness");
    }
  })();
  return fontsReady;
};

// Build a `data:` URI from a canvas drawing. A canvas `toDataURL()` is already a
// `data:` URI, so it travels inside the UI Verify archive and replays intact —
// unlike a runtime bitmap or a blob URL, which resolve to nothing on replay.
export const makeCanvasDataUri = (
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  type = "image/png"
): string => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context unavailable in the visual harness");
  }
  draw(ctx, width, height);
  return canvas.toDataURL(type);
};

const isLooping = (a: Animation): boolean =>
  a.effect?.getComputedTiming().iterations === Number.POSITIVE_INFINITY;

// Resolve after the next animation frame. requestAnimationFrame has no promise
// form, so wrapping it is the only option.
const nextFrame = (): Promise<void> =>
  // oxlint-disable-next-line promise/avoid-new -- rAF has no promise API
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

// Wait for every finite animation to reach its final frame. Framer Motion's
// entry fades (opacity/transform, WAAPI) surface here; looping animations are
// skipped so a never-resolving `.finished` can't hang the wait (the web-search
// shimmer is disabled outright via `skipMotion`). The research rail's JS-driven
// connector is NOT here either (see `settleResearchRail`).
export const settleAnimations = async () => {
  // `allSettled` so a cancelled/rejected animation doesn't abort the wait.
  await act(async () => {
    await Promise.allSettled(
      document
        .getAnimations()
        .filter((a) => !isLooping(a))
        .map((a) => a.finished)
    );
  });
};

// The chat renders assistant messages in a centered `max-w-3xl` column on the
// app background. These are the widths/themes a user actually sees.
const CHAT_VIEWPORTS = { desktop: 768, mobile: 390 } as const;
const THEMES = ["light", "dark"] as const;

export type ChatState = {
  /** Short caption drawn above this state so a reviewer can tell the states
   * apart in the combined snapshot (loading / error / success, …). */
  label: string;
  /** The renderer, wired for this one state. */
  ui: ReactNode;
  /** Drive this state to its final frame (expand a disclosure, decode media,
   * settle animations). Receives this state's own `<section>`, so a story with
   * several instances of the same widget settles each independently. */
  settle?: (section: HTMLElement) => Promise<void> | void;
  /** Re-run after each viewport resize, before its snapshots. Use for layout
   * that must be re-measured per width (see `pinResearchRail`). */
  perViewport?: (section: HTMLElement, width: number) => Promise<void> | void;
};

export type CaptureOptions = {
  /**
   * Resolve Framer Motion animations to their final frame instantly instead of
   * playing them. ON by default: a visual snapshot wants the settled frame, and
   * Framer animates non-transform properties like the loading shimmer's
   * `background-position` on its OWN rAF loop (not the Web Animations API, not
   * CSS), so a looping one lands on a different frame every run — flicker the CSS
   * freeze can't stop. Set `false` only for a render that needs Framer to play
   * to reach its final layout; nothing here does today.
   */
  skipMotion?: boolean;
};

/**
 * Capture a tool renderer exactly as the chat shows it: inside the message
 * column, on the app's own background, across desktop + mobile widths and
 * light + dark themes. Every state the renderer can show (loading, error,
 * empty, success) is stacked into one labelled column so a single story proves
 * the whole component. One tool → four cropped snapshots
 * (`<name>-desktop-light`, `<name>-mobile-dark`, …), each showing every state.
 *
 * Determinism policy — a snapshot must capture one settled frame, so all motion
 * is stilled: Framer Motion is resolved to its final frame (`skipMotion`, on by
 * default), CSS animations/transitions are frozen below, and library animations
 * that are neither (echarts) are disabled at the mock. Async work (fonts, images,
 * shiki, matchMedia) is awaited explicitly per state / on resize.
 */
export const captureChatStory = async (
  name: string,
  states: ChatState[],
  { skipMotion = true }: CaptureOptions = {}
) => {
  await ensureFonts();
  MotionGlobalConfig.skipAnimations = skipMotion;
  document.body.style.margin = "0";
  document.body.className = "bg-background text-foreground font-sans";
  // Freeze CSS keyframe animations and transitions so infinite loaders (pulse
  // skeletons, spinners) and in-flight transitions capture at a deterministic
  // frame instead of a random one — and so `settleAnimations` never awaits an
  // infinite `.finished`.
  const freeze = document.createElement("style");
  freeze.textContent =
    "*,*::before,*::after{animation:none!important;transition:none!important;}";
  document.head.append(freeze);

  const column = document.createElement("main");
  column.className =
    "mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-6 font-sans";
  document.body.append(column);
  const root = createRoot(column);
  try {
    await act(() =>
      root.render(
        states.map((state, index) => (
          <section data-story-index={index} key={state.label}>
            <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
              {state.label}
            </p>
            {state.ui}
          </section>
        ))
      )
    );
    const sections = [
      ...column.querySelectorAll<HTMLElement>("section[data-story-index]"),
    ];
    // Sequential on purpose: each state settles (and later each viewport/theme is
    // applied) before the next capture, so parallelising would race the shared
    // viewport and `act` batches — hence the scoped no-await-in-loop opt-out.
    /* oxlint-disable eslint/no-await-in-loop */
    for (const [index, state] of states.entries()) {
      await state.settle?.(sections[index]);
    }
    // Settle entry fades in states that don't declare their own settle (e.g. the
    // in-progress research task).
    await settleAnimations();
    for (const [viewport, width] of Object.entries(CHAT_VIEWPORTS)) {
      // Resize before capture so the archive records the real chat width and
      // the snapshot crops to content instead of a fixed 1000×900 canvas. A
      // width-driven `matchMedia` store (useSyncExternalStore, e.g.
      // `useIsMobile`) re-renders only once its `change` event fires — which
      // races the snapshot — so wait a frame for that event, then flush the
      // resulting React update inside `act`, so width-dependent layout is
      // settled (and the flush doesn't warn).
      await act(async () => {
        await page.viewport(width, 100);
        await nextFrame();
      });
      for (const [index, state] of states.entries()) {
        await state.perViewport?.(sections[index], width);
      }
      for (const theme of THEMES) {
        document.documentElement.classList.toggle("dark", theme === "dark");
        await takeSnapshot(`${name}-${viewport}-${theme}`);
      }
    }
    /* oxlint-enable eslint/no-await-in-loop */
  } finally {
    await act(() => root.unmount());
    column.remove();
    freeze.remove();
    document.documentElement.classList.remove("dark");
    document.body.className = "";
    MotionGlobalConfig.skipAnimations = false;
  }
};

const visibleRails = (section: HTMLElement): HTMLElement[] =>
  [...section.querySelectorAll<HTMLElement>(".border-dashed")]
    .filter((el) => !el.classList.contains("hidden"))
    .map((el) => el.parentElement)
    .filter((el): el is HTMLElement => el !== null);

/**
 * Expand a web-search research widget and wait for its step rail to reach its
 * final frame. The rail uses real Framer Motion: the dashed connector animates
 * height 0 → 100% (JS-driven, so NOT in `document.getAnimations()`) and each
 * task fades opacity 0 → 1 (WAAPI). Capturing mid-frame would miss the connector
 * and show faded text, so click the toggle open, wait for the expanded content,
 * then wait for every animation — WAAPI and the JS-driven connector — to settle.
 * Pair with `pinResearchRail` as `perViewport` so the rail survives replay.
 */
export const settleResearchRail = async (
  section: HTMLElement,
  expandedMarker: string
) => {
  const toggle = section.querySelector("button");
  if (toggle) {
    await act(() => {
      toggle.click();
    });
  }
  await expect.poll(() => section.textContent).toContain(expandedMarker);
  await settleAnimations();
  await expect
    .poll(() =>
      [...section.querySelectorAll<HTMLElement>(".border-dashed")]
        .filter((el) => !el.classList.contains("hidden"))
        .every((el) => el.style.height === "100%")
    )
    .toBe(true);
};

/**
 * Pin each step's icon-rail column to its resolved pixel height so the dashed
 * connector survives the UI Verify archive replay. The rail's height is
 * content-driven (its row stretches to the taller task column) and the connector
 * is `flex-1`, growing to fill it — but on replay the archive renders this
 * subtree in isolation, the stretch chain that gave the rail a definite height is
 * gone, and the flex-1 connector collapses to 0. Baking the rail's px height back
 * in gives flex-1 a definite box to fill again, without overriding the connector
 * itself (which would make it, not the content, drive the row height and inflate
 * the spacing). Reset to auto first so the height is re-measured at the current
 * width — desktop and mobile wrap the source cards differently, so a height
 * pinned at one width is wrong at the other.
 */
export const pinResearchRail = async (section: HTMLElement) => {
  const rails = visibleRails(section);
  await act(() => {
    for (const el of rails) {
      el.style.height = "";
    }
  });
  const heights = rails.map((el) => el.offsetHeight);
  await act(() => {
    for (const [index, el] of rails.entries()) {
      el.style.height = `${heights[index]}px`;
    }
  });
};
