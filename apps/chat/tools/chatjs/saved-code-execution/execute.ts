import {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
} from "./schemas";
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/chatjs/generated/installed-tools";
import type { ToolContext } from "eve/tools";
import { getEveDocumentRevision } from "@/lib/db/eve-documents";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
import { eveTurnAccount } from "@/lib/eve/turn-tools";
import { codeExecutor } from "@/chatjs/generated/code-executor";

type ReadonlyCodeExecutionContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;
type CodeResult = Awaited<ReturnType<NonNullable<typeof codeExecutor>>>;
type SuccessfulCodeResult = Extract<CodeResult, { status: "success" }>;
type DocumentExecutionSource = Readonly<{
  code: string;
  language: "python" | "javascript";
  title: string;
}>;
type DocumentExecutionResult = {
  -readonly [
    Key in keyof Omit<SuccessfulCodeResult, "output">
  ]: SuccessfulCodeResult[Key];
} & {
  output: ReturnType<typeof eveCodeExecutionResult.parse> & {
    code: string;
    language: "python" | "javascript";
    title: string;
    documentId: string;
    revisionId: string;
  };
};

type DocumentExecutionStream = AsyncGenerator<
  Extract<CodeResult, { status: "error" }> | DocumentExecutionResult,
  void,
  unknown
>;

const documentResult = (
  result: Readonly<
    Omit<SuccessfulCodeResult, "output"> & {
      output: Readonly<SuccessfulCodeResult["output"]>;
    }
  >,
  source: DocumentExecutionSource,
  revision: Readonly<{ documentId: string; id: string }>
): DocumentExecutionResult => {
  const output = eveCodeExecutionResult.safeParse(result.output);
  return {
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

/**
 * Execute saved source, never model-supplied replacement code.
 * @param {unknown} value Untrusted tool input validated against the shared execution schema.
 * @param {ToolContext} context Native tool context supplying session scope, call metadata, and cancellation.
 * @yields {unknown} Native EVE platform result snapshots with document identity.
 */
export const executeEveCodeDocument = async function* executeEveCodeDocument(
  value: unknown,
  context: ReadonlyCodeExecutionContext
): DocumentExecutionStream {
  if (
    !(
      installedDocumentKinds.has("code") &&
      installedToolNames.has("runCodeDocument")
    )
  ) {
    throw new Error("Document execution is disabled.");
  }
  const input = documentExecutionInput.parse(value);
  const scope = await resolveEveConversationScope(
    (context.session.auth.initiator ?? {}).principalId,
    context.session.id,
    context.abortSignal
  );
  const revision = await getEveDocumentRevision(
    scope.ownerId,
    scope.conversationId,
    input.documentId,
    input.revisionId
  );
  if (!revision || revision.kind !== "code") {
    throw new Error("Code document not found.");
  }
  const language = documentExecutionLanguage(revision.title);
  if (!language) {
    throw new Error("Only Python and JavaScript documents can be run.");
  }
  context.abortSignal.throwIfAborted();
  const source = { code: revision.content, language, title: revision.title };
  if (!codeExecutor || !eveTurnAccount.get()) {
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
  yield documentResult(result, source, revision);
};
