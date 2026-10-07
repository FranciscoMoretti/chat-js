import type { ToolContext } from "eve/tools";

import { getEveDocumentRevision } from "@/lib/db/eve-documents";
import { resolveEveConversationScope } from "@/lib/eve/conversation-scope";
/* oxlint-disable sort-imports -- Pinned Oxfmt leaves this import block unchanged; native sort-imports reports an ordering conflict here. */
import { eveToolAllowed } from "@/lib/eve/turn-tools";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Pinned Oxfmt leaves this import block unchanged; native sort-imports reports an ordering conflict here. */
import { codeExecutor } from "@/tools/chatjs/code-executor";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Pinned Oxfmt leaves this import block unchanged; native sort-imports reports a binding-group conflict here. */
import {
  installedDocumentKinds,
  installedToolNames,
} from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Pinned Oxfmt leaves this import block unchanged; native sort-imports reports an ordering conflict here. */
import {
  documentExecutionInput,
  documentExecutionLanguage,
  eveCodeExecutionResult,
} from "./schemas";

type ReadonlyCodeExecutionContext = Readonly<
  Pick<ToolContext, "callId" | "session"> & {
    abortSignal: Readonly<AbortSignal>;
  }
>;
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeEveCodeDocument); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern targets support the async-iterator protocol; preserve executeEveCodeDocument's asynchronous iteration and rejection behavior. */
/* oxlint-enable sort-imports */

/* oxlint-disable eslint/max-statements -- This generator gates the feature, parses input, resolves scope and revision, runs code, and normalizes yielded output; the statement metric remains under review. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- This generator combines validation, execution, and streamed-result construction; there is no cleanup phase in this function. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/**
 * Execute saved source, never model-supplied replacement code.
 * @param {unknown} value Untrusted tool input validated against the shared execution schema.
 * @param {ToolContext} context Native tool context supplying session scope, call metadata, and cancellation.
 * @yields {unknown} Native EVE platform result snapshots with document identity.
 */
export const executeEveCodeDocument = async function* executeEveCodeDocument(
  value: unknown,
  context: ReadonlyCodeExecutionContext
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading kind from revision; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
      // oxlint-disable-next-line oxc/no-rest-spread-properties, no-ternary -- Conditional spread (output.success         ? output.data         : {             chart: "",             message:               "Execution finished, but its output has an unsupported format.",           }) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.; no-ternary: Keep object spread as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */
