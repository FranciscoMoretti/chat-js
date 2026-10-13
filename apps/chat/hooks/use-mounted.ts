import { useSyncExternalStore } from "react";

const unsubscribe = (): null => null;

const subscribe = (): (() => null) => unsubscribe;

const getSnapshot = (): boolean => true;

const getServerSnapshot = (): boolean => false;
export const useMounted = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
