import type { EveMessage } from "eve/client";
import { MotionGlobalConfig } from "motion/react";
import type { AnchorHTMLAttributes } from "react";
import superjson, { serialize } from "superjson";
import { afterEach, beforeEach, vi } from "vitest";
import { commands } from "vitest/browser";

import type * as QueryClientModule from "@/trpc/query-client";

// The registry's visual harness: the app's globals.css with Tailwind scanning the
// app tree, the Geist faces next/font would load, and the motion freeze.
import {
  ensureFonts,
  FREEZE_MOTION_CSS,
} from "../../registry/src/tools/_shared/visual";
import { chatsIn } from "./fixtures";
import { captureVariants } from "./render";
import { TrpcFixtureError, route } from "./route";

const freeze = document.createElement("style");
freeze.textContent = FREEZE_MOTION_CSS;
document.head.append(freeze);
// Motion animates height and scroll in JavaScript, where the CSS freeze cannot reach.
MotionGlobalConfig.skipAnimations = true;
await ensureFonts();
// Favicons load from Google; serve the fixed icon the registry stories use.
await commands.faviconAssets();
await commands.appIcon();
// Model logos load from models.dev; serve the fixed one the registry's model tests use.
await commands.modelAssets();
// The root layout's <body> class, which renderRoute mounts inside of.
document.body.classList.add("antialiased");

// Shortcut labels follow the platform ("Cmd" on a Mac, "Ctrl" elsewhere). Report the one CI
// captures on, so a capture made on a laptop matches the baseline.
beforeEach(() => {
  vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
});

// There is no RSC renderer in the browser, so React renders the route files' async server
// components on the client and reports each one; the output is the same tree.
const clientRenderedServerComponent =
  /is an async Client Component|suspended by an uncached promise/u;
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  if (!clientRenderedServerComponent.test(String(args[0]))) {
    consoleError(...args);
  }
};

/* oxlint-disable typescript/promise-function-async -- These doubles stand in for server reads, auth and fetch, which callers await; they answer from fixtures without I/O, and eslint/require-await rejects an async callback with nothing to await. */
vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidateTag: () => null,
  unstable_cache: <T,>(fn: T) => fn,
}));

// The pages that opt out of prerendering wait on `connection()`; a test is always a live request.
vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = route.cookies[name];
        return value === undefined ? undefined : { name, value };
      },
    }),
  headers: () => Promise.resolve(new Headers()),
}));

vi.mock("next/navigation", () => {
  const router = {
    back: () => null,
    forward: () => null,
    prefetch: () => null,
    push: () => null,
    refresh: () => null,
    replace: () => null,
  };
  return {
    notFound: () => {
      throw new Error(`notFound() on ${route.path}`);
    },
    redirect: (href: string) => {
      throw new Error(`redirect(${href}) on ${route.path}`);
    },
    useParams: () => ({}),
    usePathname: () => route.path,
    useRouter: () => router,
    useSearchParams: () => new URLSearchParams(route.search),
    useSelectedLayoutSegment: () => null,
  };
});

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    prefetch: _prefetch,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string | { pathname: string };
    prefetch?: boolean;
  }) => (
    <a href={typeof href === "string" ? href : href.pathname} {...props}>
      {props.children}
    </a>
  ),
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: () => Promise.resolve(route.session) } },
}));

vi.mock("@/lib/auth-client", () => ({
  default: {
    // Handing the session to the desktop app never settles in a test, so the page stays mid-transfer.
    electron: { transferUser: () => Promise.withResolvers().promise },
    getLastUsedLoginMethod: () => route.lastLoginMethod,
    getSession: () => Promise.resolve({ data: route.session }),
    useSession: () => ({ data: route.session, error: null, isPending: false }),
  },
}));

vi.mock("@/lib/db/eve-queries", () => ({
  getEveChatPageConversation: () => Promise.resolve(route.server.conversation),
  listEveConversations: (
    _ownerId: string,
    input?: { projectId?: string | null; surface?: "sidebar" | "all" }
  ) => Promise.resolve(chatsIn(route.server.conversations, input)),
}));

vi.mock("@/plugins/projects/db/project-queries", () => ({
  getProjectById: () => Promise.resolve(route.server.project),
}));

vi.mock("@/plugins/sharing/public-conversation", () => ({
  getPublicEveTranscript: () => Promise.resolve(route.server.transcript),
}));

// A replayed transcript accepts no new turns.
const idle = () => Promise.resolve();

// EVE streams a session's events from its server; a page test replays a finished transcript. The
// native data stays stable between events, but the real hook returns a new wrapper on every render.
vi.mock("eve/react", () => {
  let agents = new WeakMap<readonly EveMessage[], object>();
  // One empty list per session, so a session with no transcript keeps its own agent across renders.
  let noTranscripts = new Map<string, readonly EveMessage[]>();
  beforeEach(() => {
    agents = new WeakMap();
    noTranscripts = new Map();
  });
  const emptyTranscript = (sessionId: string): readonly EveMessage[] => {
    const existing = noTranscripts.get(sessionId);
    if (existing) {
      return existing;
    }
    const created: readonly EveMessage[] = [];
    noTranscripts.set(sessionId, created);
    return created;
  };
  return {
    useEveAgent: ({
      initialSession,
    }: {
      initialSession?: { sessionId: string };
    }) => {
      const sessionId = initialSession?.sessionId ?? "";
      const messages =
        route.transcripts[sessionId] ?? emptyTranscript(sessionId);
      const agent = agents.get(messages) ?? {
        cancel: idle,
        data: { messages },
        error:
          route.agentError === null ? undefined : new Error(route.agentError),
        events: route.events[sessionId] ?? [],
        prewarm: idle,
        reset: () => null,
        respond: idle,
        resume: idle,
        send: idle,
        session: initialSession,
        status: route.agentStatus,
      };
      agents.set(messages, agent);
      return { ...agent };
    },
  };
});

