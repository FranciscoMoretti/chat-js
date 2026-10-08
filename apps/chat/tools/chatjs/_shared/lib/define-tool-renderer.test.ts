import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test, vi } from "vitest";
import type { ZodType } from "zod";

import { EveToolResult } from "@/components/eve/eve-tool-result";
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { createToolError, createToolResult } from "@/lib/eve/tool-result";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ui as chatjsUi } from "@/tools/chatjs/ui";
/* oxlint-enable sort-imports */

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): vi.mock("@/components/eve/eve-document-tool") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock(
  "@/components/eve/eve-document-tool",
  (): { EveDocumentTool: () => null } => ({
    EveDocumentTool: (): null => null,
  })
);
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve vi.mock's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable unicorn/no-null */

vi.mock("@/tools/chatjs/ui", async (importOriginal) => {
  const { z: zod } = await import("zod");
  const { createElement: reactCreateElement } = await import("react");
  const { defineToolRenderer } = await import("@/lib/ai/define-tool-renderer");
  const original = await importOriginal<{ ui: typeof chatjsUi }>();
  return {
    ui: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing original.ui own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...original.ui,
      "tool-customEcho": defineToolRenderer({
        inputSchema: zod.object({ text: zod.string() }),
        outputSchema: zod.object({ echoed: zod.string() }),
        render: ({
          tool,
          messageId,
          isReadonly,
        }: ReadonlyNativeSurface<
          ToolRendererProps<
            ZodType<{ text: string }>,
            ZodType<{ echoed: string }>
          >
        >) =>
          reactCreateElement(
            "p",
            { "data-message": messageId, "data-readonly": isReadonly },
            // oxlint-disable-next-line no-ternary -- Keep reactCreateElement argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            tool.state === "output-available" ? tool.output.echoed : "Loading"
          ),
        renderProgress: ({
          updates,
        }: {
          readonly updates: readonly { readonly label: string }[];
        }) =>
          reactCreateElement(
            "aside",
            {},
            updates.map((update) => update.label).join(", ")
          ),
        updateSchema: zod.object({ label: zod.string() }),
      }),
    },
  };
});
/* oxlint-enable oxc/no-async-await */
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
