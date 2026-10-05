import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { act } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { EveToolResult } from "../../../apps/chat/components/eve/eve-tool-result";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  createToolError,
  createToolResult,
} from "../../../apps/chat/lib/eve/tool-result";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { WebSearchRenderer as FirecrawlSearchRenderer } from "../src/tools/firecrawl-search/renderer";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { WebSearchRenderer as TavilySearchRenderer } from "../src/tools/tavily-search/renderer";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { WordCountRenderer } from "../src/tools/word-count/renderer";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import "../../../apps/chat/app/globals.css";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
vi.mock("@/lib/ai/tool-renderer-registry", async () => {
  const { WordCountRenderer: Renderer } =
    await import("../src/tools/word-count/renderer");
  return { getEveInstalledToolRenderer: () => Renderer };
});
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

vi.mock("@/components/part/message-annotations", () => ({
  ResearchUpdates: () => <span>Search updates</span>,
}));

/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
vi.mock("@/lib/stores/hooks-message-parts", () => ({
  useMessageResearchUpdatePartByToolCallId: () => [{ data: {} }],
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
test("search and word-count renderers preserve their visible states", async (): Promise<void> => {
  const container = document.createElement("main");
  document.documentElement.classList.add("dark");
  container.style.cssText =
    "padding:24px;background:#171717;width:700px;display:grid;gap:16px";
  document.body.append(container);
  const root = createRoot(container);

  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act((): void => {
    root.render(
      <>
        <section data-testid="firecrawl-search">
          <FirecrawlSearchRenderer
            isReadonly
            messageId="firecrawl-message"
            tool={{
              input: {
                search_queries: [{ maxResults: null, query: "latest news" }],
              },
              state: "input-available",
              toolCallId: "firecrawl-search",
            }}
          />
        </section>
        <section data-testid="tavily-search">
          <TavilySearchRenderer
            isReadonly
            messageId="tavily-message"
            tool={{
              input: {
                exclude_domains: null,
                searchDepth: null,
                search_queries: [{ maxResults: null, query: "latest news" }],
                topics: null,
              },
              output: { searches: [] },
              state: "output-available",
              toolCallId: "tavily-search",
            }}
          />
        </section>
        <section data-testid="word-count-loading">
          <WordCountRenderer
            isReadonly
            messageId="word-count-message"
            tool={{
              input: { text: "one two three" },
              state: "input-available",
              toolCallId: "word-count-loading",
            }}
          />
        </section>
        <section data-testid="word-count-output">
          <WordCountRenderer
            isReadonly
            messageId="word-count-message"
            tool={{
              input: { text: "one two three" },
              output: {
                characters: 13,
                charactersNoSpaces: 11,
                sentences: 1,
                words: 3,
              },
              state: "output-available",
              toolCallId: "word-count-output",
            }}
          />
        </section>
        <section data-testid="word-count-error">
          <WordCountRenderer
            isReadonly
            messageId="word-count-message"
            tool={{
              errorText: "Tool unavailable",
              input: undefined,
              state: "output-error",
              toolCallId: "word-count-error",
            }}
          />
        </section>
        <section data-testid="native-receipt">
          <EveToolResult
            isReadonly
            messageId="native-message"
            part={{
              input: { text: "one two" },
              output: createToolResult(
                {
                  characters: 7,
                  charactersNoSpaces: 6,
                  sentences: 1,
                  words: 2,
                },
                0
              ),
              state: "output-available",
              toolCallId: "native-success",
              toolName: "wordCount",
              type: "dynamic-tool",
            }}
          />
        </section>
        <section data-testid="native-receipt-error">
          <EveToolResult
            isReadonly
            messageId="native-message"
            part={{
              input: { text: "one two" },
              output: createToolError(0.02),
              state: "output-available",
              toolCallId: "native-error",
              toolName: "wordCount",
              type: "dynamic-tool",
            }}
          />
        </section>
      </>
    );
  });

  expect(
    container.querySelector("[data-testid=word-count-error]")?.textContent
  ).toBe("Tool unavailable");
  expect(
    container.querySelector("[data-testid=native-receipt]")?.textContent
  ).toContain("Words");
  expect(
    container.querySelector("[data-testid=native-receipt-error]")?.textContent
  ).toBe("The tool did not complete.");
  expect(container.textContent).toContain("Counting words...");
  expect(container.textContent).toContain("No spaces");
  expect(container.textContent).toContain("Searching…");
  await takeSnapshot("search-and-word-count-renderers");
  // oxlint-disable-next-line typescript/await-thenable, typescript/no-confusing-void-expression -- React act must be awaited to flush queued work before assertions; its synchronous overload is typed void.
  await act((): void => root.unmount());
  container.remove();
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
