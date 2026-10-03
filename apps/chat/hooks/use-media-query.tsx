import { useCallback, useSyncExternalStore } from "react";
/* oxlint-disable typescript/explicit-function-return-type -- getServerSnapshot: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const getServerSnapshot = () => false;
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useMediaQuery: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
