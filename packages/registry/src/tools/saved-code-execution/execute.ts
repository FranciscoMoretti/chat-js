import type { ToolContext } from "eve/tools";

import { getEveDocumentRevision } from "@/lib/db/eve-documents";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { eveToolAllowed } from "@/lib/eve/turn-tools";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { codeExecutor } from "@/tools/chatjs/code-executor";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
} from "./schemas";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
