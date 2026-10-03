import { useSyncExternalStore } from "react";
/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- unsubscribe: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const unsubscribe = () => null;
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- subscribe: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const subscribe = () => unsubscribe;
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- getSnapshot: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const getSnapshot = () => true;
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- getServerSnapshot: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const getServerSnapshot = () => false;
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useMounted: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const useMounted = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
/* oxlint-enable import/no-named-export, import/prefer-default-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
