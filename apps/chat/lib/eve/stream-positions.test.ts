import { expect, it, vi } from "vitest";

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

it("never queries PostgreSQL on Vercel, including when a stale URL remains", async () => {
  mocks.env.VERCEL = "1";
  mocks.env.VERCEL_ENV = "production";
  expect(await getEveStreamPositions(["session"])).toEqual(new Map());
  expect(mocks.positions).not.toHaveBeenCalled();
});
