import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import ChatPage from "@/app/(chat)/chat/[id]/page";
import ChatLayout from "@/app/(chat)/layout";
import SharePage from "@/app/(chat)/share/[id]/page";

import { prepareCreation } from "@/lib/eve/pending-create";

import {
  history,
  invoicesConversation,
  invoicesShared,
  invoicesTranscripts,
  invoicesTrpc,
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

test("edit replaces the selected message in a fresh sandbox", async () => {
  await renderRoute(conversation, request);
  await page.getByRole("button", { name: "Edit message" }).first().click();
  await expect
    .element(
      page.getByText(
        "Replace this message in a new branch. Later messages are not included. The branch starts with a fresh sandbox."
      )
    )
    .toBeVisible();
});

test("comparison explains its current history and fresh sandboxes", async () => {
  await renderRoute(conversation, request);
  await page.getByTestId("model-selector").click();
  await page.getByRole("switch", { name: "Use Multiple Models" }).click();
  await page.getByRole("button", { exact: true, name: "1×" }).click();
  await page.getByRole("menuitem", { exact: true, name: "2x" }).click();
  await userEvent.keyboard("{Escape}");
  await expect
    .element(
      page.getByText(
        "Each model receives a copy of the current completed conversation and a fresh sandbox."
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
      "eve.get": { ...invoicesTrpc["eve.get"], projectId: launchProject.id },
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
  const copy = { ...unconfirmed, creationKind: "copy" as const };
  await renderRoute(conversation, {
    ...request,
    server: {
      conversation: copy,
      conversations: history,
      copyOperation: {
        conversation: { ...copy, guestCleanupAttemptedAt: null },
        copy: {
          acceptedAt: null,
          conversationId: copy.id,
          documentsReady: false,
          ownerId: session.user.id,
          phase: "preparing",
          plan: null,
          planHash: "",
          projectionHash: "",
          seed: null,
          sourceConversationId: "f1e2d3c4-b5a6-4978-8a6b-5c4d3e2f1a0b",
          sourceOwnerId: "user_priya",
          sourceSessionId: "ses_shared",
        },
      },
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
      page.getByRole("link", { name: "Sign in to save this conversation" })
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
