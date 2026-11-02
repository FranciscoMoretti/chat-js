import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, expectTypeOf, test, vi } from "vitest";
import { z } from "zod";
import { defineToolRenderer } from "./define-renderer";
import type {
  ValidatedToolRenderer,
  ToolRendererProps,
} from "./define-renderer";
import { validateToolOutput } from "./validate-output";
import { createToolResult } from "@/lib/eve/tool-result";

const unvalidated = () => null;

const inputSchema = z.object({ text: z.string() });
const outputSchema = z.object({ words: z.number().int().nonnegative() });

test("authored output cannot widen its schema and runtime constraints run before receipts", () => {
  const output = validateToolOutput(outputSchema, { words: 2 });
  expectTypeOf(output).toEqualTypeOf<{ words: number }>();
  expect(createToolResult(output, 0).output).toEqual({ words: 2 });
  expect(() => validateToolOutput(outputSchema, { words: -1 })).toThrow();
  expect(() => {
    // @ts-expect-error The schema, not the supplied value, determines the result type.
    validateToolOutput(outputSchema, { words: "two" });
  }).toThrow();
});

test("schema input and output types remain distinct for normalization", () => {
  const schema = z.object({ words: z.string().transform(Number) });
  const output = validateToolOutput(schema, { words: "2" });
  expectTypeOf(output.words).toEqualTypeOf<number>();
  expect(output.words).toBe(2);
});

test("views receive parsed schema types and preliminary output state", () => {
  const rendered = vi.fn<(value: number) => void>();
  const Renderer = defineToolRenderer({
    inputSchema,
    outputSchema: outputSchema.extend({ label: z.string().default("Count") }),
    render: ({ tool }) => {
      if (tool.state !== "output-available") {
        expectTypeOf(tool.output).toEqualTypeOf<undefined>();
        return null;
      }
      expectTypeOf(tool.input.text).toEqualTypeOf<string>();
      expectTypeOf(tool.output.words).toEqualTypeOf<number>();
      expectTypeOf(tool.output.label).toEqualTypeOf<string>();
      expectTypeOf(tool.partial).toEqualTypeOf<true | undefined>();
      rendered(tool.output.words);
      return (
        <p>
          {tool.partial ? "Preliminary" : "Final"}: {tool.output.label}
        </p>
      );
    },
  });
  const props = { isReadonly: true, messageId: "m" };
  const tool = {
    input: { text: "one two" },
    output: { words: 2 },
    partial: true,
    state: "output-available",
    toolCallId: "count",
  };
  expect(
    renderToStaticMarkup(createElement(Renderer, { ...props, tool }))
  ).toContain("Preliminary: Count");
  expect(rendered).toHaveBeenCalledWith(2);
  rendered.mockClear();
  const invalid = renderToStaticMarkup(
    createElement(Renderer, {
      ...props,
      tool: { ...tool, output: { words: "old shape" } },
    })
  );
  expect(invalid).toContain("This tool result could not be displayed.");
  expect(rendered).not.toHaveBeenCalled();
});

test("callbacks and registrations cannot bypass the schema boundary", () => {
  defineToolRenderer({
    inputSchema,
    outputSchema,
    // @ts-expect-error A view expecting a string output cannot widen the numeric schema.
    render: (
      _props: ToolRendererProps<
        typeof inputSchema,
        z.ZodType<{ words: string }>
      >
    ) => null,
  });
  // @ts-expect-error Registration requires a validating wrapper, not a raw component.
  const renderer: ValidatedToolRenderer = unvalidated;
  expect(renderer).toBe(unvalidated);
});
