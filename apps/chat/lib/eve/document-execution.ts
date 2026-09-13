import type { ToolContext } from "eve/tools";

import { config } from "../config";
import { getEveDocumentRevision } from "../db/eve-documents";
import { resolveEveConversationScope } from "./conversation-scope";
import {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
} from "./document-execution-contracts";
import { executeEvePlatformTool } from "./platform-tools";

/**
 * Execute saved source, never model-supplied replacement code.
 * @yields {unknown} Native EVE platform result snapshots with document identity.
 */
export const executeEveCodeDocument = async function* executeEveCodeDocument(
  value: unknown,
  context: Pick<ToolContext, "session" | "callId" | "abortSignal">
) {
  if (
    !(
      config.ai.tools.documents.enabled &&
      config.ai.tools.documents.types.code &&
      config.ai.tools.codeExecution.enabled
    )
  ) {
    throw new Error("Document execution is disabled.");
  }
  const input = documentExecutionInput.parse(value);
  const scope = await resolveEveConversationScope(
    context.session.auth.initiator?.principalId,
    context.session.id,
    context.abortSignal
  );
  const revision = await getEveDocumentRevision(
    scope.ownerId,
    scope.conversationId,
    input.documentId,
    input.revisionId
  );
  if (revision?.kind !== "code") {
    throw new Error("Code document not found.");
  }
  const language = documentExecutionLanguage(revision.title);
  if (!language) {
    throw new Error("Only Python and JavaScript documents can be run.");
  }
  context.abortSignal.throwIfAborted();
  const source = { code: revision.content, language, title: revision.title };
  for await (const result of executeEvePlatformTool(
    "codeExecution",
    source,
    context,
    []
  )) {
    const output = eveCodeExecutionResult.safeParse(result.output);
    yield {
      ...result,
      output: {
        ...(output.success
          ? output.data
          : {
              chart: "",
              message:
                "Execution finished, but its output has an unsupported format.",
            }),
        ...source,
        documentId: revision.documentId,
        revisionId: revision.id,
      },
    };
  }
};
