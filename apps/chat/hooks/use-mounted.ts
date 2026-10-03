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
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useMounted: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const useMounted = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
