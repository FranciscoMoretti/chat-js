"use client";
import { createContext, useContext } from "react";
/* oxlint-disable import/group-exports, no-undefined -- EveDocumentContext: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value. */

export const EveDocumentContext = createContext<string | undefined>(undefined);
/* oxlint-enable import/group-exports, no-undefined */

/* oxlint-disable import/group-exports -- useDocumentConversation: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; */
export const useDocumentConversation = (): string | undefined =>
  useContext(EveDocumentContext);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- EveDocumentReplayContext: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; */

export const EveDocumentReplayContext = createContext(false);
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- useDocumentReplaying: import/group-exports: #620: Keep these createContext values and related hooks directly exported: grouped clauses in Oxlint 1.82 classify the capitalized context names as component exports despite identical runtime and public types.; */
export const useDocumentReplaying = (): boolean =>
  useContext(EveDocumentReplayContext);
/* oxlint-enable import/group-exports */
