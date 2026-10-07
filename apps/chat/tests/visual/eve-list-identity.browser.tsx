import { takeSnapshot } from "@uiverify/vitest";
import type { EveMessage } from "eve/client";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

import { EveMessages } from "@/components/eve/eve-messages";
import { EveSearchResultsView } from "@/components/eve/eve-search-results-view";

import "./sandbox.css";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});

/* oxlint-disable typescript/explicit-function-return-type -- Response mock: Keep this capture focused on EVE list rendering without loading Streamdown's unrelated browser plugin runtime. */
vi.mock("@/components/ai-elements/response", () => ({
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- React child elements retain the framework's ReactNode type in this mock signature.
  Response: ({ children }: Readonly<{ children: React.ReactNode }>) => (
    <div>{children}</div>
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
const messages: readonly EveMessage[] = [
  {
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
  },
  {
    id: "assistant-message",
    metadata: { status: "complete", turnId: "turn-1" },
    parts: [
      {
        state: "done",
        stepIndex: 0,
        text: "Revenue grew this quarter.",
        type: "text",
      },
      {
        state: "done",
        stepIndex: 0,
        text: "The source totals agree.",
        type: "reasoning",
      },
    ],
    role: "assistant",
  },
];

/* oxlint-disable-next-line eslint/max-statements -- Keep the focused browser capture's setup, assertions, and cleanup together. */
test("search results retain distinct repeated highlight locations", async () => {
  const container = document.createElement("main");
  container.className = "p-6";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      await Promise.resolve();
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
    // oxlint-disable-next-line no-magic-numbers -- The fixture contains two repeated highlighted spans.
    expect(container.querySelectorAll("mark")).toHaveLength(2);
    await takeSnapshot("eve-search-repeated-highlights");
  } finally {
    await act(async () => {
      await Promise.resolve();
      root.unmount();
    });
    container.remove();
  }
});

/* oxlint-disable-next-line eslint/max-statements -- Keep the focused browser capture's setup, assertions, and cleanup together. */
test("EVE messages render streamed content and file parts", async () => {
  const container = document.createElement("main");
  container.className = "p-6";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      await Promise.resolve();
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
    await takeSnapshot("eve-message-parts-and-attachments");
  } finally {
    await act(async () => {
      await Promise.resolve();
      root.unmount();
    });
    container.remove();
  }
});
