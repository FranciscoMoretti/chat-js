import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "@/app/api/cron/cleanup/route";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  env: { CRON_SECRET: "scheduler-secret" },
}));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("./job", () => ({ runCleanupJob: mocks.run }));
beforeEach(() => {
  vi.resetAllMocks();
  mocks.env.CRON_SECRET = "scheduler-secret";
});
test.each([null, "Bearer wrong-secret"])(
  "unauthorized schedulers cannot start cleanup (%s)",
  async (authorization) => {
    const headers = new Headers();
    if (authorization !== null) {
      headers.set("authorization", authorization);
    }
    const response = await GET({ headers });
    expect(response.status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  }
);
test("a missing configured secret cannot authorize cleanup", async () => {
  mocks.env.CRON_SECRET = "";
  const response = await GET({
    headers: new Headers({ authorization: "Bearer " }),
  });
  expect(response.status).toBe(401);
  expect(mocks.run).not.toHaveBeenCalled();
});
test.each([
  [true, 200],
  [false, 503],
] as const)(
  "authenticated cleanup reports completion=%s with status %s",
  async (success, status) => {
    mocks.run.mockResolvedValue({ success, results: {}, timestamp: "fixture" });
    const response = await GET({
      headers: new Headers({ authorization: "Bearer scheduler-secret" }),
    });
    expect(response.status).toBe(status);
    expect(mocks.run).toHaveBeenCalledOnce();
  }
);
