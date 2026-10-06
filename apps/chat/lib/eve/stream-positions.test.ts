import { beforeEach, expect, it, vi } from "vitest";

import { getEveStreamPositions } from "./stream-positions";

const mocks = vi.hoisted(() => ({
  env: {
    VERCEL: "",
    VERCEL_ENV: "",
    WORKFLOW_POSTGRES_URL: "postgres://localhost/workflow",
  },
  positions: vi.fn(),
}));
vi.mock("../env", () => ({ env: mocks.env }));
vi.mock("@/lib/eve/lifecycle/postgres/eve-stream-positions", () => ({
  getEvePostgresStreamPositions: mocks.positions,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.VERCEL = "";
  mocks.env.VERCEL_ENV = "";
});

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): it("uses PostgreSQL locally and propagates lookup failures") uses 12 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
it("uses PostgreSQL locally and propagates lookup failures", async () => {
  const positions = new Map([["session", 12]]);
  mocks.positions.mockResolvedValueOnce(positions);
  expect(await getEveStreamPositions(["session"])).toEqual(positions);
  expect(mocks.positions).toHaveBeenCalledWith(
    mocks.env.WORKFLOW_POSTGRES_URL,
    ["session"]
  );
  mocks.positions.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(getEveStreamPositions(["session"])).rejects.toThrow(
    "database unavailable"
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

it("rejects an empty local workflow URL before loading PostgreSQL", async () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "";
  await expect(getEveStreamPositions(["session"])).rejects.toThrow(
    "Configure WORKFLOW_POSTGRES_URL for local workflows."
  );
  expect(mocks.positions).not.toHaveBeenCalled();
});

it("never queries PostgreSQL on Vercel, including when a stale URL remains", async () => {
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "production";
  expect(await getEveStreamPositions(["session"])).toEqual(new Map());
  expect(mocks.positions).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
