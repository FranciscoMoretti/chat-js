import { useSyncExternalStore } from "react";
/* oxlint-disable unicorn/no-null -- unsubscribe: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const unsubscribe = (): null => null;
/* oxlint-enable unicorn/no-null */

const subscribe = (): (() => null) => unsubscribe;

const getSnapshot = (): boolean => true;

const getServerSnapshot = (): boolean => false;
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useMounted); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export const useMounted = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
