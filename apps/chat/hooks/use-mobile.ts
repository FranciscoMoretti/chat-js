import { useSyncExternalStore as useReactSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (onStoreChange: () => void): (() => void) => {
  const mediaQueryList = globalThis.matchMedia(mobileQuery);
  mediaQueryList.addEventListener("change", onStoreChange);

  return () => {
    mediaQueryList.removeEventListener("change", onStoreChange);
  };
};
const getSnapshot = (): boolean => window.innerWidth < MOBILE_BREAKPOINT;

const getServerSnapshot = (): boolean => false;
export const useIsMobile = (): boolean =>
  useReactSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
