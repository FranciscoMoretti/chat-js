import { ChatPlugins } from "@/providers/chat-plugins";
import { TooltipProvider } from "@/components/ui/tooltip";
import { disableAutoSnapshot, takeSnapshot } from "@uiverify/vitest";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { Suspense } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { Toaster } from "sonner";
import { expect, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";

import { ThemeProvider } from "@/components/theme-provider";

import { now } from "./fixtures";
import { route } from "./route";

// The sizes and themes a user sees every page in, as the registry harness captures tools.
const VIEWPORTS = {
  desktop: { height: 900, width: 1440 },
  mobile: { height: 844, width: 390 },
} as const;
const THEMES = ["light", "dark"] as const;

type Viewport = keyof typeof VIEWPORTS;

let mounted:
  | {
      root: Root;
      ui: ReactNode;
      viewports: readonly Viewport[];
      allowPendingSidebar: boolean;
    }
  | undefined;

const tree = (ui: ReactNode, theme: (typeof THEMES)[number]) => (
  <NuqsTestingAdapter searchParams={route.search}>
    <ThemeProvider
      attribute="class"
      defaultTheme={theme}
      disableTransitionOnChange
      forcedTheme={theme}
    >
      <Toaster position="top-center" />
      <TooltipProvider>
        <ChatPlugins>
          <Suspense>{ui}</Suspense>
        </ChatPlugins>
      </TooltipProvider>
    </ThemeProvider>
  </NuqsTestingAdapter>
);

/** Mounts a route file's tree inside the root layout's providers, as `path` would serve it. */
export const renderRoute = async (
  ui: ReactNode,
  {
    viewports = ["desktop", "mobile"],
    allowPendingSidebar = false,
    ...request
  }: Partial<Omit<typeof route, "queryClients">> & {
    /** Limit to the viewports where this state looks different from its neighbours. */
    viewports?: readonly Viewport[];
    /** Only loading-state fixtures intentionally retain the sidebar Suspense fallback. */
    allowPendingSidebar?: boolean;
  } = {}
) => {
  disableAutoSnapshot();
  Object.assign(route, {
    agentError: null,
    agentStatus: "ready",
    agentEventHandlers: new Map(),
    events: {},
    cookies: {},
    lastLoginMethod: null,
    missingFixtures: new Set(),
    path: "/",
    search: "",
    server: {},
    session: null,
    transcripts: {},
    trpc: {},
    ...request,
  });
  vi.useFakeTimers({ now, toFake: ["Date"] });
  await page.viewport(VIEWPORTS.desktop.width, VIEWPORTS.desktop.height);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mounted = { root, ui, viewports, allowPendingSidebar };
  onTestFinished(() => {
    mounted = undefined;
    root.unmount();
    container.remove();
    // Kept in the set: the browser's query client is a module singleton shared by the file's tests.
    for (const client of route.queryClients) {
      client.clear();
    }
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });
  root.render(tree(ui, "light"));
};

const layout = () =>
  Array.from(document.body.querySelectorAll("*"), (element) => {
    const box = element.getBoundingClientRect();
    return `${box.x},${box.y},${box.width},${box.height},${element.scrollTop}`;
  }).join(";");

// The sidebar's credits and projects load independently of what a test asserts on,
// and the conversation's stick-to-bottom scroll keeps moving after its content shows.
const settled = async (
  theme: (typeof THEMES)[number],
  width: number,
  allowPendingSidebar: boolean
) => {
  // The theme class and the resize land after render() and page.viewport() return.
  await expect
    .poll(
      () =>
        document.documentElement.classList.contains(theme) &&
        window.innerWidth === width
    )
    .toBe(true);
  await expect
    .poll(() =>
      [...route.queryClients].every(
        (client) => client.isFetching() === 0 && client.isMutating() === 0
      )
    )
    .toBe(true);
  let previous = "";
  let unchanged = 0;
  await expect
    .poll(
      () => {
        // Check readiness on every stable-layout sample: a viewport change can
        // mount the sidebar fallback after an earlier one-shot check passed.
        const sidebarReady =
          allowPendingSidebar ||
          document.querySelector(
            '[data-slot="sidebar"] [data-slot="skeleton"]'
          ) === null;
        const transcriptReady = [
          ...document.querySelectorAll<HTMLElement>(
            '[data-slot="message-scroller-viewport"]'
          ),
        ].every(
          (viewport) =>
            viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
            2
        );
        const current = layout();
        unchanged =
          sidebarReady && transcriptReady && current === previous
            ? unchanged + 1
            : 0;
        previous = current;
        return unchanged;
      },
      { interval: 50 }
    )
    .toBeGreaterThanOrEqual(3);
};

/** Captures the rendered page at every viewport and theme (`desktop-light`, `mobile-dark`, …). */
export const captureVariants = async () => {
  if (!mounted) {
    return;
  }
  const { root, ui, viewports, allowPendingSidebar } = mounted;
  /* oxlint-disable eslint/no-await-in-loop -- Each variant resizes and renders the same page; settle and capture it before the next variant changes that shared state. */
  for (const viewport of viewports) {
    const size = VIEWPORTS[viewport];
    await page.viewport(size.width, size.height);
    for (const theme of THEMES) {
      root.render(tree(ui, theme));
      await settled(theme, size.width, allowPendingSidebar);
      await takeSnapshot(`${viewport}-${theme}`);
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */
};
