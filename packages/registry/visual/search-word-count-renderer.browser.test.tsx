import React, { act } from "react";
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import {
  createToolError,
  createToolResult,
} from "../../../apps/chat/lib/eve/tool-result";
/* oxlint-enable import/no-relative-parent-imports */
import { expect, test, vi } from "vitest";
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import { EveToolResult } from "../../../apps/chat/components/eve/eve-tool-result";
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
import { createRoot } from "react-dom/client";
import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- The search renderer dependency graph loads Vaul, whose module appends drawer CSS to document.head; keep this global stylesheet after that injected style. */
import "../../../apps/chat/app/globals.css";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
vi.mock("@/lib/ai/tool-renderer-registry", async () => {
  const { WordCountRenderer: Renderer } =
    await import("../src/tools/word-count/renderer");
  return { getEveInstalledToolRenderer: (): typeof Renderer => Renderer };
});
/* oxlint-disable react/jsx-no-literals -- render fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-relative-parent-imports */

vi.mock("@/components/part/message-annotations", () => ({
  ResearchUpdates: (): React.JSX.Element => <span>Search updates</span>,
}));
/* oxlint-enable react/jsx-no-literals */

vi.mock("@/lib/stores/hooks-message-parts", () => ({
  useMessageResearchUpdatePartByToolCallId: (): {
    data: Record<string, never>;
  }[] => [{ data: {} }],
}));
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */

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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading textContent from container.querySelector(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    container.querySelector("[data-testid=word-count-error]")?.textContent
  ).toBe("Tool unavailable");
  expect(
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading textContent from container.querySelector(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    container.querySelector("[data-testid=native-receipt]")?.textContent
  ).toContain("Words");
  expect(
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading textContent from container.querySelector(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
