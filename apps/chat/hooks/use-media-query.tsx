import { useCallback, useSyncExternalStore } from "react";

const getServerSnapshot = (): boolean => false;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useMediaQuery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const useMediaQuery = (query: string): boolean => {
  const subscribe = useCallback(
    (onStoreChange: () => void): (() => void) => {
      const mediaQueryList = globalThis.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);

      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    (): boolean => globalThis.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
