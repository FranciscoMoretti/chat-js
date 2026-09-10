import { beforeEach, expect, it, vi } from "vitest";
import { retireEveSessionForDeletion } from "./retire-session";

const mocks = vi.hoisted(() => ({
  deleting: vi.fn(),
  reset: vi.fn(),
  snapshot: vi.fn(),
  usage: vi.fn(),
  client: vi.fn(),
}));
vi.mock("../env", () => ({
  env: {
    EVE_INTERNAL_ORIGIN: "http://localhost",
    EVE_GATEWAY_SECRET: "fixture",
  },
}));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("../db/eve-queries", () => ({
  getDeletingEveConversationForSession: mocks.deleting,
}));
vi.mock("./usage", () => ({ ingestEveUsage: mocks.usage }));
vi.mock("eve/client", () => ({
  Client: class {
    constructor(options: unknown) {
      mocks.client(options);
    }
    sessions = {
      attach: () => ({ reset: mocks.reset, snapshot: mocks.snapshot }),
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.deleting.mockResolvedValue({ id: "conversation" });
  mocks.reset.mockResolvedValue({ status: "reset" });
  mocks.snapshot.mockResolvedValue({ events: [{ type: "session.completed" }] });
  mocks.usage.mockResolvedValue(undefined);
});

it("retires before reading and settling the final snapshot, including retries", async () => {
  await retireEveSessionForDeletion("owner", "session");
  expect(mocks.client).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: { "x-chatjs-owner": "owner", "x-chatjs-deletion": "1" },
    })
  );
  expect(mocks.reset.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.snapshot.mock.invocationCallOrder[0]
  );
  mocks.reset.mockResolvedValue({ status: "no_active_session" });
  await expect(
    retireEveSessionForDeletion("owner", "session")
  ).resolves.toMatchObject({ events: [{ type: "session.completed" }] });
});

it("rejects non-deleting or foreign sessions before native access", async () => {
  mocks.deleting.mockResolvedValue(undefined);
  await expect(retireEveSessionForDeletion("owner", "session")).rejects.toThrow(
    "not pending deletion"
  );
  expect(mocks.reset).not.toHaveBeenCalled();
});

it("refuses erasure when retirement or cost settlement is incomplete", async () => {
  mocks.snapshot.mockResolvedValue({ events: [{ type: "step.completed" }] });
  await expect(retireEveSessionForDeletion("owner", "session")).rejects.toThrow(
    "retirement has not completed"
  );
  expect(mocks.usage).not.toHaveBeenCalled();
  mocks.snapshot.mockResolvedValue({
    events: [{ type: "step.completed" }, { type: "session.completed" }],
  });
  mocks.usage.mockImplementation((_owner, _session, event) =>
    Promise.resolve(event.type === "step.completed" ? false : undefined)
  );
  await expect(retireEveSessionForDeletion("owner", "session")).rejects.toThrow(
    "Usage must be reconciled"
  );
});
