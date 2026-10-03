/* oxlint-disable eslint/id-length -- Short names follow the callback and canvas conventions of the code they wrap. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation. */
/* oxlint-disable eslint/max-lines-per-function -- A story lists every renderer state in one capture call, so its length grows with the states it covers. */
/* oxlint-disable eslint/max-params -- The state builder takes exactly the fields that vary between states. */
/* oxlint-disable eslint/max-statements -- Capture steps run in a fixed order (render, settle, resize, snapshot); splitting them hides that sequence. */
/* oxlint-disable eslint/no-magic-numbers -- Fixture values, viewport widths and canvas sizes are literal test data. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/exports-last -- Each helper is exported next to the code it depends on. */
/* oxlint-disable import/group-exports -- Each helper is exported where it is declared, next to its documentation. */
/* oxlint-disable import/no-named-export -- Stories import the harness helpers by name. */
/* oxlint-disable jsdoc/require-param -- The comment explains why; the TypeScript signature describes the parameters. */
/* oxlint-disable oxc/no-async-await -- Captures await rendering, fonts and animations in a fixed order. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/consistent-type-definitions -- Story state shapes are type aliases like the rest of the harness. */
/* oxlint-disable typescript/explicit-function-return-type -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/explicit-module-boundary-types -- Return types are inferred from the fixtures and helpers they wrap. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Parameters are DOM elements and library props, which are mutable host objects. */
/* oxlint-disable typescript/promise-function-async -- Test and settle callbacks return the capture promise directly. */

import { takeSnapshot } from "@uiverify/vitest";
import geistMonoUrl from "geist-mono.woff2";
import geistSansUrl from "geist-sans.woff2";
import { MotionGlobalConfig } from "motion/react";
import type { ReactNode } from "react";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { page } from "vitest/browser";

import { ThemeProvider } from "@/components/theme-provider";

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
  if (!response.ok) {
    throw new Error(`Visual harness asset ${url} returned ${response.status}`);
  }
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

/** Run a synchronous update inside `act` and wait for React to flush it. */
export const flush = async (update: () => void) => {
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act(update);
};

// Resolve after the next animation frame. requestAnimationFrame has no promise
// form, so wrapping it is the only option.
const nextFrame = (): Promise<void> =>
  // oxlint-disable-next-line promise/avoid-new -- rAF has no promise API
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

// Wait for every finite animation to reach its final frame. Framer Motion's
// entry fades (opacity/transform, WAAPI) surface here; looping animations are
// skipped so a never-resolving `.finished` can't hang the wait (Framer's own
// loops are resolved outright via `skipMotion`).
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
  /** Re-run before every snapshot, once its width is applied, for layout that
   * has to be measured at the width being captured. */
  beforeCapture?: (section: HTMLElement) => Promise<void> | void;
};

// Not the app's `theme` key, so a capture never inherits or leaves a theme.
const THEME_STORAGE_KEY = "visual-capture-theme";

export type CaptureOptions = {
  /**
   * Resolve Framer Motion animations to their final frame instantly instead of
   * playing them. ON by default: a visual snapshot wants the settled frame, and
   * Framer animates non-transform properties like a shimmer's
   * `background-position` on its OWN rAF loop (not the Web Animations API, not
   * CSS), so a looping one lands on a different frame every run — flicker the CSS
   * freeze can't stop. Set `false` only for a render that needs Framer to play
   * to reach its final layout; nothing here does today.
   */
  skipMotion?: boolean;
};

// Mount the story once per theme, the way the chat loads in a theme, through
// the app's own provider: components that read `useTheme()` (the charts) then
// render dark from the start instead of rebuilding mid-capture.
const captureTheme = async (
  column: HTMLElement,
  name: string,
  states: ChatState[],
  theme: (typeof THEMES)[number]
) => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  // Every theme mounts at the same width, so width-dependent state initialised
  // on mount matches between them.
  await act(async () => {
    await page.viewport(CHAT_VIEWPORTS.desktop, 900);
    await nextFrame();
  });
  const root = createRoot(column);
  try {
    await flush(() => {
      root.render(
        <ThemeProvider
          attribute="class"
          defaultTheme={theme}
          enableSystem={false}
          storageKey={THEME_STORAGE_KEY}
        >
          {states.map((state, index) => (
            <section data-story-index={index} key={state.label}>
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
                {state.label}
              </p>
              {state.ui}
            </section>
          ))}
        </ThemeProvider>
      );
    });
    const sections = [
      ...column.querySelectorAll<HTMLElement>("section[data-story-index]"),
    ];
    // Sequential on purpose: each state settles (and later each viewport is
    // applied) before the next capture, so parallelising would race the shared
    // viewport and `act` batches — hence the scoped no-await-in-loop opt-out.
    /* oxlint-disable eslint/no-await-in-loop */
    for (const [index, state] of states.entries()) {
      await state.settle?.(sections[index]);
    }
    // Settle entry fades in states that don't declare their own settle.
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
        await state.beforeCapture?.(sections[index]);
      }
      await takeSnapshot(`${name}-${viewport}-${theme}`);
    }
    /* oxlint-enable eslint/no-await-in-loop */
  } finally {
    await flush(() => {
      root.unmount();
    });
  }
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
  try {
    // Sequential on purpose: each theme is mounted and captured before the
    // next, so parallelising would race the shared viewport and `act` batches.
    for (const theme of THEMES) {
      // oxlint-disable-next-line eslint/no-await-in-loop
      await captureTheme(column, name, states, theme);
    }
  } finally {
    column.remove();
    freeze.remove();
    localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove(...THEMES);
    document.documentElement.style.colorScheme = "";
    document.body.className = "";
    MotionGlobalConfig.skipAnimations = false;
  }
};
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/consistent-type-definitions */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/id-length */
