import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

const renderRoot = async (
  root: ReturnType<typeof createRoot>,
  children: ReactNode
): Promise<void> => {
  // oxlint-disable-next-line eslint/require-await -- React 19 act retains its scope through async callback settlement and flushes queued effects; a sync callback closes the scope before microtask updates.
  await act(async () => {
    root.render(children);
  });
};

const unmountRoot = async (
  root: ReturnType<typeof createRoot>
): Promise<void> => {
  // oxlint-disable-next-line eslint/require-await -- React 19 async act keeps effect cleanup and queued microtasks inside the awaited scope before the fixture container is removed.
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
