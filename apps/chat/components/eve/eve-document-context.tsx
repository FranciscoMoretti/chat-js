"use client";
import { createContext, useContext } from "react";
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveDocumentContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-undefined -- no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value. */

// oxlint-disable-next-line import/group-exports -- #711: Keep EveDocumentContext inline: Oxlint 1.82 classifies a grouped context specifier as a component and rejects the hooks; one-var rejects combining declarations.
export const EveDocumentContext = createContext<string | undefined>(undefined);
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (useDocumentConversation); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined */

// oxlint-disable-next-line import/group-exports -- #711: Keep useDocumentConversation inline with its context: grouped hooks violate exports-last beside inline contexts; placing them first violates no-use-before-define. Grouping every value instead triggers Oxlint 1.82 Fast Refresh classification.
export const useDocumentConversation = (): string | undefined =>
  useContext(EveDocumentContext);
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveDocumentReplayContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

// oxlint-disable-next-line import/group-exports -- #711: Keep EveDocumentReplayContext inline: Oxlint 1.82 classifies a grouped context specifier as a component and rejects the hooks; one-var rejects combining declarations.
export const EveDocumentReplayContext = createContext(false);
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (useDocumentReplaying); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

// oxlint-disable-next-line import/group-exports -- #711: Keep useDocumentReplaying inline with its context: grouped hooks violate exports-last beside inline contexts; placing them first violates no-use-before-define. Grouping every value instead triggers Oxlint 1.82 Fast Refresh classification.
export const useDocumentReplaying = (): boolean =>
  useContext(EveDocumentReplayContext);
/* oxlint-enable import/no-named-export */
