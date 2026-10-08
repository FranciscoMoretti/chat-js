import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test, vi } from "vitest";
/* oxlint-enable sort-imports */

import { CodeExecution } from "./renderer";

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

/* oxlint-disable react-perf/jsx-no-new-object-as-prop --
 * react-perf/jsx-no-new-object-as-prop (#558): test("passes validated partial code to the sandbox while input is streaming") creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 */
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
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop --
 * react-perf/jsx-no-new-object-as-prop (#558): test("does not render malformed partial code") creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 */
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
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop --
 * react-perf/jsx-no-new-object-as-prop (#558): test.each(["pyth", "java"])("keeps code visible while language is %s") creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 */
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
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
