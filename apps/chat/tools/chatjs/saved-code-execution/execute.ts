import type { ToolContext } from "eve/tools";

import { config } from "@/lib/config";
import { getEveDocumentRevision } from "@/lib/db/eve-documents";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
import { eveToolAllowed } from "@/lib/eve/turn-tools";
import { codeExecutor } from "@/tools/chatjs/code-executor";

import {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
} from "./schemas";

/**
 * Execute saved source, never model-supplied replacement code.
 * @yields {unknown} Native EVE platform result snapshots with document identity.
 */
export const executeEveCodeDocument = async function* executeEveCodeDocument(
  value: unknown,
  context: ToolContext
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
  if (!codeExecutor || !eveToolAllowed("codeExecution")) {
    throw new Error("Installed code executor is unavailable.");
  }
  const result = await codeExecutor(source, {
    abortSignal: context.abortSignal,
    callId: context.callId,
    session: context.session,
  });
  if (result.status === "error") {
    yield result;
    return;
  }
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
};
