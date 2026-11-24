import type { ReadonlyEveMessage as EveMessage } from "@/lib/eve/readonly-message-types";
import type { inferRouterOutputs } from "@trpc/server";
import type { SessionEvent } from "eve/client";

import type { Session } from "@/lib/auth";
import type { AppRouter } from "@/trpc/routers/_app";

import { assetDataUri } from "../../registry/src/tools/_shared/visual-fonts";
import type { ServerData, route } from "./route";
import { TrpcFixtureError } from "./route";

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
  branchId: id,
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
  "credits.getAvailableCredits": { balanceCents: 842 },
  "eve.list": (input: { projectId?: string | null }) => chatsIn(history, input),
  "mcp.listConnected": [],
  "project.list": projects,
  "project.forChat": null,
  "modelPreferences.getModelPreferences": [],
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
  id: invoicesChatId,
  initialContentHash: null,
  initialModelId: "google/gemini-2.5-flash-lite",
  initialRequest: null,
  initialSeed: null,
  isPinned: false,
  operationId: "9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a",
  ownerId,
  parentBranchId: null,
  rootBranchId: null,
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
        parentBranchId: null,
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

export const invoicesScrollTranscripts: Record<string, EveMessage[]> = {
  [invoicesSessionId]: [
    ...invoicesTranscript,
    {
      id: "scroll-followup-user",
      role: "user",
      parts: [{ type: "text", text: "How should I verify it in production?" }],
    },
    {
      id: "scroll-followup-answer",
      role: "assistant",
      parts: [
        {
          type: "text",
          state: "done",
          text: [
            "1. Measure how long the invoices query takes for a small account and a large one before the change.",
            "2. Build the index concurrently and check that the build completes before running comparisons.",
            "3. Compare query plans for the same accounts and confirm that each plan uses the new index.",
            "4. Check the query's response times when traffic returns to its usual level.",
            "5. Watch index usage and write latency for a full traffic cycle before removing any overlapping index.",
          ].join("\n"),
        },
      ],
    },
  ],
};

// Exercises the shared projection through the real observer, store and transcript.
export const validatedToolTranscripts = {
  [invoicesSessionId]: [
    {
      id: "tool-user",
      role: "user",
      parts: [
        { type: "text", text: "Attach the notes and show the other results." },
      ],
    },
    {
      id: "tool-answer",
      role: "assistant",
      metadata: { status: "complete", turnId: "turn-tools" },
      parts: [
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "attach_workspace_file",
          label: "attach_workspace_file",
          callId: "count-success",
          state: "completed",
          input: { path: "/workspace/sample-notes.md" },
          output: {
            kind: "chatjs.tool-result",
            version: 1,
            status: "success",
            output: {
              fileId: "abcdefghijklmnopqrstuvwx.md",
              name: "sample-notes.md",
              mediaType: "text/plain",
              size: 7,
              url: "/api/files/abcdefghijklmnopqrstuvwx.md",
            },
          },
        },
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "attach_workspace_file",
          label: "attach_workspace_file",
          callId: "count-failure",
          state: "completed",
          input: { path: "/workspace/sample-notes.md" },
          output: {
            kind: "chatjs.tool-result",
            version: 1,
            status: "error",
            output: null,
            error: "File storage unavailable.",
          },
        },
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "native__lookup",
          label: "native lookup",
          callId: "external-result",
          state: "completed",
          input: { query: "example" },
          output: "External tool result retained.",
        },
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "attach_workspace_file",
          label: "attach_workspace_file",
          callId: "imported-result",
          state: "completed",
          input: { path: "/workspace/sample-notes.md" },
          output: "Historical text output retained.",
        },
      ],
    },
  ],
} satisfies Record<string, EveMessage[]>;

