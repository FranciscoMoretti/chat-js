/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createHash } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolContext } from "eve/tools";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "@/lib/db/eve-documents";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

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
/* oxlint-enable import/no-nodejs-modules */

type DocumentContext = Pick<ToolContext, "session" | "callId" | "abortSignal">;

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): documentIdForCall uses 0, 16, 6, 128, 8, 64, 12, 20 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
/**
 * Deterministic UUIDv8: retrying a create must address exactly the same document.
 *
 * @param {string} sessionId Session identity included in the SHA-256 input.
 * @param {string} callId Tool-call identity included in the SHA-256 input.
 * @returns {string} A UUIDv8 string derived from the session and call identities.
 */
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
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * max-lines-per-function (#510): executeEveDocumentTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): executeEveDocumentTool keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): executeEveDocumentTool uses 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): executeEveDocumentTool uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/prefer-readonly-parameter-types (#565): executeEveDocumentTool accepts context: DocumentContext; [key]; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): executeEveDocumentTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const executeEveDocumentTool = async (
  name: string,
  value: unknown,
  context: DocumentContext
): Promise<
  | {
      content: string;
      date: string;
      documentId: string;
      fileIds: string[];
      kind: Awaited<ReturnType<typeof saveEveDocumentRevision>>["kind"];
      revisionId: string;
      status: string;
      title: string;
      result?: undefined;
    }
  | {
      date: string;
      documentId: string;
      kind: Awaited<ReturnType<typeof saveEveDocumentRevision>>["kind"];
      result: string;
      revisionId: string;
      status: string;
      title: string;
      content?: undefined;
      fileIds?: undefined;
    }
> => {
  if (name === "readDocument") {
    const input = eveDocumentReadInput.parse(value);
    const scope = await resolveEveConversationScope(
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from Object.entries(...).find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const operation = Object.entries(eveDocumentOperations).find(
    ([key]) => key === name
  )?.[1];
  if (!(operation && installedDocumentKinds.has(operation.kind))) {
    throw new Error("Document tool is unavailable.");
  }
  // oxlint-disable-next-line no-ternary -- Keep edit as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const edit = operation.edit ? eveDocumentEditInput.parse(value) : undefined;
  const input = edit ?? eveDocumentCreateInput.parse(value);
  const scope = await resolveEveConversationScope(
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading principalId from context.session.auth.initiator; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    context.session.auth.initiator?.principalId,
    context.session.id,
    context.abortSignal
  );
  context.abortSignal.throwIfAborted();
  const revision = await saveEveDocumentRevision(
    {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing scope own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...scope,
      content: input.content,
      documentId:
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading documentId from edit; preserve one receiver evaluation, skipped accesses and the existing documentIdForCall(context.session.id, context.callId) fallback. The app guidance prefers optional chaining.
        edit?.documentId ??
        documentIdForCall(context.session.id, context.callId),
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading expectedRevisionId from edit; preserve one receiver evaluation, skipped accesses and the existing null fallback. The app guidance prefers optional chaining.
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, typescript/prefer-readonly-parameter-types, unicorn/no-null */
