import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import ChatPage from "@/app/(chat)/chat/[id]/page";
import ChatLayout from "@/app/(chat)/layout";
import SharePage from "@/app/(chat)/share/[id]/page";

import { retainResponseGroupDraft } from "@/lib/eve/create-response-group";
import {
  prepareResponseGroupCreation,
  prepareCreation,
} from "@/lib/eve/pending-create";

import {
  history,
  invoicesConversation,
  invoicesShared,
  invoicesTranscripts,
  invoicesTrpc,
  invoicesFollowupEvents,
  invoicesFollowupTrpc,
  launchProject,
  session,
  signedIn,
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
    .element(page.getByText("invoices_account_status_due_idx"))
    .toBeVisible();
  await expect
    .element(page.getByRole("textbox", { name: "Message" }))
    .toBeVisible();
});

test("display receipts settle with a fresh native agent wrapper", async () => {
  const { sessionId } = invoicesConversation;
  if (sessionId === null || sessionId === "") {
    throw new Error("The conversation fixture must have a native session.");
  }
  await renderRoute(conversation, {
    ...request,
    events: {
      [sessionId]: [
        {
          type: "message.received",
          meta: {
            id: "received",
            at: "2026-10-18T10:00:00Z",
            deliveryIds: ["delivery"],
          },
          data: { message: "Question", sequence: 0, turnId: "turn_0" },
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
});

test("conversation whose last reply failed", async () => {
  await renderRoute(conversation, {
    ...request,
    agentError: "The model provider is unavailable. Try again in a moment.",
  });
  await expect
    .element(
      page
        .getByRole("alert")
        .getByText("The model provider is unavailable. Try again in a moment.")
    )
    .toBeVisible();
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

test("saved copy of a shared conversation that was not confirmed", async () => {
  const copy = {
    ...unconfirmed,
    creationKind: "copy" as const,
    parentConversationId: "f1e2d3c4-b5a6-4978-8a6b-5c4d3e2f1a0b",
  };
  await renderRoute(conversation, {
    ...request,
    server: {
      conversation: copy,
      conversations: history,
    },
  });
  await expect
    .element(
      page.getByText("Saving is unconfirmed. Retry to finish the saved copy.")
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
    .element(page.getByRole("region", { name: "Save shared conversation" }))
    .toBeVisible();
});

test("owner can answer approval while the native turn stays open", async () => {
  await renderRoute(conversation, {
    ...request,
    agentStatus: "streaming",
    transcripts: {
      [invoicesConversation.sessionId ?? ""]: [
        {
          id: "approval-message",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "deleteDocument",
              toolCallId: "delete-call",
              state: "approval-requested",
              approval: { id: "delete-request" },
              input: { title: "Invoice notes" },
              toolMetadata: {
                eve: {
                  kind: "tool-call",
                  name: "deleteDocument",
                  inputRequest: {
                    requestId: "delete-request",
                    kind: "tool-approval",
                    prompt: "Approve Delete document?",
                    allowFreeform: false,
                    display: "confirmation",
                    options: [
                      { id: "approve", label: "Approve" },
                      { id: "cancel", label: "Cancel" },
                    ],
                  },
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
