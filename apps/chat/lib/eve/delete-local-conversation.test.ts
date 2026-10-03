import { beforeEach, expect, test, vi } from "vitest";

import { deleteLocalEveConversationFamily } from "./delete-local-conversation";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  native: vi.fn(),
  resources: vi.fn(),
  retire: vi.fn(),
}));
vi.mock("../env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost/fixture" },
}));
vi.mock("../db/eve-deletion", () => ({
  completeEveConversationDeletion: mocks.complete,
}));
vi.mock("../db/eve-native-purge", () => ({
  purgeEveNativeSession: mocks.native,
}));
vi.mock("./purge-local-resources", () => ({
  purgeLocalEveFamilyResources: mocks.resources,
}));
vi.mock("./retire-session", () => ({
  retireEveSessionForDeletion: mocks.retire,
}));
const family = {
  conversations: [
    { id: "root", sessionId: "session-root" },
    { id: "branch", sessionId: "session-branch" },
  ],
  rootId: "root",
};
/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resources.mockResolvedValue(family);
  mocks.native.mockResolvedValue(undefined);
  mocks.complete.mockResolvedValue(undefined);
});
/* oxlint-enable no-undefined */

/* oxlint-disable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * max-statements (#512): test("all resources and native family payloads finish before the application tombston keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("all resources and native family payloads finish before the application tombston uses 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("all resources and native family payloads finish before the application tombston uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("all resources and native family payloads finish before the application tombston sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("all resources and native family payloads finish before the application tombston accepts call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("all resources and native family payloads finish before the application tombstone", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.native.mockImplementationOnce(async (_url, _scope, retire) => {
    // oxlint-disable-next-line typescript/no-unsafe-call -- #596: This delete-local-conversation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    await retire();
  });
  mocks.native.mockReturnValueOnce(gate.promise);
  const deletion = deleteLocalEveConversationFamily(
    "owner",
    "branch",
    "/trusted/app"
  );
  await vi.waitFor(() => expect(mocks.native).toHaveBeenCalledTimes(2));
  expect(mocks.resources).toHaveBeenCalledWith(
    "owner",
    "branch",
    "/trusted/app"
  );
  expect(mocks.retire).toHaveBeenCalledWith("owner", "session-root");
  // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This delete-local-conversation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This delete-local-conversation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.native.mock.calls.map((call) => call[1].sessionId)).toEqual([
    "session-root",
    "session-branch",
  ]);
  expect(mocks.complete).not.toHaveBeenCalled();
  gate.resolve(undefined);
  expect(await deletion).toEqual({ rootId: "root" });
  expect(mocks.complete).toHaveBeenCalledWith("owner", "root");
});
/* oxlint-enable max-statements, no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): test("resource uncertainty prevents any native payload erasure") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("resource uncertainty prevents any native payload erasure", async () => {
  mocks.resources.mockRejectedValue(new Error("uncertain allocation"));
  await expect(
    deleteLocalEveConversationFamily("owner", "root", "/app")
  ).rejects.toThrow("uncertain allocation");
  expect(mocks.native).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types --
 * no-magic-numbers (#517): test("partial native purge retains pending state and retry runs the full ordering aga uses 2, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): test("partial native purge retains pending state and retry runs the full ordering aga uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("partial native purge retains pending state and retry runs the full ordering aga sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): test("partial native purge retains pending state and retry runs the full ordering aga accepts call; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
test("partial native purge retains pending state and retry runs the full ordering again", async () => {
  mocks.native
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("branch unavailable"));
  await expect(
    deleteLocalEveConversationFamily("owner", "root", "/app")
  ).rejects.toThrow("branch unavailable");
  expect(mocks.complete).not.toHaveBeenCalled();
  expect(
    await deleteLocalEveConversationFamily("owner", "root", "/app")
  ).toEqual({ rootId: "root" });
  expect(mocks.resources).toHaveBeenCalledTimes(2);
  // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This delete-local-conversation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This delete-local-conversation fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.native.mock.calls.map((call) => call[1].sessionId)).toEqual([
    "session-root",
    "session-branch",
    "session-root",
    "session-branch",
  ]);
});
/* oxlint-enable no-magic-numbers, no-undefined, oxc/no-async-await, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined, oxc/no-async-await --
 * no-undefined (#519): test("foreign or missing families cannot erase native or application data") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * oxc/no-async-await (#540): test("foreign or missing families cannot erase native or application data") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("foreign or missing families cannot erase native or application data", async () => {
  mocks.resources.mockResolvedValue(undefined);
  expect(
    await deleteLocalEveConversationFamily("foreign", "root", "/app")
  ).toBeUndefined();
  expect(mocks.native).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
});
/* oxlint-enable no-undefined, oxc/no-async-await */

/* oxlint-disable oxc/no-async-await --
 * oxc/no-async-await (#540): test("an already deleted family is idempotent without resetting native sessions") sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 */
test("an already deleted family is idempotent without resetting native sessions", async () => {
  mocks.resources.mockResolvedValue({ conversations: [], rootId: "root" });
  expect(
    await deleteLocalEveConversationFamily("owner", "root", "/app")
  ).toEqual({ rootId: "root" });
  expect(mocks.native).not.toHaveBeenCalled();
  expect(mocks.retire).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
