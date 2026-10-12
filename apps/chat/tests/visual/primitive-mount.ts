import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

const renderRoot = async (
  root: ReturnType<typeof createRoot>,
  children: ReactNode
): Promise<void> => {
  // oxlint-disable-next-line eslint/require-await -- React act exposes its runtime completion promise through the supported async callback overload, even when the render is synchronous.
  await act(async () => {
    root.render(children);
  });
};

const unmountRoot = async (
  root: ReturnType<typeof createRoot>
): Promise<void> => {
  // oxlint-disable-next-line eslint/require-await -- React act exposes its runtime completion promise through the supported async callback overload, even when the unmount is synchronous.
  await act(async () => {
    root.unmount();
  });
};

const mount = async (
  children: ReactNode
): Promise<{
  readonly container: HTMLElement;
  readonly root: ReturnType<typeof createRoot>;
}> => {
  const container = document.createElement("main");
  document.body.append(container);
  const root = createRoot(container);
  await renderRoot(root, children);
  return { container, root };
};
const unmount = async (
  fixture: Awaited<ReturnType<typeof mount>>
): Promise<void> => {
  await unmountRoot(fixture.root);
  fixture.container.remove();
};

export { mount, renderRoot, unmount, unmountRoot };
