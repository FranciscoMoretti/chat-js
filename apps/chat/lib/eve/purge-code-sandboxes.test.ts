import { beforeEach, expect, test, vi } from "vitest";

import { eveCodeSandboxName } from "./code-sandbox-name";
import { purgeEveFamilyCodeSandboxes } from "./purge-code-sandboxes";

const mocks = vi.hoisted(() => ({
  capabilityInstalled: true,
  cleanup: vi.fn(),
  createCleanupSession: vi.fn(),
  list: vi.fn(),
  record: vi.fn(),
}));
vi.mock("../../tools/chatjs/tools", () => ({
  tools: { codeExecution: {} },
}));
/* oxlint-disable no-undefined, typescript/explicit-function-return-type --
 * no-undefined (#519): vi.mock("../ai/installed-tool-capabilities") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * typescript/explicit-function-return-type (#560): Keep vi.mock("../ai/installed-tool-capabilities")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("../ai/installed-tool-capabilities", () => ({
  getCodeSandboxCleanup: () =>
    mocks.capabilityInstalled
      ? { createCleanupSession: mocks.createCleanupSession }
      : undefined,
}));
/* oxlint-enable no-undefined, typescript/explicit-function-return-type */
vi.mock("../db/eve-code-sandboxes", () => ({
  listEveCodeSandboxesForDeletion: mocks.list,
  recordEveCodeSandboxDeletion: mocks.record,
}));

const provider = { projectId: "project", teamId: "team" };
const name = eveCodeSandboxName({
  callId: "call",
  ownerId: "owner",
  provider,
  sessionId: "session",
});
const resource = {
  callId: "call",
  conversationId: "conversation",
  creationConfirmed: true,
  name,
  sessionId: "session",
};

/* oxlint-disable no-undefined --
 * no-undefined (#519): beforeEach uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
beforeEach(() => {
  vi.resetAllMocks();
  mocks.capabilityInstalled = true;
  mocks.createCleanupSession.mockReturnValue({
    deleteAndConfirmAbsent: mocks.cleanup,
    provider,
  });
  mocks.list.mockResolvedValue([resource]);

  mocks.record.mockResolvedValue(undefined);

  mocks.cleanup.mockResolvedValue(undefined);
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-undefined */

test("cleans confirmed ownership and releases its durable record", async () => {
  await purgeEveFamilyCodeSandboxes("owner", "root");
  expect(mocks.cleanup).toHaveBeenCalledWith(name);
  expect(mocks.record).toHaveBeenCalledWith("owner", "conversation", name);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("a retry accepts provider-confirmed absence", async () => {
  await purgeEveFamilyCodeSandboxes("owner", "root");
  expect(mocks.cleanup).toHaveBeenCalledOnce();
  expect(mocks.record).toHaveBeenCalledOnce();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("unknown creation never uses absence to declare deletion complete", async () => {
  mocks.list.mockResolvedValue([{ ...resource, creationConfirmed: false }]);
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "uncertain code sandbox creation"
  );
  expect(mocks.createCleanupSession).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("provider failures retain ownership", async () => {
  mocks.list.mockRejectedValueOnce(new Error("family is active"));
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "family is active"
  );
  expect(mocks.cleanup).not.toHaveBeenCalled();
  mocks.cleanup.mockRejectedValueOnce(new Error("delete failed"));
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "delete failed"
  );
  expect(mocks.record).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("changed provider scope cannot release a resource", async () => {
  mocks.createCleanupSession.mockReturnValue({
    deleteAndConfirmAbsent: mocks.cleanup,
    provider: { ...provider, projectId: "another-project" },
  });
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "provider scope"
  );
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("zero resources need no installed provider capability", async () => {
  mocks.capabilityInstalled = false;
  mocks.list.mockResolvedValue([]);
  await expect(
    purgeEveFamilyCodeSandboxes("owner", "root")
  ).resolves.toBeUndefined();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("durable resources cannot be released without their provider capability", async () => {
  mocks.capabilityInstalled = false;
  await expect(purgeEveFamilyCodeSandboxes("owner", "root")).rejects.toThrow(
    "Install the code execution tool"
  );
  expect(mocks.cleanup).not.toHaveBeenCalled();
  expect(mocks.record).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
