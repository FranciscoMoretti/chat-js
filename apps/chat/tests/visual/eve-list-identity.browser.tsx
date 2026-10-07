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

/* oxlint-disable-next-line eslint/max-statements -- Keep the focused browser capture's setup, assertions, and cleanup together. */
/* oxlint-disable-next-line eslint/max-statements, oxc/no-async-await -- eslint/max-statements: Keep this browser scenario setup, rendered assertions, capture, and cleanup together; oxc/no-async-await: Await the visual capture and sequence it before cleanup. */
test("EVE messages render streamed content and file parts", async () => {
  const container = document.createElement("main");
  container.className = "p-6";
  document.body.append(container);
  const root = createRoot(container);
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
    await takeSnapshot("eve-message-parts-and-attachments");
  } finally {
    act(() => {
      root.unmount();
    });
    container.remove();
  }
});
