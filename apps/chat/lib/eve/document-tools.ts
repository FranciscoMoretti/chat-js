/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-documents" dependency within this package instead of introducing an alias or barrel API.
 */
import { createHash } from "node:crypto";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolContext } from "eve/tools";
/* oxlint-enable sort-imports */

import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../db/eve-documents";
/* oxlint-enable sort-imports */
import { resolveEveConversationScope } from "./conversation-scope";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
} from "./document-contracts";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

type DocumentContext = Pick<ToolContext, "session" | "callId" | "abortSignal">;

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers --
 * jsdoc/require-param (#534): documentIdForCall's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): documentIdForCall's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): documentIdForCall uses 0, 16, 6, 128, 8, 64, 12, 20 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/** Deterministic UUIDv8: retrying a create must address exactly the same document. */
const documentIdForCall = (sessionId: string, callId: string): string => {
  const bytes = createHash("sha256")
    .update(JSON.stringify([sessionId, callId]))
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] % 16) + 128;
  bytes[8] = (bytes[8] % 64) + 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeEveDocumentTool); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeEveDocumentTool's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-lines-per-function (#510): executeEveDocumentTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): executeEveDocumentTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): executeEveDocumentTool uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): executeEveDocumentTool uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep executeEveDocumentTool's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep executeEveDocumentTool's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): executeEveDocumentTool accepts context: DocumentContext; [key]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): executeEveDocumentTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const executeEveDocumentTool = async (
  name: string,
  value: unknown,
  context: DocumentContext
) => {
  if (name === "readDocument") {
    const input = eveDocumentReadInput.parse(value);
    const scope = await resolveEveConversationScope(
      context.session.auth.initiator?.principalId,
      context.session.id,
      context.abortSignal
    );
    const revision = await getEveDocumentRevision(
      scope.ownerId,
      scope.conversationId,
      input.documentId
    );
    if (!(revision && installedDocumentKinds.has(revision.kind))) {
      throw new Error("Document not found.");
    }
    return {
      content: revision.content,
      date: revision.createdAt.toISOString(),
      documentId: revision.documentId,
      fileIds: revision.fileIds,
      kind: revision.kind,
      revisionId: revision.id,
      status: "success",
      title: revision.title,
    };
  }
  const operation = Object.entries(eveDocumentOperations).find(
    ([key]) => key === name
  )?.[1];
  if (!(operation && installedDocumentKinds.has(operation.kind))) {
    throw new Error("Document tool is unavailable.");
  }
  const edit = operation.edit ? eveDocumentEditInput.parse(value) : undefined;
  const input = edit ?? eveDocumentCreateInput.parse(value);
  const scope = await resolveEveConversationScope(
    context.session.auth.initiator?.principalId,
    context.session.id,
    context.abortSignal
  );
  context.abortSignal.throwIfAborted();
  const revision = await saveEveDocumentRevision(
    {
      ...scope,
      content: input.content,
      documentId:
        edit?.documentId ??
        documentIdForCall(context.session.id, context.callId),
      expectedRevisionId: edit?.expectedRevisionId ?? null,
      fileIds: input.fileIds,
      kind: operation.kind,
      operationId: `tool:${context.callId}`,
      title: input.title,
      turnIndex: context.session.turn.sequence,
    },
    context.abortSignal
  );
  return {
    date: revision.createdAt.toISOString(),
    documentId: revision.documentId,
    kind: revision.kind,
    result: "Document saved.",
    revisionId: revision.id,
    status: "success",
    title: revision.title,
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