export const questionTranscripts = {
  [invoicesSessionId]: [
    {
      id: "question-message",
      role: "assistant",
      parts: [
        { type: "text", text: "Let’s narrow down the invoice investigation." },
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "askQuestion",
          label: "askQuestion",
          callId: "question-call",
          state: "approval",
          input: {},
          interaction: {
            interactionId: "question-request",
            turnId: "fixture-turn",
            stepIndex: 0,
            status: "open",
            request: {
              kind: "question",
              display: "select",
              prompt: "Which invoice issue should we investigate?",
              allowFreeform: true,
              options: [
                {
                  id: "performance",
                  label: "Query performance",
                  description: "Find slow queries and missing indexes",
                },
                { id: "accuracy", label: "Invoice accuracy" },
              ],
            },
          },
        },
      ],
    },
  ],
} satisfies Record<string, readonly EveMessage[]>;

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
      type: "turn.settled",
      data: { turnId: "turn_0", outcome: "completed" },
      meta: { position: { line: 2, index: 0 }, at: "2026-10-18T10:00:00Z" },
    },
  ],
};
export const invoicesFollowupTrpc = {
  ...invoicesTrpc,
  "followupSuggestions.get": (input: { branchId: string; eventId: string }) => {
    if (
      input.branchId !== invoicesConversation.id ||
      input.eventId !==
        JSON.stringify([invoicesConversation.sessionId, "turn_0", "completed"])
    ) {
      return new TrpcFixtureError(
        "NOT_FOUND",
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

export const invoicesSearchTrpc = {
  ...invoicesTrpc,
  "search.query": {
    items: [
      {
        id: invoicesConversation.chatId,
        branchId: invoicesConversation.id,
        title: "Speed up our invoice query",
        excerpt: "Add an index to speed up your ⟦invoice⟧ query.",
        updatedAt: "2026-10-18T10:00:00.000Z",
        rank: 1,
      },
    ],
    nextCursor: null,
  },
};

export const chatFailure = `The model provider is unavailable. Request reference: ${"reference".repeat(20)}`;
export const creationFailure =
  "Unable to start this conversation. Choose another model.";

export const guestTranscript: EveMessage[] = [
  {
    id: "guest-question",
    role: "user",
    metadata: { status: "complete", turnId: "turn_0" },
    parts: [{ type: "text", text: "Hello", state: "done" }],
  },
  {
    id: "guest-answer",
    role: "assistant",
    metadata: {
      status: "complete",
      turnId: "turn_0",
      modelId: "openai/gpt-5-nano",
    },
    parts: [
      { type: "text", text: "Hello! How can I help you today?", state: "done" },
    ],
  },
];

export const connectionResultTranscripts = {
  [invoicesSessionId]: [
    {
      id: "web-search-answer",
      role: "assistant",
      metadata: { status: "complete", turnId: "web-search-turn" },
      parts: [
        { type: "text", text: "Here is the page you requested." },
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          callId: "web-search",
          name: "firecrawl__firecrawl_search",
          label: "Firecrawl search",
          state: "completed",
          input: { query: "Example documentation" },
          output: {
            web: [
              {
                url: "https://example.com",
                title: "Example documentation",
                description: "Documentation for the example project.",
              },
            ],
          },
        },
      ],
    },
  ],
} satisfies Record<string, readonly EveMessage[]>;

export const signInTranscripts = {
  [invoicesSessionId]: [
    {
      id: "notion-sign-in",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "Connect Notion to continue searching your workspace.",
        },
        {
          type: "interaction",
          interactionId: "notion-consent",
          turnId: "fixture-turn",
          stepIndex: 0,
          status: "open",
          request: {
            kind: "sign-in",
            prompt: "Sign in to Notion",
            signIn: {
              name: "notion",
              displayName: "Notion",
              url: "https://example.invalid/notion-consent",
              instructions: "Choose the pages this agent may access.",
              userCode: "DEMO-CODE",
            },
          },
        },
        {
          type: "interaction",
          interactionId: "invalid-consent",
          turnId: "fixture-turn",
          stepIndex: 0,
          status: "open",
          request: {
            kind: "sign-in",
            prompt: "Connection needs a new sign-in link",
            signIn: { name: "expired", url: "data:text/plain,unsafe" },
          },
        },
      ],
    },
  ],
} satisfies Record<string, readonly EveMessage[]>;

const activityTurn = { turnId: "activity-turn" };
const nativeActivity: readonly SessionEvent[] = [
  { type: "session.started", data: {} },
  { type: "delivery.admitted", data: { deliveryId: "request" } },
  {
    type: "turn.started",
    data: { ...activityTurn, cause: { deliveryId: "request" }, follows: null },
  },
  {
    type: "delivery.consumed",
    data: {
      ...activityTurn,
      deliveryId: "request",
      parts: [
        { kind: "text", text: "Put together an invoice activity report." },
      ],
    },
  },
  {
    type: "content.completed",
    data: {
      partId: "reasoning",
      kind: "reasoning",
      phase: "narration",
      value: "Check the reporting preferences and look up eligible invoices.",
    },
  },
  {
    type: "call.requested",
    data: {
      callId: "questions",
      owner: activityTurn,
      capability: { kind: "tool", name: "request_preferences" },
    },
  },
  { type: "call.started", data: { callId: "questions" } },
  {
    type: "interaction.opened",
    data: {
      interactionId: "period",
      subject: { callId: "questions" },
      request: {
        kind: "question",
        display: "confirmation",
        prompt: "Which period should the report cover?",
        options: [{ id: "month", label: "Last month" }],
      },
    },
  },
  {
    type: "interaction.opened",
    data: {
      interactionId: "format",
      subject: { callId: "questions" },
      request: {
        kind: "question",
        display: "confirmation",
        prompt: "Which format should I use?",
        options: [{ id: "summary", label: "Summary" }],
      },
    },
  },
  {
    type: "call.requested",
    data: {
      callId: "lookup",
      owner: activityTurn,
      capability: { kind: "tool", name: "lookup_invoices" },
      input: { status: "overdue" },
    },
  },
  { type: "call.started", data: { callId: "lookup" } },
  {
    type: "call.requested",
    data: {
      callId: "publish",
      owner: activityTurn,
      capability: { kind: "tool", name: "publish_report" },
    },
  },
  {
    type: "interaction.opened",
    data: {
      interactionId: "publish-approval",
      subject: { callId: "publish" },
      request: {
        kind: "approval",
        prompt: "Publish the invoice report?",
        options: [
          { id: "approve", label: "Approve publication" },
          { id: "deny", label: "Decline publication" },
        ],
      },
    },
  },
];

const submittedActivity: readonly SessionEvent[] = [
  ...nativeActivity,
  {
    type: "interaction.settled",
    data: {
      interactionId: "period",
      outcome: "accepted",
      response: { optionId: "month" },
    },
  },
  {
    type: "response.submitted",
    data: {
      responseId: "format-answer",
      interactionId: "format",
      deliveryId: "answers",
      value: { optionId: "summary" },
    },
  },
  {
    type: "interaction.settled",
    data: {
      interactionId: "publish-approval",
      outcome: "declined",
      response: { optionId: "deny" },
    },
  },
  {
    type: "call.settled",
    data: {
      callId: "publish",
      outcome: "rejected",
      cause: { interactionId: "publish-approval" },
    },
  },
  {
    type: "call.settled",
    data: {
      callId: "lookup",
      outcome: "failed",
      error: { code: "unavailable", message: "Invoice lookup is unavailable." },
    },
  },
  {
    type: "interaction.opened",
    data: {
      interactionId: "connect",
      subject: activityTurn,
      request: {
        kind: "sign-in",
        prompt: "Sign in to Notion",
        signIn: { name: "notion", displayName: "Notion" },
      },
    },
  },
  {
    type: "interaction.settled",
    data: { interactionId: "connect", outcome: "accepted" },
  },
  {
    type: "interaction.opened",
    data: {
      interactionId: "expired-connect",
      subject: activityTurn,
      request: {
        kind: "sign-in",
        prompt: "Sign in to Linear",
        signIn: { name: "linear", displayName: "Linear" },
      },
    },
  },
  {
    type: "interaction.settled",
    data: { interactionId: "expired-connect", outcome: "expired" },
  },
];

const activityEvents = (
  events: readonly SessionEvent[]
): typeof route.events => ({
  [invoicesSessionId]: events.map((event, line) => ({
    scope: activityTurn,
    ...event,
    meta: {
      at: new Date(Date.UTC(2026, 8, 24, 15, 29, line)).toISOString(),
      position: { line, index: 0 },
      endOfLine: true,
    },
  })),
});

export const pendingActivityEvents = activityEvents(nativeActivity);
export const steeringModelEvents = activityEvents([
  ...nativeActivity.slice(0, 4),
  {
    type: "model.started",
    data: {
      runId: "steered-response",
      modelId: "openai/gpt-5-mini",
      attempt: 0,
    },
  },
]);
export const pendingActivityWithFirstAnswerEvents = activityEvents([
  ...nativeActivity,
  {
    type: "response.submitted",
    data: {
      responseId: "period-answer",
      interactionId: "period",
      deliveryId: "answers",
      value: { optionId: "month" },
    },
  },
]);
export const submittedActivityEvents = activityEvents(submittedActivity);
export const completedActivityEvents = activityEvents([
  ...submittedActivity,
  {
    type: "interaction.settled",
    data: {
      interactionId: "format",
      outcome: "accepted",
      response: { optionId: "summary" },
    },
  },
  {
    type: "call.settled",
    data: {
      callId: "questions",
      outcome: "completed",
      output: { format: "summary" },
    },
  },
  { type: "turn.settled", data: { ...activityTurn, outcome: "completed" } },
]);
export const cancelledActivityEvents = activityEvents([
  ...nativeActivity,
  { type: "turn.settled", data: { ...activityTurn, outcome: "cancelled" } },
]);
export const endedActivityEvents = activityEvents([
  ...nativeActivity,
  { type: "session.ended", data: { outcome: "completed" } },
]);

const generatedImageArtwork = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="sky" x2="0" y2="1">
      <stop stop-color="#e7e5d6"/>
      <stop offset="1" stop-color="#babfad"/>
    </linearGradient>
  </defs>
  <path fill="url(#sky)" d="M0 0h640v360H0z"/>
  <circle cx="460" cy="100" r="42" fill="#f7f1dc"/>
  <path d="M0 240Q100 100 240 210T640 190V360H0Z" fill="#89937b"/>
  <path d="M0 290Q160 170 360 240T640 210V360H0Z" fill="#626e59"/>
  <path d="M0 320Q180 260 320 300T640 270V360H0Z" fill="#354b3e"/>
</svg>`)}`;

export const generatedImageTranscripts = {
  [invoicesSessionId]: [
    {
      id: "image-request",
      role: "user",
      parts: [{ type: "text", text: "Generate an image for the launch." }],
    },
    {
      id: "image-answer",
      role: "assistant",
      metadata: { status: "complete", turnId: "turn-image" },
      parts: [
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "generateImage",
          label: "Generate image",
          callId: "image-success",
          state: "completed",
          input: { prompt: "Launch artwork" },
          output: {
            kind: "chatjs.tool-result",
            version: 1,
            status: "success",
            output: {
              imageUrl: generatedImageArtwork,
              prompt: "Launch artwork",
            },
          },
        },
      ],
    },
  ],
} satisfies Record<string, readonly EveMessage[]>;

export const generatedVideoTranscripts = (videoUrl: string) =>
  ({
    [invoicesSessionId]: [
      {
        id: "video-request",
        role: "user",
        parts: [{ type: "text", text: "Generate a calm blue sky video." }],
      },
      {
        id: "video-answer",
        role: "assistant",
        metadata: { status: "complete", turnId: "turn-video" },
        parts: [
          {
            type: "tool",
            kind: "tool",
            stepIndex: 0,
            name: "generateVideo",
            label: "Generate video",
            callId: "video-success",
            state: "completed",
            input: { prompt: "A calm blue sky" },
            output: {
              kind: "chatjs.tool-result",
              version: 1,
              status: "success",
              output: { videoUrl, prompt: "A calm blue sky" },
            },
          },
        ],
      },
    ],
  }) satisfies Record<string, readonly EveMessage[]>;

export const publishedFileTranscripts = {
  [invoicesSessionId]: [
    {
      id: "published-file-answer",
      role: "assistant",
      metadata: { status: "complete", turnId: "turn-file" },
      parts: [
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "attach_workspace_file",
          label: "Attach workspace file",
          callId: "publish-success",
          state: "completed",
          input: { path: "/workspace/report.xlsx" },
          output: {
            fileId: "published-file",
            name: "report.xlsx",
            mediaType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            size: 24_576,
            url: "data:application/octet-stream;base64,cmVwb3J0",
          },
        },
      ],
    },
  ],
} satisfies Record<string, readonly EveMessage[]>;

export const nativeFileTranscripts = {
  [invoicesSessionId]: [
    {
      id: "uploaded-sheet",
      role: "user",
      parts: [
        {
          type: "file",
          filename: "budget.csv",
          mediaType: "text/csv",
          url: "data:text/csv,Item%2CCost%0AHosting%2C120",
        },
      ],
    },
    {
      id: "native-command",
      role: "assistant",
      metadata: { status: "complete", turnId: "turn-native" },
      parts: [
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "bash",
          label: "Run Python",
          callId: "native-bash",
          state: "completed",
          input: { command: "python3 analysis.py" },
          output: {
            status: "completed",
            exitCode: 0,
            stdout: "Created budget.csv and chart.png",
            stderr: "",
            truncated: false,
          },
        },
      ],
    },
  ],
} satisfies Record<string, readonly EveMessage[]>;

export const researchFileTranscripts = {
  [invoicesSessionId]: [
    {
      id: "research-file-answer",
      role: "assistant",
      metadata: { status: "complete", turnId: "turn-research-file" },
      parts: [
        {
          type: "reasoning",
          text: "Find the launch references and assemble the report.",
          state: "done",
        },
        {
          type: "tool",
          kind: "tool",
          stepIndex: 0,
          name: "deepResearch",
          label: "Deep Research",
          callId: "research-file",
          state: "completed",
          input: { request: "Research a launch plan" },
          output: {
            kind: "chatjs.tool-result",
            version: 1,
            status: "success",
            output: {
              format: "report",
              path: "/workspace/research/example/report.md",
              title: "Research report",
            },
          },
        },
        {
          type: "tool",
          kind: "tool",
          stepIndex: 1,
          name: "attach_workspace_file",
          label: "Attach workspace file",
          callId: "publish-research-file",
          state: "completed",
          input: {
            path: "/workspace/research/example/report.md",
            name: "Research report.md",
          },
          output: {
            fileId: "research_report_file_0001",
            name: "Research report.md",
            url: "/api/files/research_report_file_0001",
            mediaType: "text/plain",
            size: 4096,
          },
        },
      ],
    },
  ],
} satisfies Record<string, readonly EveMessage[]>;
