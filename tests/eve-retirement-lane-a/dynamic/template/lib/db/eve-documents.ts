import assert from "node:assert/strict";

import { input } from "../../proof/input";
import { readControl, record } from "../../proof/store";

const getEveDocumentRevision = async (
  ownerId: string,
  conversationId: string,
  documentId: string
): Promise<{ id: string; kind: string; title: string }> => {
  const control = await readControl(conversationId);
  assert.equal(ownerId, control.ownerId);
  assert.equal(documentId, input.documentId);
  await record("revision", { conversationId, revisionId: control.revisionId });
  return { id: control.revisionId, kind: "text", title: input.title };
};
const removeEveDocumentFromConversation = async (
  value: Readonly<typeof input>,
  scope: Readonly<{ ownerId: string; conversationId: string }>,
  signal: Readonly<AbortSignal>
): Promise<{
  documentId: string;
  title: string;
  status: string;
  result: string;
}> => {
  signal.throwIfAborted();
  const control = await readControl(scope.conversationId);
  assert.equal(scope.ownerId, control.ownerId);
  assert.equal(value.expectedRevisionId, control.revisionId);
  assert.deepEqual(value, input);
  await record("delete", { input: value, scope });
  return {
    documentId: value.documentId,
    result: "Disposable deletion",
    status: "success",
    title: value.title,
  };
};

export { getEveDocumentRevision, removeEveDocumentFromConversation };
