"use client";
import { createContext, useContext } from "react";
/* oxlint-disable import/group-exports, no-undefined -- EveDocumentContext: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value. */

export const EveDocumentContext = createContext<string | undefined>(undefined);
/* oxlint-enable import/group-exports, no-undefined */

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useDocumentConversation: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */
export const useDocumentConversation = () => useContext(EveDocumentContext);
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

/* oxlint-disable import/group-exports -- EveDocumentReplayContext: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; */

export const EveDocumentReplayContext = createContext(false);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- useDocumentReplaying: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */
export const useDocumentReplaying = () => useContext(EveDocumentReplayContext);
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
