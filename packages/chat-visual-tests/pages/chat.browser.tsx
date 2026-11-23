import { takeSnapshot } from "@uiverify/vitest";
import { conversationOf, SessionNotActiveError } from "eve/client";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { route } from "./route";

import ChatPage from "@/app/(chat)/chat/[id]/page";
import ChatLayout from "@/app/(chat)/layout";
import SharePage from "@/app/(chat)/share/[id]/page";

import { retainResponseGroupDraft } from "@/lib/eve/create-response-group";
import {
  prepareCreation,
  prepareResponseGroupCreation,
} from "@/lib/eve/pending-create";

import {
  cancelledActivityEvents,
  chatFailure,
  completedActivityEvents,
  connectionResultTranscripts,
  endedActivityEvents,
  history,
  invoicesConversation,
  invoicesFollowupEvents,
  invoicesFollowupTrpc,
  invoicesScrollTranscripts,
  invoicesSearchTrpc,
  invoicesShared,
  invoicesTranscripts,
  invoicesTrpc,
  launchProject,
  pendingActivityEvents,
  pendingActivityWithFirstAnswerEvents,
  questionTranscripts,
  session,
  signedIn,
  signInTranscripts,
  submittedActivityEvents,
  validatedToolTranscripts,
} from "./fixtures";
import { renderRoute } from "./render";

const conversation = (
  <ChatLayout>
    <ChatPage params={Promise.resolve({ id: invoicesConversation.id })} />
  </ChatLayout>
);
const request = {
  ...signedIn,
  path: `/chat/${invoicesConversation.chatId}`,
  server: { conversation: invoicesConversation, conversations: history },
  transcripts: invoicesTranscripts,
  trpc: invoicesTrpc,
};

test("conversation", async () => {
  await renderRoute(conversation, request);
  await expect
    .poll(() =>
      document.querySelector('[data-slot="message-scroller-viewport"]')
    )
    .not.toBeNull();
  await expect
    .element(page.getByText("invoices_account_status_due_idx"))
    .toBeVisible();
  await expect
    .poll(() => document.querySelector('[data-role="user"]'))
    .not.toBeNull();
  await expect
    .poll(() => document.querySelector('[data-role="assistant"]'))
    .not.toBeNull();
  await expect
    .element(page.getByRole("textbox", { name: "Message" }))
    .toBeVisible();
});

test("validated tools preserve receipt results, failures and native fallbacks", async () => {
  await renderRoute(conversation, {
    ...request,
    transcripts: validatedToolTranscripts,
  });
  await expect
    .element(page.getByText("sample-notes.md", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("File storage unavailable."))
    .toBeVisible();
  await expect
    .element(page.getByText("External tool result retained.", { exact: false }))
    .toBeVisible();
  await expect
    .element(
      page.getByText("Historical text output retained.", { exact: false })
    )
    .toBeVisible();
  await expect
    .element(page.getByText("This tool result could not be displayed."))
    .not.toBeInTheDocument();
  await expect
    .element(
      page.getByText(
        "MCP tool failed. Check the connector in settings and try again."
      )
    )
    .not.toBeInTheDocument();
  await page.screenshot({ path: "__screenshots__/validated-tools.png" });
});

test("active native turn shows thinking before visible content", async () => {
  await renderRoute(conversation, {
    ...request,
    agentStatus: "streaming",
    transcripts: {
      [invoicesConversation.sessionId ?? ""]: [
        { id: "pending", role: "assistant", parts: [] },
      ],
    },
  });
  await expect
    .element(page.getByTestId("message-assistant-loading"))
    .toBeVisible();
  await page.screenshot({ path: "__screenshots__/native-thinking.png" });
});

test("cancelled native file and command operations show stopped states", async () => {
  await renderRoute(conversation, {
    ...request,
    transcripts: {
      [invoicesConversation.sessionId ?? ""]: [
        {
          id: "cancelled",
          role: "assistant",
          parts: [
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              callId: "write-file",
              name: "write_file",
              label: "Write file",
              state: "cancelled",
              input: { path: "/workspace/notes.md" },
            },
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              callId: "code",
              name: "bash",
              label: "Code",
              state: "cancelled",
              input: {},
            },
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              callId: "mcp",
              name: "fixture__search",
              label: "Search",
              state: "cancelled",
              input: {},
            },
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              callId: "blocked",
              name: "awaitingTool",
              label: "Awaiting",
              state: "blocked",
              input: {},
            },
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              callId: "declined",
              name: "web_search",
              label: "Search",
              state: "rejected",
              input: {},
            },
          ],
        },
      ],
    },
  });
  await expect
    .element(
      page.getByRole("button", { name: "write_file Error", exact: true })
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "bash Error", exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "bash Error", exact: true }).click();
  await expect.element(page.getByText("Tool stopped.").first()).toBeVisible();
  await expect
    .element(
      page.getByRole("button", { name: "fixture__search Error", exact: true })
    )
    .toBeVisible();
  await page
    .getByRole("button", { name: "awaitingTool Awaiting approval" })
    .click();
  await expect.element(page.getByText("Waiting for input.")).toBeVisible();
  await page
    .getByRole("button", { name: "web_search Denied", exact: true })
    .click();
  await expect.element(page.getByText("Request declined.")).toBeVisible();
  await page.screenshot({ path: "__screenshots__/native-stopped.png" });
});

test("mobile conversation can reveal the transcript below the composer", async () => {
  await renderRoute(conversation, {
    ...request,
    transcripts: invoicesScrollTranscripts,
    viewports: [],
  });
  await expect
    .element(page.getByText("invoices_account_status_due_idx"))
    .toBeVisible();
  await page.viewport(390, 844);
  const viewport = document.querySelector<HTMLElement>(
    '[data-slot="message-scroller-viewport"]'
  );
  if (!viewport) {
    throw new Error("Missing transcript viewport");
  }
  const composer = page.getByRole("textbox", { name: "Message" });
  await expect.element(composer).toBeVisible();
  await expect
    .poll(
      () =>
        composer.element().getBoundingClientRect().bottom - window.innerHeight
    )
    .toBeLessThanOrEqual(0);
  await expect
    .poll(() => viewport.scrollHeight > viewport.clientHeight)
    .toBe(true);
  await expect
    .poll(
      () =>
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
          8 ||
        document.querySelector<HTMLElement>(
          '[data-slot="message-scroller-button"]'
        )?.dataset.active === "true"
    )
    .toBe(true);
  viewport.dispatchEvent(
    new WheelEvent("wheel", { deltaY: -1000, bubbles: true })
  );
  viewport.scrollTo({ top: 0, behavior: "instant" });
  viewport.dispatchEvent(new Event("scroll"));
  await expect
    .poll(
      () =>
        document.querySelector<HTMLElement>(
          '[data-slot="message-scroller-button"]'
        )?.dataset.active
    )
    .toBe("true");
  await expect
    .element(page.getByRole("button", { name: "Scroll to end", exact: true }))
    .toBeVisible();
  await takeSnapshot("mobile-transcript-scrolled-up");
  await page
    .getByRole("button", { name: "Scroll to end", exact: true })
    .click();
  await expect
    .poll(
      () => viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    )
    .toBeLessThan(2);
});

test("display receipts settle with a fresh native agent wrapper", async () => {
  const { sessionId } = invoicesConversation;
  if (sessionId === null || sessionId === "") {
    throw new Error("The conversation fixture must have a native session.");
  }
  await renderRoute(conversation, {
    ...request,
    transcripts: Object.fromEntries(
      Object.entries(invoicesTranscripts).map(([id, messages]) => [
        id,
        messages.map((message) =>
          message.role === "user"
            ? { ...message, id: "delivery:user" }
            : message
        ),
      ])
    ),
    events: {
      [sessionId]: [
        {
          type: "delivery.consumed",
          meta: {
            position: { line: 1, index: 0 },
            at: "2026-10-18T10:00:00Z",
          },
          data: {
            parts: [{ kind: "text", text: "Question" }],
            deliveryId: "delivery",
            turnId: "turn_0",
          },
        },
      ],
    },
    trpc: {
      ...invoicesTrpc,
      "eve.messageDisplay": [
        { kind: "send", deliveryId: "delivery", selectedTool: null },
      ],
    },
  });
  await expect
    .element(page.getByText("invoices_account_status_due_idx"))
    .toBeVisible();
  await expect
    .element(page.getByRole("textbox", { name: "Message" }))
    .toBeVisible();
});

test("edit replaces the selected history while sharing workspace", async () => {
  await renderRoute(conversation, {
    ...request,
    transcripts: Object.fromEntries(
      Object.entries(invoicesTranscripts).map(([id, messages]) => [
        id,
        messages.map((message) =>
          message.role === "assistant"
            ? {
                ...message,
                parts: [{ type: "text", text: "Add an index for this query." }],
              }
            : message
        ),
      ])
    ),
  });
  await page.getByRole("button", { name: "Edit message" }).first().click();
  await expect
    .element(
      page.getByText(
        "Replace this message in a new branch. Later messages are not included. All branches share workspace files and the installed environment. Forking does not roll files back."
      )
    )
    .toBeVisible();
});

test("comparison explains shared workspace and serialized turns", async () => {
  await renderRoute(conversation, request);
  await page.getByTestId("model-selector").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { exact: true, name: "1×" }).click();
  await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
  await userEvent.keyboard("{Escape}");
  await expect
    .element(
      page.getByText(
        "Each model receives its own conversation history in the shared workspace. Turns run one at a time; changes to workspace files are visible to every branch."
      )
    )
    .toBeVisible();
});

test("conversation whose creation was never confirmed", async () => {
  await renderRoute(conversation, {
    ...request,
    server: {
      conversation: {
        ...invoicesConversation,
        sessionId: null,
        state: "uncertain",
      },
      conversations: history,
    },
  });
  await expect
    .element(
      page.getByText("This browser does not have the original request.", {
        exact: false,
      })
    )
    .toBeVisible();
});

test("conversation inside a project", async () => {
  await renderRoute(conversation, {
    ...request,
    trpc: {
      ...invoicesTrpc,
      "eve.get": {
        ...invoicesTrpc["eve.get"],
        parentHref: `/project/${launchProject.id}`,
      },
      "project.forChat": launchProject,
      "project.getById": launchProject,
    },
  });
  await expect
    .element(
      page
        .getByRole("navigation", { name: "breadcrumb" })
        .getByRole("link", { name: launchProject.name })
    )
    .toBeVisible();
  // The sidebar's scroll area checks for overflow when it mounts or resizes, not
  // when its lists finish loading, so whether this sidebar (which overflows) shows
  // a scrollbar varies. Once both lists are in, have it check again.
  const sidebar = document.querySelector<HTMLElement>(
    '[data-slot="sidebar"] [data-slot="scroll-area-viewport"]'
  );
  if (!sidebar) {
    throw new Error("Missing sidebar viewport");
  }
  await expect
    .element(page.elementLocator(sidebar).getByText("Billing service"))
    .toBeVisible();
  await expect
    .element(
      page.elementLocator(sidebar).getByText("Onboarding email sequence ideas")
    )
    .toBeVisible();
  sidebar.dispatchEvent(new Event("scroll"));
  await expect
    .poll(() =>
      document.querySelector(
        '[data-slot="sidebar"] [data-slot="scroll-area-scrollbar"][data-has-overflow-y]'
      )
    )
    .not.toBeNull();
});

test("conversation whose last reply failed", async () => {
  await renderRoute(conversation, {
    ...request,
    agentError: chatFailure,
  });
  await expect
    .element(page.getByRole("alert").getByText(chatFailure))
    .toBeVisible();
  await expect
    .element(page.getByRole("alert").getByText("Chat error", { exact: true }))
    .toBeVisible();
  await page.viewport(390, 844);
  const alert = page
    .getByRole("alert")
    .filter({ hasText: chatFailure })
    .element();
  expect(alert.scrollWidth).toBeLessThanOrEqual(alert.clientWidth);
  expect(alert.getBoundingClientRect().right).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "__screenshots__/conversation-error.png" });
});

const unconfirmed = {
  ...invoicesConversation,
  sessionId: null,
  state: "uncertain" as const,
};

test("conversation whose creation is unconfirmed, with the request saved here", async () => {
  const saved = prepareCreation(
    sessionStorage,
    session.user.id,
    invoicesConversation.firstMessage,
    invoicesConversation.initialModelId ?? undefined
  );
  await renderRoute(conversation, {
    ...request,
    server: {
      conversation: { ...unconfirmed, operationId: saved.operationId },
      conversations: history,
    },
  });
  await expect
    .element(
      page.getByText(
        "Conversation creation is unconfirmed. Retry the saved request to recover it."
      )
    )
    .toBeVisible();
});

const shared = (
  <ChatLayout>
    <SharePage params={Promise.resolve({ id: invoicesConversation.id })} />
  </ChatLayout>
);

test("shared conversation", async () => {
  await renderRoute(shared, {
    path: `/share/${invoicesConversation.id}`,
    server: { transcript: invoicesShared },
  });
  await expect
    .element(page.getByText("invoices_account_status_due_idx"))
    .toBeVisible();
  await expect
    .element(
      page.getByText(
        "Shared conversations are read-only. Workspace access is private to the owner."
      )
    )
    .toBeVisible();
});

test("shared conversation, signed in", async () => {
  await renderRoute(shared, {
    ...signedIn,
    path: `/share/${invoicesConversation.id}`,
    server: { conversations: history, transcript: invoicesShared },
  });
  await expect
    .element(page.getByText("invoices_account_status_due_idx"))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Save to your chats" }))
    .not.toBeInTheDocument();
  await expect
    .element(
      page.getByText(
        "Shared conversations are read-only. Workspace access is private to the owner."
      )
    )
    .toBeVisible();
});

