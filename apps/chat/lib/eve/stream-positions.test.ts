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
vi.mock("../db/eve-stream-positions", () => ({
  getEvePostgresStreamPositions: mocks.positions,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.env.VERCEL = "";
  mocks.env.VERCEL_ENV = "";
});

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

it("never queries PostgreSQL on Vercel, including when a stale URL remains", async () => {
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "production";
  expect(await getEveStreamPositions(["session"])).toEqual(new Map());
  expect(mocks.positions).not.toHaveBeenCalled();
});
