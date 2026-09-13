import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { EveToolResult } from "@/components/eve/eve-tool-result";

vi.mock("@/tools/chatjs/ui", async (importOriginal) => {
  const { z } = await import("zod");
  const { createElement } = await import("react");
  const { defineToolRenderer } = await import("@/lib/ai/define-tool-renderer");
  const original = await importOriginal<typeof import("@/tools/chatjs/ui")>();
  return {
    ui: {
      ...original.ui,
      "tool-customEcho": defineToolRenderer({
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ echoed: z.string() }),
        render: ({ tool, messageId, isReadonly }) =>
          createElement(
            "p",
            { "data-message": messageId, "data-readonly": isReadonly },
            tool.state === "output-available" ? tool.output.echoed : "Loading"
          ),
      }),
    },
  };
});

function renderResult(
  toolName: string,
  input: unknown,
  output: unknown,
  isReadonly = true
) {
  return renderToStaticMarkup(
    createElement(EveToolResult, {
      messageId: "message-fixture",
      isReadonly,
      part: {
        type: "dynamic-tool",
        toolName,
        toolCallId: "call-fixture",
        state: "output-available",
        input,
        output,
      },
    })
  );
}

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
        words: 2,
        characters: 7,
        charactersNoSpaces: 6,
        sentences: 1,
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
      messageId: "message-fixture",
      isReadonly: true,
      part: {
        type: "dynamic-tool",
        toolName: "getWeather",
        toolCallId: "call-fixture",
        state: "output-error",
        input: {},
        errorText: "Weather service unavailable",
      },
    })
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Weather service unavailable");
  expect(html).not.toContain("skeleton");
});
