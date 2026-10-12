import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";

// Callers own React act so they can group renders with controlled async work.
const createDomHarness = (children: ReactNode) => {
  const container = document.createElement("main");
  document.body.append(container);
  const root = createRoot(container);
  root.render(children);
  return {
    container,
    update: (nextChildren: ReactNode): void => {
      root.render(nextChildren);
    },
    unmount: (): void => {
      root.unmount();
      container.remove();
    },
  };
};

export { createDomHarness };
