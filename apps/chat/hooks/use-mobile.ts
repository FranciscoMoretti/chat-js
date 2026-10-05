import { useSyncExternalStore as useReactSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
/* oxlint-disable no-magic-numbers -- mobileQuery: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1). */

const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
/* oxlint-enable no-magic-numbers */

const subscribe = (onStoreChange: () => void): (() => void) => {
  const mediaQueryList = globalThis.matchMedia(mobileQuery);
  mediaQueryList.addEventListener("change", onStoreChange);

  return () => mediaQueryList.removeEventListener("change", onStoreChange);
};
const getSnapshot = (): boolean => window.innerWidth < MOBILE_BREAKPOINT;

const getServerSnapshot = (): boolean => false;
export const useIsMobile = (): boolean =>
  useReactSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
