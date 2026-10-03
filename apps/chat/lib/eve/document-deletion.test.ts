/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../tests/helpers/eve-tool-context"; "../../tools/chatjs/delete-document/execute" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { beforeEach, expect, it, vi } from "vitest";

import { testToolContext } from "../../tests/helpers/eve-tool-context";
import {
  executeDocumentDeletion,
  requestDocumentDeletion,
} from "../../tools/chatjs/delete-document/execute";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

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
/* oxlint-disable oxc/no-rest-spread-properties, unicorn/no-null --
 * oxc/no-rest-spread-properties (#543): context copies or separates ...identity while preserving existing object ownership; mutating source objects is not equivalent.
 * unicorn/no-null (#570): context preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
const context = testToolContext({
  session: {
    auth: { current: null, initiator: { ...identity, attributes: {} } },
    id: "native-session",
    turn: { id: "turn", sequence: 1 },
  },
});
/* oxlint-enable oxc/no-rest-spread-properties, unicorn/no-null */

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

/* oxlint-disable no-undefined, oxc/no-async-await, oxc/no-rest-spread-properties --
 * no-undefined (#519): it("requests native approval only for the current owned title and revision") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): it("requests native approval only for the current owned title and revision") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("requests native approval only for the current owned title and revision") copies or separates ...input while preserving existing object ownership; mutating source objects is not equivalent.
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
    requestDocumentDeletion({ ...input, title: "Misleading title" }, context)
  ).rejects.toThrow("Document changed");
  mocks.read.mockResolvedValue(undefined);
  await expect(requestDocumentDeletion(input, context)).rejects.toThrow(
    "Document not found"
  );
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable no-undefined, oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("requires an owner receipt before performing the conditional deletion") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("requires an owner receipt before performing the conditional deletion") copies or separates ...context; ...identity while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("requires an owner receipt before performing the conditional deletion", async () => {
  await expect(executeDocumentDeletion(input, context)).rejects.toThrow(
    "owner's approval"
  );
  await expect(
    executeDocumentDeletion(input, {
      ...context,
      approval: {
        requestId: "approval",
        responder: { ...identity, principalId: "other" },
      },
    })
  ).rejects.toThrow("owner's approval");
  expect(mocks.remove).not.toHaveBeenCalled();
  await executeDocumentDeletion(input, {
    ...context,
    approval: { requestId: "approval", responder: identity },
  });
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(
    input,
    { conversationId: "conversation", ownerId: "owner" },
    context.abortSignal
  );
});
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): it("rejects absent document implementations before requesting approval or executing") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
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

/* oxlint-disable oxc/no-async-await, oxc/no-rest-spread-properties --
 * oxc/no-async-await (#540): it("rechecks kind availability after approval") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): it("rechecks kind availability after approval") copies or separates ...context while preserving existing object ownership; mutating source objects is not equivalent.
 */
it("rechecks kind availability after approval", async () => {
  mocks.kinds.delete("text");
  await expect(requestDocumentDeletion(input, context)).rejects.toThrow(
    "Document not found."
  );
  await expect(
    executeDocumentDeletion(input, {
      ...context,
      approval: { requestId: "approval", responder: identity },
    })
  ).rejects.toThrow("disabled for this kind");
  expect(mocks.remove).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await, oxc/no-rest-spread-properties */
