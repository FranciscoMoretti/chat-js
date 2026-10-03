/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-documents"; "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { Client } from "eve/client";
import type { z } from "zod";

import { installedDocumentKinds } from "@/tools/chatjs/installed-features";

import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../db/eve-documents";
import { getEveConversation } from "../db/eve-queries";
import { getEveConnectionOptions } from "./connection-options";
import { eveManualDocumentInput } from "./document-contracts";
import { documentHistoryTurns } from "./document-history";
import { assertEveConfigured } from "./server";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named saveManualEveDocument API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): saveManualEveDocument remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * max-statements (#512): saveManualEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): saveManualEveDocument uses 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): saveManualEveDocument uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): saveManualEveDocument sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): saveManualEveDocument handles optional conversation?.sessionId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): saveManualEveDocument copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/explicit-function-return-type (#560): Keep saveManualEveDocument's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep saveManualEveDocument's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): saveManualEveDocument accepts value: z.input<typeof eveManualDocumentInput>; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): saveManualEveDocument intentionally keeps the existing falsy-value behavior of conversation?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): saveManualEveDocument preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const saveManualEveDocument = async (
  ownerId: string,
  value: z.input<typeof eveManualDocumentInput>
) => {
  const input = eveManualDocumentInput.parse(value);
  const conversation = await getEveConversation(ownerId, input.conversationId);
  if (!(conversation?.sessionId && conversation.state === "bound")) {
    throw new Error("Conversation not found.");
  }
  const previous = await getEveDocumentRevision(
    ownerId,
    input.conversationId,
    input.documentId,
    input.expectedRevisionId
  );
  if (!(previous && installedDocumentKinds.has(previous.kind))) {
    throw new Error("Document not found.");
  }
  assertEveConfigured();
  const client = new Client(getEveConnectionOptions(ownerId));
  const snapshot = await client.sessions
    .attach(conversation.sessionId)
    .snapshot({ signal: AbortSignal.timeout(15_000) });
  const turns = documentHistoryTurns(snapshot.events);
  const saved = await saveEveDocumentRevision(
    {
      ...input,
      fileIds: [...new Set([...previous.fileIds, ...input.fileIds])],
      kind: previous.kind,
      operationId: `manual:${input.operationId}`,
      ownerId,
      turnIndex: null,
    },
    undefined,
    turns
  );
  return {
    content: saved.content,
    createdAt: saved.createdAt,
    documentId: saved.documentId,
    id: saved.id,
    kind: saved.kind,
    title: saved.title,
  };
};
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
