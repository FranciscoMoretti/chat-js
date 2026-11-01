import { beforeEach, expect, it, vi } from "vitest";
import { checkDatabase } from "./health";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("./client", () => ({ db: { execute: mocks.execute } }));

beforeEach(() => {
  mocks.execute.mockReset();
});

it("shares one database query across concurrent probes and releases it on success", async () => {
  const query = Promise.withResolvers<string>();
  mocks.execute.mockReturnValueOnce(query.promise).mockResolvedValue("healthy");
  const first = checkDatabase();
  const second = checkDatabase();
  expect(mocks.execute).toHaveBeenCalledOnce();
  query.resolve("healthy");
  await Promise.all([first, second]);
  await checkDatabase();
  expect(mocks.execute).toHaveBeenCalledTimes(2);
});

it("releases a failed shared query so the next probe can retry", async () => {
  const query = Promise.withResolvers<string>();
  const error = new Error("database unavailable");
  mocks.execute.mockReturnValueOnce(query.promise).mockResolvedValue("healthy");
  const probes = Promise.allSettled([checkDatabase(), checkDatabase()]);
  expect(mocks.execute).toHaveBeenCalledOnce();
  query.reject(error);
  expect(await probes).toEqual([
    { status: "rejected", reason: error },
    { status: "rejected", reason: error },
  ]);
  await checkDatabase();
  expect(mocks.execute).toHaveBeenCalledTimes(2);
});
