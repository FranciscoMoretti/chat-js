import type { inferRouterOutputs } from "@trpc/server";
import type { EveMessage } from "eve/client";

import type { Session } from "@/lib/auth";
import type { AppRouter } from "@/trpc/routers/_app";

import { assetDataUri } from "../../registry/src/tools/_shared/visual";
import { TrpcFixtureError } from "./route";
import type { ServerData, route } from "./route";

type Outputs = inferRouterOutputs<AppRouter>;
type HistoryPage = NonNullable<ServerData["conversations"]>;

/** Every page renders against this clock, so relative dates ("Yesterday") never drift. */
export const now = new Date("2026-09-24T15:30:00.000Z");
const daysAgo = (days: number, hour = 10) =>
  new Date(Date.UTC(2026, 8, 24 - days, hour, 12));

const ownerId = "user_maya";
// What avatar.vercel.sh draws for this email, which the app shows for users without a photo.
const avatar = await assetDataUri(
  new URL("avatar.png", import.meta.url).href,
  "image/png"
);

export const session: Session = {
  session: {
    createdAt: daysAgo(30),
    expiresAt: daysAgo(-30),
    id: "session_maya",
    ipAddress: null,
    token: "visual-fixture",
    updatedAt: daysAgo(1),
    userAgent: null,
    userId: ownerId,
  },
  user: {
    createdAt: daysAgo(120),
    email: "maya.chen@northwind.dev",
    emailVerified: true,
    id: ownerId,
    image: avatar,
    name: "Maya Chen",
    updatedAt: daysAgo(1),
  },
};

export const projects: Outputs["project"]["list"] = [
  {
    createdAt: daysAgo(40),
    icon: "rocket",
    iconColor: "purple",
    id: "4f9f3a52-9c1e-4d0a-8f53-2b7d6c1e0a11",
    instructions:
      "We are launching Northwind Pay in November. Keep answers short and cite the launch brief.",
    name: "Q4 launch",
    updatedAt: daysAgo(1),
    userId: ownerId,
  },
  {
    createdAt: daysAgo(90),
    icon: "code",
    iconColor: "blue",
    id: "8c2e61d4-0b7f-4e38-a1c5-93f0d2b6e744",
    instructions: "",
    name: "Billing service",
    updatedAt: daysAgo(6),
    userId: ownerId,
  },
];

const chat = (
  id: string,
  title: string,
  updatedAt: Date,
  extra: Partial<HistoryPage["items"][number]> = {}
): HistoryPage["items"][number] => ({
  conversationId: id,
  createdAt: updatedAt,
  id,
  isPinned: false,
  href: `/chat/${id}`,
  parentHref: "/",
  state: "bound",
  title,
  titleStatus: "generated",
  updatedAt: updatedAt.toISOString(),
  ...extra,
});

export const history: HistoryPage = {
  items: [
    chat(
      "0b7d9a3e-5f21-4c86-9e4a-7d1c2b3a4f51",
      "Pricing page copy review",
      daysAgo(3),
      { isPinned: true }
    ),
    chat(
      "1c2d3e4f-6a7b-4c8d-9e0f-a1b2c3d4e5f6",
      "Postgres index for slow invoices query",
      daysAgo(0, 14)
    ),
    chat(
      "2d3e4f5a-7b8c-4d9e-8f01-b2c3d4e5f6a7",
      "Summarize the churn interview notes",
      daysAgo(0, 9)
    ),
    chat(
      "3e4f5a6b-8c9d-4e0f-9a12-c3d4e5f6a7b8",
      "Draft the incident postmortem",
      daysAgo(1)
    ),
    chat(
      "4f5a6b7c-9d0e-4f1a-8b23-d4e5f6a7b8c9",
      "Compare Stripe and Adyen fees",
      daysAgo(4)
    ),
    chat(
      "5a6b7c8d-0e1f-4a2b-9c34-e5f6a7b8c9d0",
      "Regex for EU VAT numbers",
      daysAgo(12)
    ),
    chat(
      "6b7c8d9e-1f2a-4b3c-8d45-f6a7b8c9d0e1",
      "Onboarding email sequence ideas",
      daysAgo(45)
    ),
  ],
  nextCursor: null,
};

