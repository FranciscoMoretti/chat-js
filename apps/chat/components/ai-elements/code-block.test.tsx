import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";

import { CodeBlock } from "./code-block";

const pending = vi.hoisted(() => new Map<string, ((html: string) => void)[]>());
vi.mock("shiki", () => ({
  codeToHtml: (code: string) => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const resolvers = pending.get(code) ?? [];
    resolvers.push(resolve);
    pending.set(code, resolvers);
    return promise;
  },
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test("an older empty highlight cannot block streamed code until remount", async () => {
  let renderer: ReturnType<typeof create> | undefined;
  await act(() => {
    renderer = create(<CodeBlock code="" language="python" />);
  });
  try {
    await act(() => {
      renderer?.update(
        <CodeBlock code="print(53 * 41244)" language="python" />
      );
    });
    await act(() => {
      for (const resolve of pending.get("") ?? []) {
        resolve("<pre></pre>");
      }
    });
    await act(() => {
      for (const resolve of pending.get("print(53 * 41244)") ?? []) {
        resolve("<pre>print(53 * 41244)</pre>");
      }
    });
    expect(JSON.stringify(renderer?.toJSON())).toContain(
      "<pre>print(53 * 41244)</pre>"
    );
  } finally {
    await act(() => renderer?.unmount());
    pending.clear();
  }
});
