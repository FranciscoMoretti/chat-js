/* oxlint-disable import/no-nodejs-modules -- Deterministic UUIDv8 requires the server Node crypto SHA-256 implementation. */
import {
  eveDocumentCreateInput,
  eveDocumentEditInput,
  eveDocumentOperations,
  eveDocumentReadInput,
} from "./document-contracts";
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "@/lib/db/eve-documents";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolContext } from "eve/tools";
import { createHash } from "node:crypto";
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";
import { resolveEveConversationScope } from "./conversation-scope";
/* oxlint-enable import/no-nodejs-modules */

type DocumentContext = Pick<ToolContext, "session" | "callId" | "abortSignal">;

const DOCUMENT_OPERATION_VALUE_INDEX = 1;
const UUID_START_OFFSET = 0;
const UUID_BYTE_LENGTH = 16;
const UUID_VERSION_BYTE_INDEX = 6;
const UUID_VERSION_PAYLOAD_MODULUS = 16;
const UUID_VERSION_EIGHT_BITS = 128;
const UUID_VARIANT_BYTE_INDEX = 8;
const UUID_VARIANT_PAYLOAD_MODULUS = 64;
const UUID_RFC_VARIANT_BITS = 128;
const UUID_FIRST_GROUP_HEX_END = 8;
const UUID_SECOND_GROUP_HEX_END = 12;
const UUID_THIRD_GROUP_HEX_END = 16;
const UUID_FOURTH_GROUP_HEX_END = 20;

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
    .subarray(UUID_START_OFFSET, UUID_BYTE_LENGTH);
  bytes[UUID_VERSION_BYTE_INDEX] =
    (bytes[UUID_VERSION_BYTE_INDEX] % UUID_VERSION_PAYLOAD_MODULUS) +
    UUID_VERSION_EIGHT_BITS;
  bytes[UUID_VARIANT_BYTE_INDEX] =
    (bytes[UUID_VARIANT_BYTE_INDEX] % UUID_VARIANT_PAYLOAD_MODULUS) +
    UUID_RFC_VARIANT_BITS;
  const hex = bytes.toString("hex");
  return `${hex.slice(UUID_START_OFFSET, UUID_FIRST_GROUP_HEX_END)}-${hex.slice(UUID_FIRST_GROUP_HEX_END, UUID_SECOND_GROUP_HEX_END)}-${hex.slice(UUID_SECOND_GROUP_HEX_END, UUID_THIRD_GROUP_HEX_END)}-${hex.slice(UUID_THIRD_GROUP_HEX_END, UUID_FOURTH_GROUP_HEX_END)}-${hex.slice(UUID_FOURTH_GROUP_HEX_END)}`;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (executeEveDocumentTool); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve executeEveDocumentTool's awaited sequencing and rejected-Promise behavior. */

const readEveDocumentTool = async (
  value: unknown,
  context: ReadonlyNativeSurface<DocumentContext>
): ReturnType<typeof executeEveDocumentTool> => {
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
};

/* oxlint-disable no-undefined, unicorn/no-null -- * no-undefined (#519): executeEveDocumentTool uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * unicorn/no-null (#570): executeEveDocumentTool preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
type DocumentToolResult =
  | {
      content: string;
      date: string;
      documentId: string;
      fileIds: readonly string[];
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
    };

const writeEveDocumentTool = async (
  name: string,
  value: unknown,
  context: ReadonlyNativeSurface<DocumentContext>
): Promise<DocumentToolResult> => {
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading 1 from Object.entries(...).find(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const operation = Object.entries(eveDocumentOperations).find(
    ([key]: readonly [string, ...unknown[]]) => key === name
  )?.[DOCUMENT_OPERATION_VALUE_INDEX];
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

export const executeEveDocumentTool = async (
  name: string,
  value: unknown,
  context: ReadonlyNativeSurface<
    Readonly<Pick<DocumentContext, "session" | "abortSignal" | "callId">>
  >
): Promise<DocumentToolResult> => {
  if (name === "readDocument") {
    return await readEveDocumentTool(value, context);
  }
  return await writeEveDocumentTool(name, value, context);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-undefined, unicorn/no-null */
