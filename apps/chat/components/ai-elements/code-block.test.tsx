/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";
import { act, create } from "react-test-renderer";
import { expect, test, vi } from "vitest";

import { CodeBlock } from "./code-block";
/* oxlint-enable sort-imports */

const pending = vi.hoisted(() => new Map<string, ((html: string) => void)[]>());
/* oxlint-disable typescript/explicit-function-return-type, typescript/promise-function-async -- code-block.test route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

vi.mock("shiki", () => ({
  codeToHtml: (code: string) => {
    const { promise, resolve } = Promise.withResolvers<string>();
    const resolvers = pending.get(code) ?? [];
    resolvers.push(resolve);
    pending.set(code, resolvers);
    return promise;
  },
}));
/* oxlint-enable typescript/explicit-function-return-type, typescript/promise-function-async */

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
/* oxlint-disable init-declarations, oxc/no-async-await, oxc/no-optional-chaining -- code-block.test route: init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including renderer?.toJSON()). */

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
/* oxlint-enable init-declarations, oxc/no-async-await, oxc/no-optional-chaining */
