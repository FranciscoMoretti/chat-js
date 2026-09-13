import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ serve: vi.fn(), unavailable: vi.fn() }));
vi.mock("@/lib/db/eve-files", () => ({
  isEveFileUnavailable: mocks.unavailable,
}));
vi.mock("@/lib/env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost/fixture" },
}));
vi.mock("@/lib/file-content-response", () => ({
  createFileContentResponse: mocks.serve,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.serve.mockResolvedValue(new Response("file"));
});
const key = "abcdefghijklmnopqrstuvwx.png";
test("a deletion fence denies storage redirects and bytes even if an object reappears", async () => {
  mocks.unavailable.mockResolvedValue(true);
  const response = await GET(
    new Request(`http://localhost/api/files/content?key=${key}`)
  );
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.unavailable).toHaveBeenCalledWith(key);
  expect(mocks.serve).not.toHaveBeenCalled();
});
test("active EVE and legacy URLs retain the existing content behavior", async () => {
  mocks.unavailable.mockResolvedValue(false);
  const request = new Request(`http://localhost/api/files/content?key=${key}`);
  const resolvedResult1 = await GET(request);
  expect(resolvedResult1.status).toBe(200);
  expect(mocks.serve).toHaveBeenCalledWith(request);
});
