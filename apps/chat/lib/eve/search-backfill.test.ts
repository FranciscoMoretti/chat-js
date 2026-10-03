import { beforeEach, expect, it, vi } from "vitest";

import { backfillEveSearchConversation } from "./search-backfill";

const mocks = vi.hoisted(() => ({
  index: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("../db/eve-search", () => ({ indexEveSearchText: mocks.index }));
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.snapshot.mockResolvedValue({
    events: [
      {
        data: {
          messages: Array.from({ length: 300 }, (_, index) => ({
            parts: [{ text: `Restored message ${index}`, type: "text" }],
            role: "user",
          })),
        },
        type: "history.seeded",
      },
      {
        data: { message: "Newest message" },
        meta: { id: "latest" },
        type: "message.received",
      },
    ],
  });
});

it("recovers every restored entry and the latest message, and can retry after a partial failure", async () => {
  mocks.index
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error("offline"));
  await expect(
    backfillEveSearchConversation("owner", "branch", "session")
  ).rejects.toThrow("offline");
  mocks.index.mockReset();
  await backfillEveSearchConversation("owner", "branch", "session");
  expect(mocks.index).toHaveBeenCalledTimes(4);
  expect(
    // oxlint-disable-next-line typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This search-backfill fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This search-backfill fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
    mocks.index.mock.calls.slice(0, 3).map((call) => call[2].length)
  ).toEqual([100, 100, 100]);
  // oxlint-disable-next-line typescript/no-unsafe-return -- #598: This search-backfill fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration.
  expect(mocks.index.mock.calls.flatMap((call) => call[2])).toEqual([
    ...Array.from({ length: 300 }, (_, index) => ({
      key: `seed:${index}`,
      text: `Restored message ${index}`,
    })),
    { key: "event:latest", text: "Newest message" },
  ]);
  expect(mocks.index).toHaveBeenLastCalledWith("owner", "branch", [
    { key: "event:latest", text: "Newest message" },
  ]);
});
