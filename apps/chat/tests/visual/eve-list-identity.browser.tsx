import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable-next-line sort-imports -- Keep the type-only EVE message fixture contract with the browser test imports. */
import type { EveMessage } from "eve/client";
/* oxlint-disable sort-imports -- Preserve React's default and named test imports as required by existing browser fixtures. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable sort-imports -- Preserve the fixture's grouped Vitest APIs. */
import { expect, test, vi } from "vitest";

import { EveMessages } from "@/components/eve/eve-messages";
import { EveSearchResultsView } from "@/components/eve/eve-search-results-view";

/* oxlint-disable sort-imports -- Keep the browser-only stylesheet after the components it styles, matching the adjacent visual fixtures. */
import "./sandbox.css";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- These type-only reader imports extend the existing runtime import groups; preserve module evaluation order and the formatter grouping. */
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
/* oxlint-enable sort-imports */

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

/* oxlint-disable typescript/explicit-function-return-type -- Response mock: Keep this capture focused on EVE list rendering without loading Streamdown's unrelated browser plugin runtime. */
vi.mock("@/components/ai-elements/response", () => ({
  Response: ({ children }: { readonly children: ReadonlyReactNode }) => (
    <div data-testid="response">{children}</div>
  ),
}));
/* oxlint-enable typescript/explicit-function-return-type */

const noopMock = vi.fn();
const noop = (): void => {
  noopMock();
};
const searchItems = [
  {
    conversationId: "conversation-1",
    excerpt: "The report mentions ⟦identity⟧ twice, then ⟦identity⟧ again.",
    id: "result-1",
    title: "Research report",
  },
];
const streamedTextPart = {
  text: "One more streamed text part.",
  type: "text" as const,
};
const userMessage: EveMessage = {
  id: "user-message",
  parts: [
    { text: "Summarize this report.", type: "text" },
    {
      filename: "quarterly-report.pdf",
      mediaType: "application/pdf",
      type: "file",
      url: "/api/files/abcdefghijklmnopqrstuvwx.pdf",
    },
  ],
  role: "user",
};
const assistantParts: EveMessage["parts"] = [
  {
    state: "done",
    text: "Revenue grew this quarter.",
    type: "text",
  },
  {
    text: "The answer is ready.",
    type: "text",
  },
  {
    state: "done",
    stepIndex: 0,
    text: "The source totals agree.",
    type: "reasoning",
  },
];
const assistantMessage: EveMessage = {
  id: "assistant-message",
  metadata: { status: "complete", turnId: "turn-1" },
  parts: assistantParts,
  role: "assistant",
};
const streamedAssistantMessage: EveMessage = {
  id: "assistant-message",
  metadata: { status: "complete", turnId: "turn-1" },
  parts: [...assistantParts, streamedTextPart],
  role: "assistant",
};
const messages: readonly EveMessage[] = [userMessage, assistantMessage];
const streamedMessages: readonly EveMessage[] = [
  userMessage,
  streamedAssistantMessage,
];
const responseCountBeforeStream = 3;
const responseCountAfterStream = 4;
type ResponseContainer = Readonly<Pick<ParentNode, "querySelectorAll">>;
const findResponse = (container: ResponseContainer, text: string): Element => {
  for (const response of container.querySelectorAll(
    '[data-testid="response"]'
  )) {
    if (response.textContent === text) {
      return response;
    }
  }
  throw new Error("The streamed assistant response was not rendered.");
};

/* oxlint-disable-next-line eslint/max-statements -- Keep the focused browser capture's setup, assertions, and cleanup together. */
/* oxlint-disable-next-line eslint/max-statements, oxc/no-async-await -- eslint/max-statements: Keep this browser scenario setup, precise highlight assertions, capture, and cleanup together; oxc/no-async-await: Await the visual capture and sequence it before cleanup. */
test("search results retain distinct repeated highlight locations", async () => {
  const container = document.createElement("main");
  container.className = "p-6";
  document.body.append(container);
  const root = createRoot(container);
  try {
    act(() => {
      root.render(
        <EveSearchResultsView
          disableLoadMore
          error={false}
          hasMore={false}
          isSearch
          items={searchItems}
          loadingMore={false}
          onClose={noop}
          onLoadMore={noop}
          onQueryChange={noop}
          onRetry={noop}
          onSelect={noop}
          pending={false}
          query="identity"
          searching={false}
        />
      );
    });
    const marks = [...container.querySelectorAll("mark")];
    const markTexts: string[] = [];
    const textAfterMarks: string[] = [];
    for (const mark of marks) {
      markTexts.push(mark.textContent ?? "");
      const sibling = mark.nextSibling;
      // oxlint-disable-next-line oxc/no-optional-chaining -- DOM sibling access is nullable; preserve a clear fixture failure when a marked span has no following text node.
      textAfterMarks.push(sibling?.textContent ?? "missing following text");
    }
    expect(markTexts).toEqual(["identity", "identity"]);
    expect(textAfterMarks).toEqual([" twice, then ", " again."]);
    await takeSnapshot("eve-search-repeated-highlights");
  } finally {
    act(() => {
      root.unmount();
    });
    container.remove();
  }
});

/* oxlint-disable eslint/max-statements, eslint/max-lines-per-function, oxc/no-async-await -- Keep the focused browser lifecycle's render, stream append assertion, capture, and cleanup together; the awaited snapshot must finish before teardown. */
test("EVE messages render streamed content and file parts", async () => {
  const container = document.createElement("main");
  container.className = "p-6";
  document.body.append(container);
  const root = createRoot(container);
  const consoleError = vi.spyOn(console, "error");
  try {
    act(() => {
      root.render(
        <EveMessages
          disabled={false}
          isReadonly
          messages={messages}
          respond={noop}
        />
      );
    });
    expect(container.querySelector('[data-testid="attachments"]')).toBeTruthy();
    expect(container.textContent).toContain("Revenue grew this quarter.");
    expect(container.querySelectorAll('[data-testid="response"]')).toHaveLength(
      responseCountBeforeStream
    );
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("same key")
    );
    const streamedResponse = findResponse(
      container,
      "Revenue grew this quarter."
    );
    // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must flush the streamed append before verifying the existing response stayed mounted.
    await act(() =>
      root.render(
        <EveMessages
          disabled={false}
          isReadonly
          messages={streamedMessages}
          respond={noop}
        />
      )
    );
    expect(container.contains(streamedResponse)).toBe(true);
    expect(container.querySelectorAll('[data-testid="response"]')).toHaveLength(
      responseCountAfterStream
    );
    await takeSnapshot("eve-message-parts-and-attachments");
  } finally {
    act(() => {
      root.unmount();
    });
    container.remove();
    consoleError.mockRestore();
  }
});
/* oxlint-enable eslint/max-statements, eslint/max-lines-per-function, oxc/no-async-await */
