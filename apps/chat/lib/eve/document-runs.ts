import type { EveMessage } from "eve/client";
import { documentExecutionInput } from "./document-execution-contracts";

/** Project the latest execution of this revision from the native transcript. */
export function latestDocumentRun(
  messages: readonly EveMessage[],
  documentId: string,
  revisionId: string
) {
  for (const message of messages.toReversed()) {
    for (const part of message.parts.toReversed()) {
      if (part.type !== "dynamic-tool" || part.toolName !== "runCodeDocument") {
        continue;
      }
      const input = documentExecutionInput.safeParse(part.input);
      if (
        input.success &&
        input.data.documentId === documentId &&
        input.data.revisionId === revisionId
      ) {
        return { part, messageId: message.id };
      }
    }
  }
}
