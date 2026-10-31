import { getPublicEveTranscript } from "@/chatjs/plugins/sharing/public-conversation";
import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  snapshot: vi.fn(),
  receipts: vi.fn().mockResolvedValue([]),
  project: vi.fn().mockReturnValue([]),
}));
vi.mock("@/chatjs/plugins/sharing/queries", () => ({
  getPublicEveConversation: mocks.lookup,
}));
vi.mock("@/lib/db/eve-dispatch", () => ({
  getEveMessageDisplayReceipts: mocks.receipts,
}));
vi.mock("@/lib/eve/server", () => ({ assertEveConfigured: vi.fn() }));
vi.mock("@/lib/eve/connection-options", () => ({
  getEveConnectionOptions: vi.fn(),
}));
vi.mock("@/lib/eve/shared-messages", () => ({
  sharedEveMessages: mocks.project,
}));
vi.mock("eve/client", () => ({
  Client: class {
    sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
  },
}));
const row = {
  id: "conversation",
  ownerId: "owner",
  sessionId: "session",
  title: "Shared",
  firstMessage: "Hello",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.lookup.mockReset();
  mocks.snapshot.mockResolvedValue({ events: [] });
});
test("revocation during snapshot retrieval prevents disclosure", async () => {
  mocks.lookup.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
  expect(await getPublicEveTranscript(row.id)).toBeNull();
  expect(mocks.snapshot).toHaveBeenCalledOnce();
  expect(mocks.project).not.toHaveBeenCalled();
});
test("private or missing shares never open a runtime session", async () => {
  mocks.lookup.mockResolvedValue(null);
  expect(await getPublicEveTranscript(row.id)).toBeNull();
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