/** A history page as the query returns it for one scope: `null` is chats outside any project. */
export const chatsIn = (
  page: HistoryPage | undefined,
  input?: { projectId?: string | null; surface?: "sidebar" | "all" }
) =>
  page && {
    ...page,
    items: page.items.filter(
      (item) =>
        (input?.projectId === undefined && input?.surface !== "sidebar") ||
        item.parentHref ===
          (typeof input?.projectId === "string"
            ? `/project/${input.projectId}`
            : "/")
    ),
  };

/** The procedures every signed-in page reads through the chat layout and sidebar. */
export const signedInTrpc = {
  "credits.getAvailableCredits": { credits: 842 },
  "eve.list": (input: { projectId?: string | null }) => chatsIn(history, input),
  "mcp.listConnected": [],
  "project.list": projects,
  "project.forChat": null,
  "settings.getModelPreferences": [],
};

const invoicesChatId = history.items[1]?.id ?? "";
const invoicesSessionId = "ses_invoices";

/** Maya, signed in with the sidebar open, as most pages are seen. */
export const signedIn = {
  cookies: { sidebar_state: "true" },
  server: { conversations: history },
  session,
  trpc: signedInTrpc,
};

export const invoicesTranscript: EveMessage[] = [
  {
    id: "msg-user-1",
    metadata: { status: "complete", turnId: "turn_0" },
    parts: [
      {
        state: "done",
        text: "Our invoices list takes 4 seconds to load for big accounts. The query filters by account_id and status and sorts by due_date. What index should I add?",
        type: "text",
      },
    ],
    role: "user",
  },
  {
    id: "msg-assistant-1",
    metadata: {
      modelId: "google/gemini-2.5-flash-lite",
      status: "complete",
      turnId: "turn_0",
    },
    parts: [
      {
        state: "done",
        text: [
          "Add one composite index that matches the filter first and the sort last:",
          "",
          "```sql",
          "CREATE INDEX CONCURRENTLY invoices_account_status_due_idx",
          "  ON invoices (account_id, status, due_date DESC);",
          "```",
          "",
          "Why this order works:",
          "",
          "1. **account_id** narrows the scan to one customer.",
          "2. **status** is an equality filter, so it stays usable inside that range.",
          "3. **due_date** comes last, so Postgres reads rows already sorted and skips the sort step.",
          "",
          "Run `EXPLAIN ANALYZE` before and after. You should see an *Index Scan* replace the *Seq Scan* and the *Sort* node disappear.",
        ].join("\n"),
        type: "text",
      },
    ],
    role: "assistant",
  },
];

export const invoicesConversation: NonNullable<ServerData["conversation"]> = {
  workspaceId: "11111111-2222-4333-8444-555555555555",
  chatId: invoicesChatId,
  createdAt: daysAgo(0, 14),
  creationKind: "message",
  firstMessage:
    invoicesTranscript[0]?.parts[0]?.type === "text"
      ? invoicesTranscript[0].parts[0].text
      : "",
  forkCheckpointId: null,
  forkKind: null,
  forkMessageId: null,
  forkTurnId: null,
  guestCleanupAttemptedAt: null,
  id: invoicesChatId,
  initialContentHash: null,
  initialModelId: "google/gemini-2.5-flash-lite",
  initialRequest: null,
  initialSeed: null,
  isPinned: false,
  operationId: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
  ownerId,
  parentConversationId: null,
  rootConversationId: null,
  sessionId: invoicesSessionId,
  state: "bound",
  title: "Postgres index for slow invoices query",
  titleStatus: "generated",
  updatedAt: daysAgo(0, 14),
  usageStreamIndex: 0,
  visibility: "private",
};

