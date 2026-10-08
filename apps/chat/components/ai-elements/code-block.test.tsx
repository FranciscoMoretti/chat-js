import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";
import { CodeBlock } from "./code-block";
import React from "react";

const pending = vi.hoisted(() => new Map<string, ((html: string) => void)[]>());
/* oxlint-disable typescript/promise-function-async -- code-block.test route: typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

vi.mock("shiki", () => ({
  codeToHtml: (code: string): Promise<string> => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const resolvers = pending.get(code) ?? [];
    resolvers.push(resolve);
    pending.set(code, resolvers);
    return promise;
  },
}));
/* oxlint-enable typescript/promise-function-async */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable init-declarations -- code-block.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state;  */

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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading update from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading toJSON from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    expect(JSON.stringify(renderer?.toJSON())).toContain(
      "<pre>print(53 * 41244)</pre>"
    );
  } finally {
    // oxlint-disable-next-line typescript/no-deprecated, oxc/no-optional-chaining -- #583: This fixture uses react-test-renderer to exercise hook scheduling; replacing the renderer requires migrating its act and mount lifecycle together. Optional chain: Keep the existing nullish guard when reading unmount from renderer; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    await act(() => renderer?.unmount());
    pending.clear();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable init-declarations */
