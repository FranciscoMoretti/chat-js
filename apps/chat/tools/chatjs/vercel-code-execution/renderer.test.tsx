import { expect, test, vi } from "vitest";
import { CodeExecution } from "./renderer";
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
  SandboxComposed: ({ code }: { readonly code: string }): React.JSX.Element => (
    <pre>{code}</pre>
  ),
}));

/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): vi.mock("@/tools/chatjs/_shared/code-execution/interactive-charts") preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
vi.mock(
  "@/tools/chatjs/_shared/code-execution/interactive-charts",
  (): { default: () => null } => ({
    default: (): null => null,
  })
);
/* oxlint-enable unicorn/no-null */

test("passes validated partial code to the sandbox while input is streaming", () => {
  const html = renderToStaticMarkup(
    <CodeExecution
      isReadonly={false}
      messageId="stream"
      tool={createStreamingTool({ code: "print(53 *" })}
    />
  );
  expect(html).toContain("print(53 *");
});

test("does not render malformed partial code", () => {
  const html = renderToStaticMarkup(
    <CodeExecution
      isReadonly={false}
      messageId="stream"
      tool={createStreamingTool({ code: { invalid: true } })}
    />
  );
  expect(html).not.toContain("invalid");
  expect(html).toContain("<pre></pre>");
});

test.each(["pyth", "java"])(
  "keeps code visible while language is %s",
  (language) => {
    const html = renderToStaticMarkup(
      <CodeExecution
        isReadonly={false}
        messageId="stream"
        tool={createStreamingTool({ code: "print(1)", language })}
      />
    );
    expect(html).toContain("print(1)");
  }
);
