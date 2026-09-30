import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

import { CodeExecution } from "./renderer";

vi.mock("@/components/sandbox", () => ({
  SandboxComposed: ({ code }: { code: string }) => <pre>{code}</pre>,
}));
vi.mock("@/tools/chatjs/_shared/code-execution/interactive-charts", () => ({
  default: () => null,
}));

test("passes validated partial code to the sandbox while input is streaming", () => {
  const html = renderToStaticMarkup(
    <CodeExecution
      isReadonly={false}
      messageId="stream"
      tool={{
        input: { code: "print(53 *" },
        state: "input-streaming",
        toolCallId: "stream",
      }}
    />
  );
  expect(html).toContain("print(53 *");
});

test("does not render malformed partial code", () => {
  const html = renderToStaticMarkup(
    <CodeExecution
      isReadonly={false}
      messageId="stream"
      tool={{
        input: { code: { invalid: true } },
        state: "input-streaming",
        toolCallId: "stream",
      }}
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
        tool={{
          input: { code: "print(1)", language },
          state: "input-streaming",
          toolCallId: "stream",
        }}
      />
    );
    expect(html).toContain("print(1)");
  }
);
