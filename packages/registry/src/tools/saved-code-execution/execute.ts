import {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
} from "./schemas";
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
import type { ToolContext } from "eve/tools";
import { getEveDocumentRevision } from "@/lib/db/eve-documents";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
// oxlint-disable-next-line sort-imports -- Keep database/environment initialization before turn-tools registers ContextKey names in Eve's global registry; sorting eveToolAllowed first moves that mutation before validation.
import { eveToolAllowed } from "@/lib/eve/turn-tools";
// oxlint-disable-next-line sort-imports -- Keep turn-tools ContextKey registration before codeExecutor loads Vercel/Undici's global dispatcher; sorting codeExecutor first reverses these shared-state initializations.
import { codeExecutor } from "@/tools/chatjs/code-executor";

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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Preserve the native result's own keys, getter evaluation, and spread override order; prefer-object-spread denies Object.assign.
    ...result,
    output: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Preserve schema data's own keys and lazy fallback selection; prefer-object-spread denies Object.assign and prefer-ternary denies branch assignment.
      ...(output.success
        ? output.data
        : {
            chart: "",
            message:
              "Execution finished, but its output has an unsupported format.",
          }),
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Preserve source keys and positional overrides after schema output; prefer-object-spread denies Object.assign.
      ...source,
      documentId: revision.documentId,
      revisionId: revision.id,
    },
  };
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeEveCodeDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern targets support the async-iterator protocol; preserve executeEveCodeDocument's asynchronous iteration and rejection behavior. */

/* oxlint-disable eslint/max-statements -- This generator gates the feature, parses input, resolves scope and revision, runs code, and normalizes yielded output; the statement metric remains under review. */
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
  if (!revision || revision.kind !== "code") {
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
  yield documentResult(result, source, revision);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */
