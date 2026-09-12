import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (onStoreChange: () => void) => {
  const mediaQueryList = window.matchMedia(mobileQuery);
  mediaQueryList.addEventListener("change", onStoreChange);

  return () => mediaQueryList.removeEventListener("change", onStoreChange);
};
const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT;
const getServerSnapshot = () => false;

export const useIsMobile = () =>
  React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
