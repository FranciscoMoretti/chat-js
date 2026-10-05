import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

/* oxlint-disable oxc/no-async-await, typescript/prefer-readonly-parameter-types -- oxc/no-async-await: Browser lifecycle and interactions await React commits before captures and cleanup; typescript/prefer-readonly-parameter-types: React nodes and DOM roots retain their native mutable mount and cleanup contracts. */
const mount = async (
  children: ReactNode
): Promise<{
  readonly container: HTMLElement;
  readonly root: ReturnType<typeof createRoot>;
}> => {
  const container = document.createElement("main");
  document.body.append(container);
  const root = createRoot(container);
  // oxlint-disable-next-line eslint/require-await, typescript/require-await -- React act exposes its runtime completion promise through an async callback, even when this render or unmount is synchronous.
  await act(async () => {
    root.render(children);
  });
  return { container, root };
};
/* oxlint-enable oxc/no-async-await, typescript/prefer-readonly-parameter-types */
/* oxlint-disable oxc/no-async-await, typescript/prefer-readonly-parameter-types -- oxc/no-async-await: Browser lifecycle and interactions await React commits before captures and cleanup; typescript/prefer-readonly-parameter-types: React nodes and DOM roots retain their native mutable mount and cleanup contracts. */
const unmount = async (
  fixture: Awaited<ReturnType<typeof mount>>
): Promise<void> => {
  // oxlint-disable-next-line eslint/require-await, typescript/require-await -- React act exposes its runtime completion promise through an async callback, even when this render or unmount is synchronous.
  await act(async () => {
    fixture.root.unmount();
  });
  fixture.container.remove();
};
/* oxlint-enable oxc/no-async-await, typescript/prefer-readonly-parameter-types */

export { mount, unmount };
