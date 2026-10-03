"use client";
import { createContext, useContext } from "react";
/* oxlint-disable import/group-exports, import/no-named-export, no-undefined -- EveDocumentContext: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value. */

export const EveDocumentContext = createContext<string | undefined>(undefined);
/* oxlint-enable import/group-exports, import/no-named-export, no-undefined */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useDocumentConversation: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */
export const useDocumentConversation = () => useContext(EveDocumentContext);
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports, import/no-named-export -- EveDocumentReplayContext: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export const EveDocumentReplayContext = createContext(false);
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useDocumentReplaying: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */
export const useDocumentReplaying = () => useContext(EveDocumentReplayContext);
/* oxlint-enable import/group-exports, import/no-named-export, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