export const invoicesTrpc = {
  "eve.messageDisplay": [],
  ...signedInTrpc,
  "eve.branches": {
    branches: [
      {
        createdAt: invoicesConversation.createdAt,
        firstMessage: invoicesConversation.firstMessage,
        forkKind: null,
        forkMessageId: null,
        forkTurnId: null,
        groupCandidates: null,
        id: invoicesConversation.id,
        initialModelId: invoicesConversation.initialModelId,
        operationId: invoicesConversation.operationId,
        parentConversationId: null,
        responseGroupId: null,
        responseGroupIndex: null,
        sessionId: invoicesSessionId,
      },
    ],
    chatId: invoicesChatId,
    rootId: invoicesChatId,
  },
  "eve.get": {
    chatId: invoicesChatId,
    isPinned: false,
    href: `/chat/${invoicesChatId}`,
    parentHref: "/",
    title: invoicesConversation.title,
    titleStatus: "generated",
    visibility: "private",
  },
  "feedback.votes": [],
} satisfies Partial<Record<string, unknown>> & {
  "eve.branches": Outputs["eve"]["branches"];
  "eve.get": Outputs["eve"]["get"];
};

export const invoicesShared: NonNullable<ServerData["transcript"]> = {
  ownerId: session.user.id,
  id: invoicesChatId,
  messages: invoicesTranscript.map(({ id, metadata, parts, role }) => ({
    id,
    parts: [...parts],
    role,
    ...(metadata?.modelId === undefined || metadata.modelId === ""
      ? {}
      : { metadata: { modelId: metadata.modelId } }),
  })),
  title: invoicesConversation.title ?? "",
};

export const invoicesTranscripts = { [invoicesSessionId]: invoicesTranscript };

type Connector = Outputs["mcp"]["list"][number];
const connector = (
  id: string,
  name: string,
  url: string,
  extra: Partial<Connector> = {}
): Connector => ({
  createdAt: daysAgo(20),
  enabled: true,
  id,
  name,
  nameId: name.toLowerCase().replaceAll(" ", "_"),
  oauthClientId: null,
  oauthClientSecret: null,
  requireApproval: false,
  type: "http",
  updatedAt: daysAgo(2),
  url,
  userId: ownerId,
  ...extra,
});

export const linear = connector(
  "a1f3c5e7-2b4d-4f60-8a1c-3e5f7a9b1c2d",
  "Linear",
  "https://mcp.linear.app/mcp"
);
export const notion = connector(
  "b2e4d6f8-3c5e-4a71-9b2d-4f6a8b0c2d3e",
  "Notion",
  "https://mcp.notion.com/mcp"
);
export const wiki = connector(
  "c3f5e7a9-4d6f-4b82-8c3e-5a7b9c1d3e4f",
  "Team wiki",
  "https://wiki.northwind.dev/mcp"
);
export const sentry = connector(
  "d4a6f8b0-5e7a-4c93-9d4f-6b8c0d2e4f5a",
  "Sentry",
  "https://mcp.sentry.dev/mcp"
);
/** Configured for every account by the deployment, so the account can use it but not edit it. */
export const github = connector(
  "e5b7a9c1-6f8b-4da4-8e5a-7c9d1e3f5a6b",
  "GitHub",
  "https://api.githubcopilot.com/mcp/",
  { userId: null }
);

const discovery: Outputs["mcp"]["discover"] = {
  prompts: [],
  resources: [
    {
      description: "Issues assigned to you in the current cycle",
      mimeType: "application/json",
      name: "My issues",
      uri: "linear://issues/assigned",
    },
  ],
  tools: [
    {
      description: "Search issues by text, team, state, or assignee.",
      name: "search_issues",
    },
    {
      description: "Create an issue in a team with a title and description.",
      name: "create_issue",
    },
    {
      description: "Add a comment to an existing issue.",
      name: "create_comment",
    },
  ],
};

