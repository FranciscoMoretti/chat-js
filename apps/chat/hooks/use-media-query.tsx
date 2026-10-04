import { useCallback, useSyncExternalStore } from "react";

const getServerSnapshot = (): boolean => false;

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
