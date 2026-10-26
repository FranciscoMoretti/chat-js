import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockFooter,
} from "@/components/ui/code-block";
import { Context, ContextInputUsage } from "@/components/ai-elements/context";
import { mount, unmount } from "@/tests/visual/primitive-mount";
import "./sandbox.css";

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
        <CodeBlock>
          <CodeBlockContent>const ready = true;</CodeBlockContent>
          <CodeBlockFooter>{0}</CodeBlockFooter>
        </CodeBlock>
      </section>
      <section data-case="empty-code">
        <h2>Empty toolbar child</h2>
        <CodeBlock>
          <CodeBlockContent>const empty = true;</CodeBlockContent>
          {emptyText}
        </CodeBlock>
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
  expect(container.querySelector('[data-case="usage"]')?.textContent).toContain(
    "Input"
  );
  expect(container.textContent).toContain("Custom usage");
  await takeSnapshot("optional-content-zero-empty-and-custom");
  await page.screenshot();
  await unmount(fixture);
});
