import { Window } from "happy-dom";

const createHookDom = (): { close: () => Promise<void> } => {
  const window = new Window();
  const globals = {
    IS_REACT_ACT_ENVIRONMENT: true,
    document: window.document,
    window,
  };
  const originals = new Map(
    Object.keys(globals).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value,
      writable: true,
    });
  }
  return {
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve close's awaited sequencing and rejected-Promise behavior. */
    async close(): Promise<void> {
      try {
        await window.happyDOM.abort();
      } finally {
        for (const [key, descriptor] of originals) {
          if (descriptor) {
            Object.defineProperty(globalThis, key, descriptor);
          } else {
            Reflect.deleteProperty(globalThis, key);
          }
        }
      }
    },
    /* oxlint-enable oxc/no-async-await */
  };
};

export { createHookDom };