const githubDiscovery: Outputs["mcp"]["discover"] = {
  prompts: [],
  resources: [],
  tools: [
    {
      description: "Search code across the repositories you can read.",
      name: "search_code",
    },
    {
      description: "Open a pull request from a branch.",
      name: "create_pull_request",
    },
  ],
};

const incompatible =
  "Server requires pre-configured OAuth credentials (does not support dynamic client registration)";
const unreachable = "HTTP 503: Service Unavailable";

/** One connector in each state the settings show: connected, awaiting authorization,
 *  incompatible, unreachable, and a built-in one. */
const connectionStatus: Record<
  string,
  { error?: string; needsAuth: boolean; status: string }
> = {
  [github.id]: { needsAuth: false, status: "connected" },
  [linear.id]: { needsAuth: false, status: "connected" },
  [notion.id]: { needsAuth: true, status: "authorizing" },
  [sentry.id]: { error: unreachable, needsAuth: false, status: "disconnected" },
  [wiki.id]: { error: incompatible, needsAuth: false, status: "incompatible" },
};

const discoveryFor = (id: string) => {
  if (id === linear.id) {
    return discovery;
  }
  if (id === github.id) {
    return githubDiscovery;
  }
  if (id === notion.id) {
    return new TrpcFixtureError(
      "UNAUTHORIZED",
      "OAuth authorization required for this connector"
    );
  }
  return new TrpcFixtureError("INTERNAL_SERVER_ERROR", unreachable);
};

export const connectorsTrpc = {
  ...signedInTrpc,
  "mcp.checkAuth": (input: { id: string }) => ({
    hasSession: connectionStatus[input.id]?.status === "connected",
    isAuthenticated: connectionStatus[input.id]?.status === "connected",
  }),
  "mcp.discover": (input: { id: string }) => discoveryFor(input.id),
  "mcp.list": [linear, notion, wiki, sentry, github],
  "mcp.testConnection": (input: { id: string }) =>
    connectionStatus[input.id] ?? { needsAuth: false, status: "disconnected" },
};

const [launch] = projects;
export const launchProject = launch ?? projects[0];

export const launchChats: HistoryPage = {
  items: [
    chat(
      "7c8d9e0f-2a3b-4c4d-9e56-a7b8c9d0e1f2",
      "Launch checklist for Northwind Pay",
      daysAgo(0, 11),
      {
        parentHref: `/project/${launchProject?.id}`,
      }
    ),
    chat(
      "8d9e0f1a-3b4c-4d5e-8f67-b8c9d0e1f2a3",
      "Press release first draft",
      daysAgo(2),
      {
        parentHref: `/project/${launchProject?.id}`,
      }
    ),
    chat(
      "9e0f1a2b-4c5d-4e6f-9a78-c9d0e1f2a3b4",
      "FAQ for support team",
      daysAgo(5),
      {
        parentHref: `/project/${launchProject?.id}`,
      }
    ),
  ],
  nextCursor: null,
};

export const invoicesFollowupEvents: typeof route.events = {
  [invoicesSessionId]: [
    {
      type: "turn.completed",
      data: { turnId: "turn_0", sequence: 2 },
      meta: { id: "completed-invoices", at: "2026-10-18T10:00:00Z" },
    },
  ],
};
export const invoicesFollowupTrpc = {
  ...invoicesTrpc,
  "followupSuggestions.get": (input: {
    conversationId: string;
    eventId: string;
  }) => {
    if (
      input.conversationId !== invoicesConversation.id ||
      input.eventId !== "completed-invoices"
    ) {
      return new TrpcFixtureError(
        "BAD_REQUEST",
        "Unexpected follow-up completion identity"
      );
    }
    return [
      "How do I measure the improvement?",
      "What about partial indexes?",
      "Does column order matter?",
    ];
  },
};
