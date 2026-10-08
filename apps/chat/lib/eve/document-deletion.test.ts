/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context"; "../../tools/chatjs/delete-document/execute" dependency within this package instead of introducing an alias or barrel API.
 */
import { beforeEach, expect, it, vi } from "vitest";

import {
  executeDocumentDeletion,
  requestDocumentDeletion,
} from "../../tools/chatjs/delete-document/execute";
import { testToolContext } from "../../tests/helpers/eve-tool-context";
/* oxlint-enable import/no-relative-parent-imports */

const mocks = vi.hoisted(() => ({
  kinds: new Set(["code", "text"]),
  read: vi.fn(),
  remove: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock("@/tools/chatjs/installed-features", () => ({
  installedDocumentKinds: mocks.kinds,
}));
vi.mock("../db/eve-documents", () => ({
  getEveDocumentRevision: mocks.read,
  removeEveDocumentFromConversation: mocks.remove,
}));
vi.mock("./conversation-scope", () => ({
  resolveEveConversationScope: mocks.resolve,
}));

const input = {
  documentId: "60dbe86a-b2c4-4d32-ae09-a00e90b84e99",
  expectedRevisionId: "663ccf42-10c9-453f-b9da-ebf684a6da97",
  title: "Orchard notes",
};
const identity = {
  authenticator: "test",
  principalId: "owner",
  principalType: "user",
};
/* oxlint-disable unicorn/no-null --
 * unicorn/no-null (#570): context preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const context = testToolContext({
  session: {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    auth: { current: null, initiator: { ...identity, attributes: {} } },
    id: "native-session",
    turn: { id: "turn", sequence: 1 },
  },
});
/* oxlint-enable unicorn/no-null */

beforeEach(() => {
  vi.resetAllMocks();
  mocks.kinds.clear();
  mocks.kinds.add("code");
  mocks.kinds.add("text");
  mocks.resolve.mockResolvedValue({
    conversationId: "conversation",
    ownerId: "owner",
  });
  mocks.read.mockResolvedValue({
    id: input.expectedRevisionId,
    kind: "text",
    title: input.title,
  });
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-undefined --
 * no-undefined (#519): it("requests native approval only for the current owned title and revision") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
it("requests native approval only for the current owned title and revision", async () => {
  await expect(requestDocumentDeletion(input, context)).resolves.toBe(
    "user-approval"
  );
  expect(mocks.resolve).toHaveBeenCalledWith(
    "owner",
    "native-session",
    context.abortSignal
  );
  expect(mocks.read).toHaveBeenCalledWith(
    "owner",
    "conversation",
    input.documentId
  );
  await expect(
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    requestDocumentDeletion({ ...input, title: "Misleading title" }, context)
  ).rejects.toThrow("Document changed");
  mocks.read.mockResolvedValue(undefined);
  await expect(requestDocumentDeletion(input, context)).rejects.toThrow(
    "Document not found"
  );
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

it("requires an owner receipt before performing the conditional deletion", async () => {
  await expect(executeDocumentDeletion(input, context)).rejects.toThrow(
    "owner's approval"
  );
  await expect(
    executeDocumentDeletion(input, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...context,
      approval: {
        requestId: "approval",
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        responder: { ...identity, principalId: "other" },
      },
    })
  ).rejects.toThrow("owner's approval");
  expect(mocks.remove).not.toHaveBeenCalled();
  await executeDocumentDeletion(input, {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...context,
    approval: { requestId: "approval", responder: identity },
  });
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(
    input,
    { conversationId: "conversation", ownerId: "owner" },
    context.abortSignal
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("rejects absent document implementations before requesting approval or executing", async () => {
  mocks.kinds.clear();
  await expect(requestDocumentDeletion(input, context)).rejects.toThrow(
    "unavailable"
  );
  await expect(executeDocumentDeletion(input, context)).rejects.toThrow(
    "unavailable"
  );
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
it("rechecks kind availability after approval", async () => {
  mocks.kinds.delete("text");
  await expect(requestDocumentDeletion(input, context)).rejects.toThrow(
    "Document not found."
  );
  await expect(
    executeDocumentDeletion(input, {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing context own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...context,
      approval: { requestId: "approval", responder: identity },
    })
  ).rejects.toThrow("disabled for this kind");
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
