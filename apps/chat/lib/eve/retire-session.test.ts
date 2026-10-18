import { beforeEach, expect, it, vi } from "vitest";

import {
  retireEveFamilyForDeletion,
  retireEveSessionForDeletion,
} from "./retire-session";

vi.mock("./reconcile-subagent-usage", () => ({
  reconcileEveSubagentUsage: vi.fn().mockResolvedValue(true),
}));

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  check: vi.fn(),
  client: vi.fn(),
  deleting: vi.fn(),
  env: {
    EVE_GATEWAY_SECRET: "fixture",
    EVE_INTERNAL_ORIGIN: "http://localhost",
    VERCEL: "",
    VERCEL_ENV: "",
    WORKFLOW_POSTGRES_URL: "postgres://localhost/fixture",
  },
  provider: vi.fn(),
  reset: vi.fn(),
  retireMany: vi.fn(),
  snapshot: vi.fn(),
  usage: vi.fn(),
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("./server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("../db/eve-queries", () => ({
  beginEveConversationDeletion: mocks.begin,
  getDeletingEveConversationForSession: mocks.deleting,
}));
vi.mock("./lifecycle/provider", () => ({
  createEveLifecycleProvider: mocks.provider,
}));
vi.mock("./usage", () => ({ ingestEveUsage: mocks.usage }));
vi.mock("eve/client", () => ({
  Client: class {
    public constructor(options: unknown) {
      mocks.client(options);
    }
    public sessions = {
      attach: () => ({ reset: mocks.reset, snapshot: mocks.snapshot }),
    };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.check.mockReset();
  mocks.env.VERCEL = "";
  mocks.env.VERCEL_ENV = "";
  mocks.provider.mockReturnValue({
    check: mocks.check,
    retire: mocks.retireMany,
    supported: true,
  });
  mocks.deleting.mockResolvedValue({ id: "conversation" });
  mocks.reset.mockResolvedValue({ status: "reset" });
  mocks.snapshot.mockResolvedValue({ events: [{ type: "session.completed" }] });
  mocks.usage.mockResolvedValue(true);
});

it("retires before reading and settling the final snapshot, including retries", async () => {
  await retireEveSessionForDeletion("owner", "session");
  expect(mocks.client).toHaveBeenCalledWith(
    expect.objectContaining({
      headers: { "x-chatjs-deletion": "1", "x-chatjs-owner": "owner" },
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
  mocks.deleting.mockResolvedValue(null);
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
  mocks.usage.mockResolvedValueOnce(false);
  await expect(retireEveSessionForDeletion("owner", "session")).rejects.toThrow(
    "Usage must be reconciled"
  );
});

it("does not enter native family cleanup for an inaccessible family or a missing session binding", async () => {
  mocks.begin.mockResolvedValueOnce(null);
  expect(
    await retireEveFamilyForDeletion("stranger", "conversation")
  ).toBeUndefined();
  expect(mocks.retireMany).not.toHaveBeenCalled();
  mocks.begin.mockResolvedValueOnce({
    conversations: [{ id: "root", sessionId: null }],
    rootId: "root",
  });
  await expect(retireEveFamilyForDeletion("owner", "root")).rejects.toThrow(
    "missing session binding"
  );
  expect(mocks.retireMany).not.toHaveBeenCalled();
});

it("rejects PostgreSQL retirement on Vercel before changing application access", async () => {
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "production";
  mocks.provider.mockReturnValue({
    reason: "unverified erasure",
    supported: false,
    world: "vercel",
  });
  await expect(retireEveFamilyForDeletion("owner", "root")).rejects.toThrow(
    "unverified erasure"
  );
  expect(mocks.provider).toHaveBeenCalledWith({
    databaseUrl: mocks.env.WORKFLOW_POSTGRES_URL,
    world: "vercel",
  });
  expect(mocks.check).not.toHaveBeenCalled();
  expect(mocks.begin).not.toHaveBeenCalled();
  expect(mocks.retireMany).not.toHaveBeenCalled();
});
it("checks provider compatibility before revoking family access", async () => {
  mocks.check.mockRejectedValueOnce(new Error("workflow fences missing"));
  await expect(retireEveFamilyForDeletion("owner", "root")).rejects.toThrow(
    "workflow fences missing"
  );
  expect(mocks.begin).not.toHaveBeenCalled();
  expect(mocks.retireMany).not.toHaveBeenCalled();
  expect(mocks.reset).not.toHaveBeenCalled();
});