// The gateway's live catalog, replaced by the snapshot the repo already generates from it.
vi.mock("@/lib/ai/models", async () => {
  const { models } = await import("@/lib/ai/models.generated");
  const { toModelData } = await import("@/lib/ai/to-model-data");
  return { fetchModels: () => Promise.resolve(models.map(toModelData)) };
});

// A page that preloads a query awaits it once on the server. React re-runs that page here, and a
// failed query refetches on every run, so it would never settle; the client components fetch the
// same data on mount, so the preload only has to start.
vi.mock("@/trpc/preload-query", () => ({
  preloadQuery: (pending: Promise<unknown>) => {
    void (async (): Promise<void> => {
      try {
        await pending;
      } catch {
        // The client query fetches again and shows the failure.
      }
    })();
    return Promise.resolve();
  },
}));

// One client per request, as on the server. A page that makes its own client runs once there, but
// React re-runs it on every retry here; a new client each time would refetch forever.
vi.mock("@/trpc/query-client", async (importOriginal) => {
  const original = await importOriginal<typeof QueryClientModule>();
  let requestClient: ReturnType<typeof original.makeQueryClient> | undefined;
  beforeEach(() => {
    requestClient = undefined;
  });
  return {
    makeQueryClient: () => {
      if (!requestClient) {
        requestClient = original.makeQueryClient();
        // A failing query shows its error once retries run out; skip the backoff.
        requestClient.setDefaultOptions({
          ...requestClient.getDefaultOptions(),
          queries: {
            ...requestClient.getDefaultOptions().queries,
            retry: false,
          },
        });
        route.queryClients.add(requestClient);
      }
      return requestClient;
    },
  };
});

// Server prefetches go through the same fixtures as the browser client, then hydrate as in Next.
vi.mock("@/trpc/server", async () => {
  const { dehydrate, HydrationBoundary } =
    await import("@tanstack/react-query");
  const { createTRPCClient, httpBatchLink } = await import("@trpc/client");
  const { createTRPCOptionsProxy } = await import("@trpc/tanstack-react-query");
  const { makeQueryClient } = await import("@/trpc/query-client");
  let queryClient = makeQueryClient();
  beforeEach(() => {
    queryClient = makeQueryClient();
  });
  const getQueryClient = () => queryClient;
  return {
    HydrateClient: ({ children }: { children: React.ReactNode }) => (
      <HydrationBoundary state={dehydrate(queryClient)}>
        {children}
      </HydrationBoundary>
    ),
    getQueryClient,
    trpc: createTRPCOptionsProxy({
      client: createTRPCClient({
        links: [httpBatchLink({ transformer: superjson, url: "/api/trpc" })],
      }),
      queryClient: getQueryClient,
    }),
  };
});

const isResolver = (fixture: unknown): fixture is (input: unknown) => unknown =>
  typeof fixture === "function";

// The input a batched tRPC request sends for its `index`th procedure.
const inputAt = (batch: unknown, index: number): unknown => {
  if (typeof batch !== "object" || batch === null) {
    return undefined;
  }
  const entry: unknown = Reflect.get(batch, index);
  return typeof entry === "object" && entry !== null
    ? Reflect.get(entry, "json")
    : undefined;
};

const answer = (path: string, input: unknown) => {
  const fixture = route.trpc[path];
  const data = isResolver(fixture) ? fixture(input) : fixture;
  if (!Object.hasOwn(route.trpc, path)) {
    route.missingFixtures.add(path);
  }
  if (!Object.hasOwn(route.trpc, path) || data instanceof TrpcFixtureError) {
    const error =
      data instanceof TrpcFixtureError
        ? data
        : new TrpcFixtureError(
            "INTERNAL_SERVER_ERROR",
            `No visual fixture for ${path}`
          );
    return { error: serialize(error.toResponse(path)) };
  }
  return { result: { data: serialize(data) } };
};

const browserFetch = globalThis.fetch;
beforeEach(() => {
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      location.href
    );
    if (!url.pathname.startsWith("/api/trpc/")) {
      return browserFetch(input, init);
    }
    const paths = url.pathname.slice("/api/trpc/".length).split(",");
    const batch: unknown = JSON.parse(
      typeof init?.body === "string"
        ? init.body
        : (url.searchParams.get("input") ?? "{}")
    );
    return Promise.resolve(
      Response.json(
        paths.map((path, index) => answer(path, inputAt(batch, index)))
      )
    );
  });
});

/* oxlint-enable typescript/promise-function-async */

// renderRoute turns off the SDK's end-of-test capture, whose order against this hook is not
// fixed, and captures every variant here instead, after the test body.
afterEach(async ({ task }) => {
  if (task.result?.state !== "fail") {
    await captureVariants();
  }
  // Checked after the captures, which re-render the page and can call more procedures.
  if (route.missingFixtures.size > 0) {
    throw new Error(
      `No visual fixture for ${[...route.missingFixtures].join(", ")}`
    );
  }
});
