import { useCallback, useSyncExternalStore } from "react";
/* oxlint-disable typescript/explicit-function-return-type -- getServerSnapshot: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const getServerSnapshot = () => false;
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useMediaQuery: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
