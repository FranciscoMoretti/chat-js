import { describe, expect, test, vi } from "vitest";
import { CodeExecution } from "./renderer";
import { CodeExecution as RegistryCodeExecution } from "../../../../../packages/registry/src/tools/code-execution/renderer";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const createStreamingTool = (
  input: unknown
): {
  readonly input: unknown;
  readonly state: "input-streaming";
  readonly toolCallId: string;
} => ({
  input,
  state: "input-streaming",
  toolCallId: "stream",
});

vi.mock("@/components/sandbox", () => ({
  SandboxComposed: ({
    code,
    language,
    title,
  }: {
    readonly code: string;
    readonly language: string;
    readonly title: string;
  }): React.JSX.Element => (
    <pre data-language={language} data-title={title}>
      {code}
    </pre>
  ),
}));

vi.mock(
  "@/chatjs/tools/_shared/code-execution/interactive-charts",
  (): { default: () => null } => ({
    default: (): null => null,
  })
);

describe.each([
  { name: "app", Renderer: CodeExecution },
  { name: "registry", Renderer: RegistryCodeExecution },
])("$name code execution renderer", ({ Renderer }) => {
  test("passes validated partial code to the sandbox while input is streaming", () => {
    const html = renderToStaticMarkup(
      <Renderer
        isReadonly={false}
        messageId="stream"
        tool={createStreamingTool({ code: "print(53 *" })}
      />
    );
    expect(html).toContain("print(53 *");
  });

  test.each([
    { code: { invalid: true } },
    { code: { invalid: true }, language: "pyth", title: {} },
  ])("does not render malformed partial code %j", (input) => {
    const html = renderToStaticMarkup(
      <Renderer
        isReadonly={false}
        messageId="stream"
        tool={createStreamingTool(input)}
      />
    );
    expect(html).not.toContain("invalid");
    expect(html).toContain('data-language="python" data-title=""></pre>');
  });

  test.each(["pyth", "java", null, 42, {}])(
    "keeps code and title visible while language is %j",
    (language) => {
      const html = renderToStaticMarkup(
        <Renderer
          isReadonly={false}
          messageId="stream"
          tool={createStreamingTool({
            code: "print(1)",
            language,
            title: "Calculation",
          })}
        />
      );
      expect(html).toContain("print(1)");
      expect(html).toContain('data-language="python"');
      expect(html).toContain('data-title="Calculation"');
    }
  );

  test.each([{ title: null }, { title: 42 }, { title: {} }, { title: [] }])(
    "keeps code and language visible while title is $title",
    ({ title }) => {
      const html = renderToStaticMarkup(
        <Renderer
          isReadonly={false}
          messageId="stream"
          tool={createStreamingTool({
            code: "console.log(1)",
            language: "javascript",
            title,
          })}
        />
      );
      expect(html).toContain("console.log(1)");
      expect(html).toContain('data-language="javascript"');
      expect(html).toContain('data-title=""');
    }
  );

  test("keeps code visible when both streaming metadata fields are malformed", () => {
    const html = renderToStaticMarkup(
      <Renderer
        isReadonly={false}
        messageId="stream"
        tool={createStreamingTool({
          code: "print(1)",
          language: "pyth",
          title: {},
        })}
      />
    );
    expect(html).toContain("print(1)");
    expect(html).toContain('data-language="python" data-title=""');
  });

  test.each([
    { code: "print(1)", language: "pyth", title: "Calculation" },
    { code: "print(1)", language: "python", title: {} },
  ])("rejects invalid completed input %j", (input) => {
    const html = renderToStaticMarkup(
      <Renderer
        isReadonly={false}
        messageId="complete"
        tool={{ input, state: "input-available", toolCallId: "complete" }}
      />
    );
    expect(html).toContain("This tool result could not be displayed.");
    expect(html).not.toContain("print(1)");
  });
});
