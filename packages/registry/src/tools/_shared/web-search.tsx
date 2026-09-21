import type { ReactNode } from "react";

import { pinResearchRail, settleResearchRail } from "./visual";
import type { ChatState } from "./visual";

/**
 * The two web-search tools (firecrawl, tavily) share the exact same renderer — a
 * research widget that shows a loading indicator while searching, then collapses
 * to a summary that expands to a source rail. They share the same story shape, so
 * each tool supplies its own typed `renderWith(toolCallId)` (its renderer +
 * fixture input) and the marker text that proves the rail expanded.
 *
 * Each state renders a distinct `toolCallId` (`<base>-loading|-collapsed|
 * -expanded`); the test's mocked store returns in-progress updates for the
 * `-loading` id and completed updates for the rest. The loading state's infinite
 * shimmer is pinned deterministically by the harness (see `pinLoopingAnimations`),
 * so it captures the same frame every run.
 */
export const webSearchStates = (
  renderWith: (toolCallId: string) => ReactNode,
  toolCallId: string,
  expandedMarker: string
): ChatState[] => [
  { label: "Searching (in progress)", ui: renderWith(`${toolCallId}-loading`) },
  {
    label: "Complete · collapsed summary",
    ui: renderWith(`${toolCallId}-collapsed`),
  },
  {
    label: "Complete · expanded rail",
    perViewport: (section) => pinResearchRail(section),
    settle: (section) => settleResearchRail(section, expandedMarker),
    ui: renderWith(`${toolCallId}-expanded`),
  },
];
