import { beforeEach, expect, it, vi } from "vitest";

import { backfillEveSearchConversation } from "./search-backfill";

const mocks = vi.hoisted(() => ({
  index: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("../db/eve-search", () => ({ indexEveSearchText: mocks.index }));
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("./connection-options")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("./connection-options", () => ({
  getEveConnectionOptions: () => ({}),
}));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep vi.mock("eve/client")'s return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
vi.mock("eve/client", () => ({
  Client: class {
    public sessions = { attach: () => ({ snapshot: mocks.snapshot }) };
  },
}));
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable id-length --
 * id-length (#506): beforeEach uses _ as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable id-length */

/* oxlint-disable id-length, no-magic-numbers, no-undefined --
 * id-length (#506): it("recovers every restored entry and the latest message, and can retry after a parti uses _ as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * no-magic-numbers (#517): it("recovers every restored entry and the latest message, and can retry after a parti uses 4, 0, 3, 2, 100 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * no-undefined (#519): it("recovers every restored entry and the latest message, and can retry after a parti uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
    mocks.index.mock.calls.slice(0, 3).map(
      (call: Readonly<(typeof mocks.index.mock.calls)[number]>) =>
        /* oxlint-disable typescript/no-unsafe-return, typescript/no-unsafe-member-access -- #598: This search-backfill fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. #597: This search-backfill fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. */
        call[2].length
      /* oxlint-enable typescript/no-unsafe-return, typescript/no-unsafe-member-access */
    )
  ).toEqual([100, 100, 100]);

  expect(
    mocks.index.mock.calls.flatMap(
      (call: Readonly<(typeof mocks.index.mock.calls)[number]>) =>
        /* oxlint-disable typescript/no-unsafe-return -- #598: This search-backfill fixture inspects controlled mock or JSON payloads; fully modeling the mock boundary requires a separate test-contract migration. */
        call[2]
      /* oxlint-enable typescript/no-unsafe-return */
    )
  ).toEqual([
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable id-length, no-magic-numbers, no-undefined */
