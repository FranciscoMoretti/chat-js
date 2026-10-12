import { createDomHarness } from "@/components/test-dom-harness";
import { expect, test, vi } from "vitest";
import { CodeBlock } from "@/components/ai-elements/code-block";
import React, { act } from "react";
import type { TokensResult } from "shiki";
import type * as Shiki from "shiki";
import { takeSnapshot } from "@uiverify/vitest";
import { page } from "vitest/browser";
import "@/tests/visual/sandbox.css";

const pending = vi.hoisted(
  () =>
    new Map<
      string,
      {
        resolve: (result: TokensResult) => void;
        promise: Promise<TokensResult>;
      }[]
    >()
);

vi.mock("shiki", async (importOriginal) => ({
  ...(await importOriginal<typeof Shiki>()),
  codeToTokens: async (code: string): Promise<TokensResult> => {
    const { promise, resolve } = Promise.withResolvers<TokensResult>();
    const resolvers = pending.get(code) ?? [];
    resolvers.push({ resolve, promise });
    pending.set(code, resolvers);
    return await promise;
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("an older empty highlight cannot block streamed code until remount", async () => {
  let renderer: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    renderer = createDomHarness(<CodeBlock code="" language="python" />);
  });
  try {
    act(() => {
      renderer?.update(
        <CodeBlock code="print(53 * 41244)" language="python" />
      );
    });
    await act(async () => {
      for (const { resolve } of pending.get("") ?? []) {
        resolve({ tokens: [[]] });
      }
      await Promise.all(
        (pending.get("") ?? []).map(async ({ promise }) => await promise)
      );
    });
    await act(async () => {
      for (const { resolve } of pending.get("print(53 * 41244)") ?? []) {
        resolve({ tokens: [[{ content: "print(53 * 41244)", offset: 0 }]] });
      }
      await Promise.all(
        (pending.get("print(53 * 41244)") ?? []).map(
          async ({ promise }) => await promise
        )
      );
    });
    await expect
      .poll(() => renderer?.container.querySelector("pre")?.textContent)
      .toBe("print(53 * 41244)");
  } finally {
    act(() => renderer?.unmount());
    pending.clear();
  }
});

test("highlighted tokens preserve source text, line numbers, styling and keyboard focus", async () => {
  const source = '<img src=x onerror="alert(1)">\nsecond line';
  let renderer: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    renderer = createDomHarness(
      <CodeBlock code={source} language="html" showLineNumbers />
    );
  });
  try {
    await act(async () => {
      for (const { resolve } of pending.get(source) ?? []) {
        resolve({
          themeName: "one-light",
          fg: "#383a42",
          bg: "#fafafa",
          tokens: [
            [
              {
                content: '<img src=x onerror="alert(1)">',
                offset: 0,
                color: "#a626a4",
                fontStyle: 2,
              },
            ],
            [
              {
                content: "second line",
                offset: 29,
                color: "#0184bc",
                fontStyle: 1,
              },
            ],
          ],
        });
      }
      await Promise.all(
        (pending.get(source) ?? []).map(async ({ promise }) => await promise)
      );
    });
    const pre = renderer?.container.querySelector("pre");
    expect(pre?.textContent).toBe(
      '1<img src=x onerror="alert(1)">\n2second line'
    );
    expect(renderer?.container.querySelector("img")).toBeNull();
    expect(
      pre?.querySelector(".line > span:nth-child(2)")?.getAttribute("style")
    ).toContain("font-weight: bold");
    expect(
      pre
        ?.querySelector(".line:nth-of-type(2) > span:nth-child(2)")
        ?.getAttribute("style")
    ).toContain("font-style: italic");
    pre?.focus();
    expect(document.activeElement).toBe(pre);
    await takeSnapshot("safe-highlighted-source");
    await page.screenshot();
  } finally {
    act(() => renderer?.unmount());
    pending.clear();
  }
});
