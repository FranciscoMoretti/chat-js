import { route } from "./route";
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
  archivedDiagram,
  archivedDiagramTranscript,
  invoicesConversation,
  invoicesShared,
  invoicesTranscripts,
  invoicesTrpc,
  invoicesSearchTrpc,
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

test("mobile conversation can reveal the transcript below the composer", async () => {
  // The conversation capture already covers both mobile themes.
  await renderRoute(conversation, { ...request, viewports: [] });
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

  // A shared transcript has a footer after the last message. Resizing to mobile
  // must keep its save action reachable through the native end-scroll control.
  await page.viewport(390, 844);
  const viewport = document.querySelector<HTMLElement>(
    '[data-slot="message-scroller-viewport"]'
  );
  if (!viewport) {
    throw new Error("Missing shared transcript viewport");
  }
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
  await page
    .getByRole("button", { name: "Scroll to end", exact: true })
    .click();
  await expect
    .poll(
      () => viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    )
    .toBeLessThan(2);
  const save = page.getByRole("button", { name: "Save to your chats" });
  await expect.element(save).toBeVisible();
  await expect
    .poll(() => {
      const action = save.element().getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      return action.top >= bounds.top && action.bottom <= bounds.bottom;
    })
    .toBe(true);
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
              toolName: "createTextDocument",
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
                    prompt: "Approve Create document?",
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
    (candidate) => candidate.type === "turn.completed"
  );
  if (!onEvent || !event) {
    throw new Error("The runtime must subscribe before completing the turn.");
  }
  const endings = [
    event,
    {
      ...event,
      type: "turn.failed",
      data: {
        ...event.data,
        code: "provider_error",
        message: "Fixture failure",
      },
    },
    { ...event, type: "turn.cancelled" },
  ] as const;
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
              type: "dynamic-tool",
              toolCallId: "inventory",
              toolName: "Inventory lookup",
              state: "output-available",
              input: { sku: "sample" },
              output: 0,
            },
            {
              type: "dynamic-tool",
              toolCallId: "offline",
              toolName: "Warehouse lookup",
              state: "output-error",
              input: {},
              errorText: "Warehouse unavailable. Try again.",
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

test("a historical document remains readable after its plugin is removed", async () => {
  const { sessionId } = invoicesConversation;
  if (sessionId === null) {
    throw new Error("Missing fixture session");
  }
  await renderRoute(conversation, {
    ...request,
    transcripts: { [sessionId]: archivedDiagramTranscript },
    trpc: { ...invoicesTrpc, "eve.document": archivedDiagram },
  });
  await expect
    .element(page.getByRole("button", { name: 'Updated "Deployment flow"' }))
    .toBeVisible();
  await page.getByRole("button", { name: 'Updated "Deployment flow"' }).click();
  await expect
    .element(
      page.getByText("Your saved content is preserved.", { exact: false })
    )
    .toBeVisible();
  await expect
    .element(page.getByText(archivedDiagram.revision.content, { exact: true }))
    .toBeVisible();
  await expect
    .element(
      page.getByRole("button", { name: "Copy to clipboard", exact: true })
    )
    .toBeEnabled();
  expect(document.querySelector('[aria-label="Diagram source"]')).toBeNull();
  await expect
    .element(
      page.getByRole("button", { name: "Restore this version", exact: true })
    )
    .not.toBeInTheDocument();
});
