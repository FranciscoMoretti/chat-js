import { useSyncExternalStore } from "react";
/* oxlint-disable unicorn/no-null -- unsubscribe: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const unsubscribe = (): null => null;
/* oxlint-enable unicorn/no-null */

const subscribe = (): (() => null) => unsubscribe;

const getSnapshot = (): boolean => true;

const getServerSnapshot = (): boolean => false;
export const useMounted = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
