import { takeSnapshot } from "@uiverify/vitest";
import React from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockFooter,
} from "@/components/ui/code-block";
import { mount, unmount } from "@/tests/visual/primitive-mount";
import "./sandbox.css";

const emptyText = "";

test("code block footer preserves zero and can be omitted", async () => {
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
    container.querySelector(
      '[data-case="empty-code"] [data-slot="code-block-footer"]'
    )
  ).toBeNull();
  await takeSnapshot("code-block-zero-and-empty-footer");
  await page.screenshot();
  await unmount(fixture);
});
