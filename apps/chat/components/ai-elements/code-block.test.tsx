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
  // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
  let renderer: ReturnType<typeof create> | undefined;
  // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
  await act(() => {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    renderer = create(<CodeBlock code="" language="python" />);
  });
  try {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    await act(() => {
      renderer?.update(
        <CodeBlock code="print(53 * 41244)" language="python" />
      );
    });
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    await act(() => {
      for (const resolve of pending.get("") ?? []) {
        resolve("<pre></pre>");
      }
    });
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    await act(() => {
      for (const resolve of pending.get("print(53 * 41244)") ?? []) {
        resolve("<pre>print(53 * 41244)</pre>");
      }
    });
    expect(JSON.stringify(renderer?.toJSON())).toContain(
      "<pre>print(53 * 41244)</pre>"
    );
  } finally {
    // oxlint-disable-next-line typescript/no-deprecated -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together.
    await act(() => renderer?.unmount());
    pending.clear();
  }
});
