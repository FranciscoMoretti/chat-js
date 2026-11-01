export const createClientSnapshot = <State>(
  initial: State,
  restore: (current: State) => State
) => {
  let snapshot = initial;
  let restored = false;
  const listeners = new Set<() => void>();
  const update = (change: (current: State) => State): void => {
    snapshot = change(snapshot);
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initial,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (!restored) {
        restored = true;
        update(restore);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    update,
    set: <Key extends keyof State>(key: Key, value: State[Key]): void => {
      update((current) => ({ ...current, [key]: value }));
    },
  };
};