test("owner can select or write a question answer while the native turn stays open", async () => {
  await renderRoute(conversation, {
    ...request,
    agentStatus: "ready",
    transcripts: questionTranscripts,
  });
  await expect
    .element(page.getByText("Which invoice issue should we investigate?"))
    .toBeVisible();
  const choice = page.getByRole("radio", { name: /Query performance/u });
  await choice.click();
  await expect.element(choice).toBeChecked();
  const answer = page.getByRole("textbox", { name: "Your answer" });
  await answer.fill(
    "Compare overdue invoices across accounts\nInclude payment terms"
  );
  await expect.element(choice).not.toBeChecked();
  await expect
    .element(answer)
    .toHaveValue(
      "Compare overdue invoices across accounts\nInclude payment terms"
    );
  await expect
    .element(page.getByRole("button", { name: "Submit answer" }))
    .toBeEnabled();
  await expect
    .element(page.getByRole("textbox", { name: "Message", exact: true }))
    .toBeVisible();
});

test("owner can answer approval while the native turn stays open", async () => {
  await renderRoute(conversation, {
    ...request,
    agentStatus: "ready",
    transcripts: {
      [invoicesConversation.sessionId ?? ""]: [
        {
          id: "approval-message",
          role: "assistant",
          parts: [
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              name: "createTextDocument",
              label: "createTextDocument",
              callId: "delete-call",
              state: "approval",
              input: { title: "Invoice notes" },
              interaction: {
                interactionId: "delete-request",
                turnId: "fixture-turn",
                stepIndex: 0,
                status: "open",
                request: {
                  kind: "approval",
                  display: "confirmation",
                  prompt: "Approve this tool?",
                  options: [
                    { id: "approve", label: "Approve" },
                    { id: "deny", label: "Cancel" },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
  });
  await expect
    .element(page.getByRole("button", { name: "Approve", exact: true }))
    .toBeEnabled();
  await expect
    .element(page.getByRole("button", { name: "Cancel", exact: true }))
    .toBeEnabled();
});

test("native activity keeps both questions and approval answerable while working", async () => {
  await renderRoute(conversation, {
    ...request,
    agentStatus: "streaming",
    events: pendingActivityEvents,
    transcripts: {},
  });
  const activity = page.getByRole("button", { name: "Working 4 steps" });
  await expect.element(activity).toHaveAttribute("aria-expanded", "true");
  await activity.click();
  await expect.element(activity).toHaveAttribute("aria-expanded", "false");
  await expect
    .element(page.getByRole("button", { name: /lookup_invoices/u }))
    .not.toBeInTheDocument();

  const period = page.getByRole("button", { name: "Last month", exact: true });
  const format = page.getByRole("button", { name: "Summary", exact: true });
  const approve = page.getByRole("button", {
    name: "Approve publication",
    exact: true,
  });
  await expect.element(period).toBeEnabled();
  await expect.element(format).toBeEnabled();
  await expect.element(approve).toBeEnabled();
  await page.screenshot({ path: "__screenshots__/native-activity-busy.png" });

  await period.click();
  await format.click();
  await approve.click();
  await expect
    .poll(() => route.agentAnswers)
    .toEqual([
      { interactionId: "period", optionId: "month" },
      { interactionId: "format", optionId: "summary" },
      { interactionId: "publish-approval", optionId: "approve" },
    ]);
});

test("native replay keeps submitted answers distinct from settled outcomes", async () => {
  await renderRoute(conversation, {
    ...request,
    events: submittedActivityEvents,
    transcripts: {},
  });
  const activity = page.getByRole("button", {
    name: /Waiting for you.*1 of 4 failed/u,
  });
  await expect.element(activity).toHaveAttribute("aria-expanded", "true");
  await activity.click();
  await expect
    .element(page.getByRole("button", { name: "Stop", exact: true }))
    .toBeEnabled();
  await expect
    .element(page.getByText("Last month", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Answered", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Summary", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Response submitted", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Declined", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Notion connected.", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Linear authorization timed out.", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Summary", exact: true }))
    .not.toBeInTheDocument();
  await page.screenshot({ path: "__screenshots__/native-activity-replay.png" });
});

test("the native optimistic answer and its sibling's submitted answer both lock their own question", async () => {
  const { sessionId } = invoicesConversation;
  if (sessionId === null || sessionId === "") {
    throw new Error("The conversation fixture must have a native session.");
  }
  const events = pendingActivityWithFirstAnswerEvents[sessionId];
  const { messages } = conversationOf(events);
  const liveTranscripts = {
    [sessionId]: messages.map((message) => ({
      ...message,
      parts: message.parts.map((part) => {
        if (
          part.type !== "tool" ||
          part.interaction?.interactionId !== "format"
        ) {
          return part;
        }
        return {
          ...part,
          interaction: {
            ...part.interaction,
            answer: { interactionId: "format", optionId: "summary" },
          },
        };
      }),
    })),
  };
  await renderRoute(conversation, {
    ...request,
    agentStatus: "streaming",
    events: pendingActivityWithFirstAnswerEvents,
    liveTranscripts,
    transcripts: {},
    viewports: [],
  });
  await expect
    .element(page.getByText("Last month", { exact: true }))
    .toBeVisible();
  await expect
    .element(page.getByText("Summary", { exact: true }))
    .toBeVisible();
  await expect
    .poll(
      () => page.getByText("Response submitted", { exact: true }).all().length
    )
    .toBe(2);
  await expect
    .element(page.getByRole("button", { name: "Last month", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: "Summary", exact: true }))
    .not.toBeInTheDocument();
  await expect
    .element(
      page.getByRole("button", { name: "Approve publication", exact: true })
    )
    .toBeEnabled();
});

test("completed native activity shows timing and keeps the original tool details", async () => {
  await renderRoute(conversation, {
    ...request,
    events: completedActivityEvents,
    transcripts: {},
    trpc: { ...request.trpc, "followupSuggestions.get": null },
  });
  const activity = page.getByRole("button", {
    name: /Worked for \d+s 1 of 4 failed/u,
  });
  await expect.element(activity).toHaveAttribute("aria-expanded", "false");
  await expect
    .element(page.getByText("Answered", { exact: true }).last())
    .toBeVisible();
  await expect
    .element(page.getByText("Response submitted", { exact: true }))
    .not.toBeInTheDocument();
  await page.screenshot({
    path: "__screenshots__/native-activity-summary.png",
  });
  await activity.click();
  await page
    .getByRole("button", { name: "lookup_invoices Error", exact: true })
    .click();
  await expect
    .element(page.getByText("Invoice lookup is unavailable."))
    .toBeVisible();
  await expect.element(page.getByText(/"status": "overdue"/u)).toBeVisible();
  await page.viewport(1440, 1080);
  await expect.poll(() => window.innerHeight).toBe(1080);
  await page.screenshot({
    path: "__screenshots__/native-activity-expanded.png",
  });
});

test.each([
  ["restoring", { agentStatus: "resuming", events: pendingActivityEvents }],
  ["cancelled", { events: cancelledActivityEvents }],
  ["ended", { events: endedActivityEvents }],
  [
    "inactive",
    { agentError: new SessionNotActiveError(), events: pendingActivityEvents },
  ],
] satisfies readonly [string, Parameters<typeof renderRoute>[1]][])(
  "native interaction controls are disabled when %s",
  async (state, agent) => {
    await renderRoute(conversation, {
      ...request,
      ...agent,
      transcripts: {},
      viewports: state === "restoring" ? ["desktop", "mobile"] : [],
    });
    await expect
      .element(page.getByRole("button", { name: "Last month", exact: true }))
      .toBeDisabled();
    await expect
      .element(
        page.getByRole("button", { name: "Approve publication", exact: true })
      )
      .toBeDisabled();
    if (state === "restoring") {
      await page.screenshot({
        path: "__screenshots__/native-activity-restoring.png",
      });
    }
  }
);

test("lost branch response keeps source recovery visible instead of selecting the newest branch", async () => {
  prepareCreation(
    sessionStorage,
    session.user.id,
    "Replacement awaiting recovery",
    invoicesConversation.initialModelId ?? undefined,
    {
      conversationId: invoicesConversation.id,
      fork: { conversationId: invoicesConversation.id },
      forkKind: "edit",
    }
  );
  const otherId = "59b3709e-a5d7-4654-a52e-59b27302e30c";
  prepareCreation(
    sessionStorage,
    session.user.id,
    "Other pending branch",
    undefined,
    {
      conversationId: otherId,
      fork: { conversationId: otherId },
      forkKind: "edit",
    }
  );
  const [source] = invoicesTrpc["eve.branches"].branches;
  await renderRoute(conversation, {
    ...request,
    transcripts: {
      ...invoicesTranscripts,
      ses_newer: Object.values(invoicesTranscripts)[0],
    },
    trpc: {
      ...invoicesTrpc,
      "eve.branches": {
        ...invoicesTrpc["eve.branches"],
        branches: [
          {
            ...source,
            id: otherId,
            sessionId: "ses_newer",
            parentConversationId: source.id,
            createdAt: new Date("2027-01-01"),
          },
          source,
        ],
      },
    },
  });
  await expect
    .element(page.getByRole("button", { name: "Recover version" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("region", { name: "Version recovery" }))
    .toHaveTextContent("Replacement awaiting recovery");
});

test("shared conversation does not grant another account workspace access", async () => {
  await renderRoute(shared, {
    ...signedIn,
    path: `/share/${invoicesConversation.id}`,
    server: {
      conversations: history,
      transcript: { ...invoicesShared, ownerId: "another-owner" },
    },
  });
  await expect
    .element(
      page.getByText(
        "Shared conversations are read-only. Workspace access is private to the owner."
      )
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("region", { name: "Save shared conversation" }))
    .not.toBeInTheDocument();
});

test("deleting one branch preserves the shared workspace", async () => {
  await renderRoute(conversation, request);
  await page
    .getByRole("button", { name: `Chat menu: ${invoicesConversation.title}` })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect
    .element(page.getByRole("heading", { name: "Delete this conversation?" }))
    .toBeVisible();
  await expect
    .element(
      page.getByText(
        "Other branches keep their history and shared workspace.",
        { exact: false }
      )
    )
    .toBeVisible();
});

test.each(["waiting", "lost reply"])(
  "comparison workspace progress: %s",
  async (state) => {
    const groupId = "a1111111-2222-4333-8444-555555555555";
    const waitingId = "b1111111-2222-4333-8444-555555555555";
    const modelId = invoicesConversation.initialModelId ?? "openai/gpt-5-mini";
    const saved = prepareResponseGroupCreation(
      sessionStorage,
      session.user.id,
      invoicesConversation.firstMessage,
      [modelId, modelId]
    );
    const result = {
      id: groupId,
      candidates: [
        {
          state: "bound" as const,
          modelId,
          operationId: invoicesConversation.operationId,
          conversationId: invoicesConversation.id,
          sessionId: invoicesConversation.sessionId ?? "",
        },
        { state: "waiting" as const, modelId, operationId: waitingId },
      ],
    };
    retainResponseGroupDraft(sessionStorage, session.user.id, saved, result);
    const originalFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (
        (input instanceof Request ? input.url : input.toString()).includes(
          "/api/agent-response-groups"
        )
      ) {
        if (state === "lost reply") {
          throw new Error(
            "Comparison progress is unconfirmed. Retry the saved request."
          );
        }
        return Response.json(result);
      }
      return await originalFetch(input, init);
    });
    await renderRoute(conversation, {
      ...request,
      transcripts: Object.fromEntries(
        Object.entries(invoicesTranscripts).map(([id, messages]) => [
          id,
          messages.map((message) =>
            message.role === "assistant"
              ? {
                  ...message,
                  parts: [
                    {
                      type: "text",
                      text: "The first model finished. The next response waits for this workspace.",
                    },
                  ],
                }
              : message
          ),
        ])
      ),
      trpc: {
        ...invoicesTrpc,
        "eve.branches": {
          ...invoicesTrpc["eve.branches"],
          branches: invoicesTrpc["eve.branches"].branches.map((branch) => ({
            ...branch,
            responseGroupId: groupId,
            responseGroupIndex: 0,
            groupCandidates: result.candidates.map((candidate) => ({
              modelId: candidate.modelId,
              operationId: candidate.operationId,
            })),
          })),
        },
      },
    });
    if (state === "lost reply") {
      await expect
        .element(page.getByRole("alert"))
        .toHaveTextContent("Comparison progress is unconfirmed.");
      await expect
        .element(page.getByRole("button", { name: "Retry response" }))
        .toBeVisible();
    } else {
      await expect
        .element(
          page.getByText(
            "Waiting for the shared workspace. Responses continue automatically in this tab."
          )
        )
        .toBeVisible();
    }
  }
);

test("project assignment dialog from the chat menu", async () => {
  await renderRoute(conversation, {
    ...request,
    trpc: { ...invoicesTrpc, "project.forChat": launchProject },
  });
  await page
    .getByRole("button", { name: `Chat menu: ${invoicesConversation.title}` })
    .click();
  await page.getByRole("menuitem", { name: "Move to project" }).click();
  await expect.element(page.getByRole("dialog")).toBeVisible();
  await expect
    .element(page.getByRole("combobox", { name: "Project", exact: true }))
    .toHaveValue(launchProject.id);
});

test("conversation with saved private feedback", async () => {
  await renderRoute(conversation, {
    ...request,
    trpc: {
      ...invoicesTrpc,
      "feedback.votes": [{ messageId: "msg-assistant-1", isUpvoted: true }],
    },
  });
  await expect
    .element(page.getByTestId("message-upvote"))
    .toHaveAttribute("aria-pressed", "true");
  await expect.element(page.getByTestId("message-upvote")).toBeDisabled();
  await expect.element(page.getByTestId("message-downvote")).toBeEnabled();
});

test("conversation with persisted follow-up suggestions", async () => {
  await renderRoute(conversation, {
    ...request,
    events: invoicesFollowupEvents,
    trpc: invoicesFollowupTrpc,
  });
  await expect
    .element(
      page.getByRole("button", { name: "How do I measure the improvement?" })
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("group", { name: "Related questions" }))
    .toBeVisible();
});

test.each(["desktop", "mobile"] as const)(
  "search plugin finds conversation text from the sidebar header (%s)",
  async (viewport) => {
    await renderRoute(conversation, {
      ...request,
      trpc: invoicesSearchTrpc,
      viewports: [viewport],
    });
    if (viewport === "mobile") {
      await page.viewport(390, 844);
      await expect
        .element(page.getByRole("button", { name: /Search chats/u }))
        .not.toBeInTheDocument();
      await userEvent.click(
        page.getByRole("button", { name: "Toggle Sidebar", exact: true })
      );
    }
    await userEvent.click(page.getByRole("button", { name: /Search chats/u }));
    await userEvent.fill(page.getByRole("combobox"), "invoice");
    await expect
      .element(
        page.getByText("Add an index to speed up your", { exact: false })
      )
      .toBeVisible();
    await userEvent.click(page.getByRole("button", { name: "Close search" }));
    await expect
      .element(page.getByRole("button", { name: /Search chats/u }))
      .toHaveFocus();
    await userEvent.click(page.getByRole("button", { name: /Search chats/u }));
    await userEvent.fill(page.getByRole("combobox"), "invoice");
    await expect
      .element(
        page.getByText("Add an index to speed up your", { exact: false })
      )
      .toBeVisible();
    // Both native implementations restore focus after keyboard dismissal.
    await userEvent.keyboard("{Escape}");
    await expect
      .element(page.getByRole("button", { name: /Search chats/u }))
      .toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.fill(page.getByRole("combobox"), "invoice");
    await expect
      .element(
        page.getByText("Add an index to speed up your", { exact: false })
      )
      .toBeVisible();
    if (viewport === "mobile") {
      await userEvent.keyboard("{Escape}");
      await expect
        .element(page.getByRole("button", { name: /Search chats/u }))
        .toHaveFocus();
      await userEvent.click(
        page.getByRole("button", { name: /Search chats/u })
      );
      await userEvent.fill(page.getByRole("combobox"), "invoice");
      await expect
        .element(
          page.getByText("Add an index to speed up your", { exact: false })
        )
        .toBeVisible();
      // A nested dialog needs a backdrop above the sheet, not only behind it.
      await expect
        .poll(() => {
          const backdrop = document.querySelector(
            '[data-slot="dialog-overlay"]'
          );
          const bounds = backdrop?.getBoundingClientRect();
          return (
            bounds && {
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
              height: bounds.height,
            }
          );
        })
        .toEqual({
          left: 0,
          top: 0,
          width: window.innerWidth,
          height: window.innerHeight,
        });
    }
    await page.screenshot({
      path: `__screenshots__/search-sidebar-${viewport}.png`,
    });
  }
);

test.each(["desktop", "mobile"] as const)(
  "sharing dialog from the chat menu (%s)",
  async (viewport) => {
    await renderRoute(conversation, {
      ...request,
      viewports: [viewport],
      trpc: {
        ...invoicesTrpc,
        "sharing.get": { id: invoicesConversation.id, visibility: "private" },
        "sharing.setVisibility": { id: invoicesConversation.id },
      },
    });
    if (viewport === "mobile") {
      await page.viewport(390, 844);
    }
    await page
      .getByRole("button", { name: `Chat menu: ${invoicesConversation.title}` })
      .click();
    await page.getByRole("menuitem", { name: "Share", exact: true }).click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Share Chat", exact: true }))
      .toBeEnabled();
  }
);

test("completed, failed and cancelled turns refresh the displayed credit balance", async () => {
  await renderRoute(conversation, { ...request, viewports: ["desktop"] });
  await expect.element(page.getByText("8.42", { exact: true })).toBeVisible();
  const { sessionId } = invoicesConversation;
  if (sessionId === null) {
    throw new Error("The fixture needs a session.");
  }
  await expect.poll(() => route.agentEventHandlers.has(sessionId)).toBe(true);
  const onEvent = route.agentEventHandlers.get(sessionId);
  const event = invoicesFollowupEvents[sessionId]?.find(
    (candidate) => candidate.type === "turn.settled"
  );
  if (!onEvent || !event) {
    throw new Error("The runtime must subscribe before completing the turn.");
  }
  const endings = (["completed", "failed", "cancelled"] as const).map(
    (outcome) => ({
      ...event,
      data: { ...event.data, outcome },
    })
  );
  for (const [index, ending] of endings.entries()) {
    const balanceCents = 420 - index;
    route.trpc["credits.getAvailableCredits"] = { balanceCents };
    onEvent(ending);
    // oxlint-disable-next-line no-await-in-loop -- Each terminal event must refresh the mounted balance before emitting the next one; one gallery capture covers the unchanged layout.
    await expect
      .element(page.getByText((balanceCents / 100).toFixed(2), { exact: true }))
      .toBeVisible();
  }
  await expect
    .element(page.getByText("8.42", { exact: true }))
    .not.toBeInTheDocument();
});

test("nested model filters keep the picker open and keyboard selection works", async () => {
  await renderRoute(conversation, request);
  await page.getByTestId("model-selector").click();
  await page.getByRole("button", { name: "Filter models" }).click();
  await page.getByRole("checkbox").first().click();
  await expect
    .element(page.getByText("Clear filters", { exact: true }))
    .toBeVisible();
  await expect.element(page.getByPlaceholder("Search models...")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect
    .element(page.getByText("Filter by Tools", { exact: true }))
    .not.toBeInTheDocument();
  await expect.element(page.getByPlaceholder("Search models...")).toBeVisible();
  await page.getByRole("button", { name: "Filter models" }).click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await userEvent.keyboard("{Escape}");
  await page.getByPlaceholder("Search models...").fill("GPT-5 mini");
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await expect
    .element(page.getByPlaceholder("Search models..."))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByTestId("model-selector"))
    .toHaveTextContent("GPT-5 mini");
  await page.getByTestId("model-selector").click();
  await page
    .elementLocator(document.body)
    .screenshot({ path: "__screenshots__/native-model-picker.png" });
});

test("message activity renders reasoning, tool errors and falsy results in the chat route", async () => {
  await renderRoute(conversation, {
    ...request,
    transcripts: {
      [invoicesConversation.sessionId ?? ""]: [
        {
          id: "activity-message",
          role: "assistant",
          parts: [
            {
              type: "reasoning",
              text: "Checking the inventory before answering.",
              state: "done",
            },
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              callId: "inventory",
              name: "Inventory lookup",
              label: "Inventory lookup",
              state: "completed",
              input: { sku: "sample" },
              output: 0,
            },
            {
              type: "tool",
              kind: "tool",
              stepIndex: 0,
              callId: "offline",
              name: "Warehouse lookup",
              label: "Warehouse lookup",
              state: "failed",
              input: {},
              error: {
                code: "fixture_error",
                message: "Warehouse unavailable. Try again.",
              },
            },
            {
              type: "text",
              text: "There are no items available in this warehouse.",
            },
          ],
        },
      ],
    },
  });
  await page.getByRole("button", { name: /Worked.*1 of 3 failed/u }).click();
  await page
    .getByRole("button", { name: "Warehouse lookup Error", exact: true })
    .click();
  await expect
    .element(
      page.getByRole("alert").filter({ hasText: "Warehouse unavailable" })
    )
    .toBeVisible();
  await expect
    .element(page.getByTestId("message-reasoning-toggle"))
    .toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("message-reasoning-toggle").click();
  await expect
    .element(page.getByTestId("message-reasoning"))
    .toHaveTextContent("Checking the inventory before answering.");
});

test("native search connection result uses the generic tool view", async () => {
  await renderRoute(conversation, {
    ...request,
    transcripts: connectionResultTranscripts,
  });
  await expect
    .element(page.getByRole("button", { name: /firecrawl__firecrawl_search/u }))
    .toBeVisible();
  await expect
    .element(page.getByText(/Documentation for the example project/u))
    .toBeVisible();
  await page.screenshot({
    path: "__screenshots__/native-search-connection.png",
  });
  await page.viewport(390, 900);
  await expect.poll(() => window.innerWidth).toBe(390);
  await page.screenshot({
    path: "__screenshots__/native-search-connection-mobile.png",
  });
});

test("native connection sign-in", async () => {
  await renderRoute(conversation, {
    ...request,
    transcripts: signInTranscripts,
  });
  await expect
    .element(page.getByRole("link", { name: "Connect Notion" }))
    .toHaveAttribute("href", "https://example.invalid/notion-consent");
  await expect.element(page.getByText("DEMO-CODE")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Sign-in unavailable" }))
    .toBeDisabled();
  await page.viewport(390, 900);
  await expect.poll(() => window.innerWidth).toBe(390);
  await page.screenshot({
    path: "__screenshots__/native-connection-mobile.png",
  });
});
