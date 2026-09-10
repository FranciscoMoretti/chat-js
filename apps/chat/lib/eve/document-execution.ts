import type { ToolContext } from "eve/tools";
import { codeExecutionResult } from "../../tools/platform/code-execution.schemas";
import { config } from "../config";
import { getEveDocumentRevision } from "../db/eve-documents";
import {
  documentExecutionInput,
  documentExecutionLanguage,
} from "./document-execution-contracts";
import { resolveEveDocumentConversation } from "./document-session";
import { executeEvePlatformTool } from "./platform-tools";

/** Execute saved source, never model-supplied replacement code. */
export async function* executeEveCodeDocument(
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
  const scope = await resolveEveDocumentConversation(
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
  const source = { title: revision.title, code: revision.content, language };
  for await (const result of executeEvePlatformTool(
    "codeExecution",
    source,
    context,
    []
  )) {
    const output = codeExecutionResult.safeParse(result.output);
    yield {
      ...result,
      output: {
        ...(output.success
          ? output.data
          : {
              message:
                "Execution finished, but its output has an unsupported format.",
              chart: "",
            }),
        ...source,
        documentId: revision.documentId,
        revisionId: revision.id,
      },
    };
  }
}
