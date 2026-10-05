import type { ToolContext } from "eve/tools";

import { getEveDocumentRevision } from "@/lib/db/eve-documents";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveToolAllowed } from "@/lib/eve/turn-tools";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { codeExecutor } from "@/tools/chatjs/code-executor";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
} from "./schemas";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeEveCodeDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern targets support the async-iterator protocol; preserve executeEveCodeDocument's asynchronous iteration and rejection behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
      installedDocumentKinds.has("code") &&
      installedToolNames.has("runCodeDocument")
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
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing result own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...result,
    output: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (output.success         ? output.data         : {             chart: "",             message:               "Execution finished, but its output has an unsupported format.",           }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
      ...(output.success
        ? output.data
        : {
            chart: "",
            message:
              "Execution finished, but its output has an unsupported format.",
          }),
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing source own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...source,
      documentId: revision.documentId,
      revisionId: revision.id,
    },
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */
