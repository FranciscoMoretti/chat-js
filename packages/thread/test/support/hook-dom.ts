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
  };
};

export { createHookDom };
