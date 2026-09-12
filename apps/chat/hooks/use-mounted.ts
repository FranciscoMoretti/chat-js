import { useSyncExternalStore } from "react";

const unsubscribe = () => null;
const subscribe = () => unsubscribe;
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export const useMounted = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
