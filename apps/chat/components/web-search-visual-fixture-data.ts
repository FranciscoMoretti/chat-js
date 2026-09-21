import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";

// The web-search research-update fixtures, shared by the app visual fixture
// (real render) and the registry harness tests (mocked hook) so the two can't
// drift. firecrawl and tavily use distinct queries/results so their snapshots
// are visually distinguishable.

// Source cards load favicons from an external URL, which the sandboxed renderer
// can't fetch (it aborts un-archived cross-origin requests) — they would capture
// as broken images. Both search harness tests mock `getFaviconUrl` to return
// this inline favicon so the card looks like it does in chat.
export const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='#9ca3af' stroke-width='1.25'><circle cx='8' cy='8' r='6.25'/><path d='M1.75 8h12.5'/><ellipse cx='8' cy='8' rx='3' ry='6.25'/></svg>"
)}`;

// The in-progress fixtures: a "started" step plus a running web search with no
// results and no "completed" step, so the widget renders its loading indicator
// (shimmer title + "Searching the web…" spinner) instead of the summary.
const loadingUpdates = (
  toolCallId: string,
  queries: string[]
): ResearchUpdate[] => [
  { timestamp: 0, title: "Searching the web", toolCallId, type: "started" },
  { queries, status: "running", title: "Web search", toolCallId, type: "web" },
];

export const firecrawlResearchUpdatesLoading = (
  toolCallId = "firecrawl-search"
): ResearchUpdate[] =>
  loadingUpdates(toolCallId, ["react server components caching"]);

export const tavilyResearchUpdatesLoading = (
  toolCallId = "tavily-search"
): ResearchUpdate[] =>
  loadingUpdates(toolCallId, ["best espresso machines 2026"]);

export const firecrawlResearchUpdates = (
  toolCallId = "firecrawl-search"
): ResearchUpdate[] => [
  {
    timestamp: 0,
    title: "Searching the web",
    toolCallId,
    type: "started",
  },
  {
    queries: [
      "react server components caching",
      "next.js app router revalidation",
    ],
    results: [
      {
        content:
          "Next.js caches fetch() results and route segments by default; revalidate on a timer or on demand.",
        source: "web",
        title: "Caching and Revalidating – Next.js",
        url: "https://nextjs.org/docs/app/building-your-application/caching",
      },
      {
        content:
          "Server Components render on the server and stream to the client, cutting bundle size and enabling direct data access.",
        source: "web",
        title: "Understanding React Server Components",
        url: "https://vercel.com/blog/understanding-react-server-components",
      },
      {
        content:
          "A measurement of time-to-first-byte improvements from streaming SSR across 40 production apps.",
        source: "academic",
        title: "Streaming SSR performance in practice",
        url: "https://arxiv.org/abs/2401.01234",
      },
    ],
    status: "completed",
    title: "Web search",
    toolCallId,
    type: "web",
  },
  {
    timestamp: 3400,
    title: "Search complete",
    toolCallId,
    type: "completed",
  },
];

export const tavilyResearchUpdates = (
  toolCallId = "tavily-search"
): ResearchUpdate[] => [
  {
    timestamp: 0,
    title: "Searching the web",
    toolCallId,
    type: "started",
  },
  {
    queries: ["best espresso machines 2026", "how to dial in espresso at home"],
    results: [
      {
        content:
          "A buyer's guide comparing dual-boiler, heat-exchange, and single-boiler machines for the home barista.",
        source: "web",
        title: "The best espresso machines this year",
        url: "https://www.seriouseats.com/best-espresso-machines",
      },
      {
        content:
          "Grind finer to slow the shot and coarser to speed it up; aim for a 1:2 ratio in 25–30 seconds.",
        source: "web",
        title: "Dialing in espresso: a practical guide",
        url: "https://home.lamarzoccousa.com/dialing-in-espresso",
      },
      {
        content:
          "A controlled study of extraction yield versus grind size across 12 single-origin coffees.",
        source: "academic",
        title: "Extraction yield and grind size in espresso",
        url: "https://arxiv.org/abs/2402.05678",
      },
    ],
    status: "completed",
    title: "Web search",
    toolCallId,
    type: "web",
  },
  {
    timestamp: 3400,
    title: "Search complete",
    toolCallId,
    type: "completed",
  },
];
