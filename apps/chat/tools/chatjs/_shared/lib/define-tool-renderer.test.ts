/* oxlint-disable import/no-namespace --
 * import/no-namespace (#528): The ChatjsUI namespace is the consumed SDK/module interface; renaming all member references requires changing that import contract.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { EveToolResult } from "@/components/eve/eve-tool-result";
import { createToolError, createToolResult } from "@/lib/eve/tool-result";
import type * as ChatjsUI from "@/tools/chatjs/ui";
/* oxlint-enable import/no-namespace */

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("@/components/eve/eve-document-tool")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): vi.mock("@/components/eve/eve-document-tool") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock("@/components/eve/eve-document-tool", () => ({
  EveDocumentTool: () => null,
}));
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable id-length, typescript/prefer-readonly-parameter-types --
 * id-length (#506): vi.mock("@/tools/chatjs/ui") uses z as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * typescript/prefer-readonly-parameter-types (#565): vi.mock("@/tools/chatjs/ui") accepts { tool, messageId, isReadonly }; { updates }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
vi.mock("@/tools/chatjs/ui", async (importOriginal) => {
  const { z } = await import("zod");
  const { createElement: reactCreateElement } = await import("react");
  const { defineToolRenderer } = await import("@/lib/ai/define-tool-renderer");
  const original = await importOriginal<typeof ChatjsUI>();
  return {
    ui: {
      ...original.ui,
      "tool-customEcho": defineToolRenderer({
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ echoed: z.string() }),
        render: ({ tool, messageId, isReadonly }) =>
          reactCreateElement(
            "p",
            { "data-message": messageId, "data-readonly": isReadonly },
            tool.state === "output-available" ? tool.output.echoed : "Loading"
          ),
        renderProgress: ({ updates }) =>
          reactCreateElement(
            "aside",
            {},
            updates.map((update) => update.label).join(", ")
          ),
        updateSchema: z.object({ label: z.string() }),
      }),
    },
  };
});
/* oxlint-enable id-length, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-params --
 * max-params (#511): renderResult keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
const renderResult = (
  toolName: string,
  input: unknown,
  output: unknown,
  isReadonly = true
): string =>
  renderToStaticMarkup(
    createElement(EveToolResult, {
      isReadonly,
      messageId: "message-fixture",
      part: {
        input,
        output,
        state: "output-available",
        toolCallId: "call-fixture",
        toolName,
        type: "dynamic-tool",
      },
    })
  );
/* oxlint-enable max-params */

test("dispatches a custom registry renderer and preserves view context", () => {
  const html = renderResult(
    "customEcho",
    { text: "hello" },
    { echoed: "hello" }
  );
  expect(html).toContain("hello");
  expect(html).toContain('data-message="message-fixture"');
  expect(html).toContain('data-readonly="true"');
  expect(
    renderResult("customEcho", { text: "hello" }, { echoed: "hello" }, false)
  ).toContain('data-readonly="false"');
});

test("validates custom input and output before invoking its typed renderer", () => {
  for (const [input, output] of [
    [{ text: 7 }, { echoed: "hello" }],
    [{ text: "hello" }, { echoed: { invalid: true } }],
  ]) {
    const html = renderResult("customEcho", input, output);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain("data-message");
  }
});

test("uses the installed word count renderer and rejects malformed persisted results", () => {
  expect(
    renderResult(
      "wordCount",
      { text: "one two" },
      {
        characters: 7,
        charactersNoSpaces: 6,
        sentences: 1,
        words: 2,
      }
    )
  ).toContain("Words");
  expect(
    renderResult("wordCount", { text: "one two" }, { words: {} })
  ).toContain("This tool result could not be displayed.");
});

test("shows a failed tool instead of its loading skeleton", () => {
  const html = renderToStaticMarkup(
    createElement(EveToolResult, {
      isReadonly: true,
      messageId: "message-fixture",
      part: {
        errorText: "Weather service unavailable",
        input: {},
        state: "output-error",
        toolCallId: "call-fixture",
        toolName: "getWeather",
        type: "dynamic-tool",
      },
    })
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Weather service unavailable");
  expect(html).not.toContain("skeleton");
});

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("validates receipt progress and retains completed evidence when execution fails" uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("validates receipt progress and retains completed evidence when execution fails", () => {
  const updates = [
    { label: "Source found" },
    { label: 42 },
    { unexpected: "ignored" },
  ];
  const success = renderResult(
    "customEcho",
    { text: "hello" },
    createToolResult({ echoed: "hello" }, 0, updates)
  );
  const failure = renderResult(
    "customEcho",
    { text: "hello" },
    createToolError(0, updates)
  );
  for (const html of [success, failure]) {
    expect(html).toContain("Source found");
    expect(html).not.toContain("42");
    expect(html).not.toContain("ignored");
  }
  expect(failure).toContain("The tool did not complete.");
});
/* oxlint-enable no-magic-numbers */
