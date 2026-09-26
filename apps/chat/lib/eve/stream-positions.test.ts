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
  vi.resetAllMocks();
  mocks.env.VERCEL = "";
  mocks.env.VERCEL_ENV = "";
  mocks.env.WORKFLOW_POSTGRES_URL = "postgres://localhost/workflow";
});

it("never queries PostgreSQL on Vercel, including when a stale URL remains", async () => {
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "production";
  expect(await getEveStreamPositions(["session"])).toEqual(new Map());
  expect(mocks.positions).not.toHaveBeenCalled();
});

it("uses exact PostgreSQL positions locally and propagates backend failure", async () => {
  const positions = new Map([["session", 42]]);
  mocks.positions.mockResolvedValueOnce(positions);
  expect(await getEveStreamPositions(["session"])).toEqual(positions);
  expect(mocks.positions).toHaveBeenCalledWith(
    mocks.env.WORKFLOW_POSTGRES_URL,
    ["session"]
  );
  mocks.positions.mockRejectedValueOnce(new Error("unavailable"));
  await expect(getEveStreamPositions(["session"])).rejects.toThrow(
    "unavailable"
  );
});

it("never falls back to the application database when the local URL is missing", async () => {
  mocks.env.WORKFLOW_POSTGRES_URL = "";
  await expect(getEveStreamPositions(["session"])).rejects.toThrow(
    "WORKFLOW_POSTGRES_URL"
  );
  expect(mocks.positions).not.toHaveBeenCalled();
});
