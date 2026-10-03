import { useCallback, useSyncExternalStore } from "react";

const getServerSnapshot = () => false;

export const useMediaQuery = (query: string) => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQueryList = globalThis.matchMedia(query);
      mediaQueryList.addEventListener("change", onStoreChange);

      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(
    () => globalThis.matchMedia(query).matches,
    [query]
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
