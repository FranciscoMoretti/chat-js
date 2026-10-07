import type { EveDynamicToolPart, EveMessage } from "eve/client";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { documentExecutionInput } from "./schemas";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (latestDocumentRun); the enabled import/no-default-export convention rejects the default-export alternative. */
/** Project the latest execution of this revision from the native transcript.
 * @param {readonly ReadonlyNativeSurface<Pick<EveMessage, "id" | "parts">>[]} messages Transcript identifiers and parts read newest-first without changing the matched part reference.
 * @param {string} documentId Document identity accepted by the execution tool.
 * @param {string} revisionId Revision identity required to match that run.
 * @returns {{ messageId: string; part: EveDynamicToolPart } | undefined} The newest matching tool part by original reference, or no result when that revision has not run.
 */
// oxlint-disable-next-line typescript/consistent-return -- Explicitly returning undefined for a missing run conflicts with the enabled no-undefined rule; preserve this native-part-or-undefined lookup contract.
export const latestDocumentRun = (
  messages: readonly ReadonlyNativeSurface<Pick<EveMessage, "id" | "parts">>[],
  documentId: string,
  revisionId: string
): { messageId: string; part: EveDynamicToolPart } | undefined => {
  for (const message of messages.toReversed()) {
    for (const part of message.parts.toReversed()) {
      if (part.type === "dynamic-tool" && part.toolName === "runCodeDocument") {
        const input = documentExecutionInput.safeParse(part.input);
        if (
          input.success &&
          input.data.documentId === documentId &&
          input.data.revisionId === revisionId
        ) {
          return { messageId: message.id, part };
        }
      }
    }
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
