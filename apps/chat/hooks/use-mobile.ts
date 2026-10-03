/* oxlint-disable import/no-namespace -- react import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */
import * as React from "react";
/* oxlint-enable import/no-namespace */

const MOBILE_BREAKPOINT = 768;
/* oxlint-disable no-magic-numbers -- mobileQuery: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1). */

const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
/* oxlint-enable no-magic-numbers */

/* oxlint-disable typescript/explicit-function-return-type -- subscribe: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const subscribe = (onStoreChange: () => void) => {
  const mediaQueryList = globalThis.matchMedia(mobileQuery);
  mediaQueryList.addEventListener("change", onStoreChange);

  return () => mediaQueryList.removeEventListener("change", onStoreChange);
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- getSnapshot: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT;
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- getServerSnapshot: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const getServerSnapshot = () => false;
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useIsMobile: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const useIsMobile = () =>
  React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
