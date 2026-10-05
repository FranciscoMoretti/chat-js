/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../db/eve-documents"; "../db/eve-queries" dependency within this package instead of introducing an alias or barrel API.
 */
import { Client } from "eve/client";
import type { z } from "zod";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { installedDocumentKinds } from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getEveDocumentRevision,
  saveEveDocumentRevision,
} from "../db/eve-documents";
/* oxlint-enable sort-imports */
import { getEveConversation } from "../db/eve-queries";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getEveConnectionOptions } from "./connection-options";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveManualDocumentInput } from "./document-contracts";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { documentHistoryTurns } from "./document-history";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveConfigured } from "./server";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (saveManualEveDocument); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve saveManualEveDocument's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null --
 * max-statements (#512): saveManualEveDocument keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): saveManualEveDocument uses 15_000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-undefined (#519): saveManualEveDocument uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
