import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Context, ContextInputUsage } from "@/components/ai-elements/context";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { MessageAttachments } from "@/components/ai-elements/message";
import { mount, unmount } from "@/tests/visual/primitive-mount";
import "./sandbox.css";

// Syntax highlighting is unrelated to optional toolbar chrome.
vi.mock("shiki", () => ({
  codeToTokens: vi.fn().mockResolvedValue({
    tokens: [[{ content: "const ready = true;", offset: 0 }]],
  }),
  getTokenStyleObject: () => ({}),
}));
const emptyText = "";

test("optional content preserves raw zero and default usage without empty chrome", async () => {
  const fixture = await mount(
    <main
      style={{
        padding: 24,
        width: 900,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
        background: "white",
        color: "black",
      }}
    >
      <section data-case="zero-code">
        <h2>Zero toolbar child</h2>
        <CodeBlock code="const ready = true;" language="javascript">
          {0}
        </CodeBlock>
      </section>
      <section data-case="empty-code">
        <h2>Empty toolbar child</h2>
        <CodeBlock code="const empty = true;" language="javascript">
          {emptyText}
        </CodeBlock>
      </section>
      <ConversationEmptyState title="Zero icon" icon={0} />
      <ConversationEmptyState title="Custom icon" icon={<span>Star</span>} />
      <section data-case="attachments">
        <MessageAttachments>{0}</MessageAttachments>
        <MessageAttachments>{emptyText}</MessageAttachments>
        <MessageAttachments>
          <span>Attachment present</span>
        </MessageAttachments>
      </section>
      <Context
        usedTokens={120}
        maxTokens={1000}
        usage={{ inputTokens: 120, outputTokens: 0, totalTokens: 120 }}
      >
        <section data-case="usage">
          <ContextInputUsage>{0}</ContextInputUsage>
          <ContextInputUsage>{emptyText}</ContextInputUsage>
          <ContextInputUsage>Custom usage</ContextInputUsage>
        </section>
      </Context>
    </main>
  );
  const { container } = fixture;
  await expect
    .poll(() => container.textContent)
    .toContain("const ready = true;");
  expect(
    container.querySelector('[data-case="zero-code"]')?.textContent
  ).toContain("0");
  expect(
    container.querySelector('[data-case="attachments"]')?.children
  ).toHaveLength(1);
  expect(container.querySelector('[data-case="usage"]')?.textContent).toContain(
    "Input"
  );
  expect(container.textContent).toContain("Custom usage");
  await takeSnapshot("optional-content-zero-empty-and-custom");
  await page.screenshot();
  await unmount(fixture);
});
