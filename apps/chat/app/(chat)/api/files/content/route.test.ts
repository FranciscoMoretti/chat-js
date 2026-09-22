import { beforeEach, expect, test, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  principal: vi.fn(),
  serve: vi.fn(),
}));
vi.mock("@/lib/db/eve-files", () => ({
  canReadEveFile: mocks.access,
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/file-content-response", () => ({
  createFileContentResponse: mocks.serve,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ ownerId: "owner" });
  mocks.serve.mockResolvedValue(new Response("file"));
});
const key = "abcdefghijklmnopqrstuvwx.png";
test("a deletion fence denies storage redirects and bytes even if an object reappears", async () => {
  mocks.access.mockResolvedValue({ allowed: false, managed: true });
  const response = await GET(
    new Request(`http://localhost/api/files/content?key=${key}`)
  );
  expect(response.status).toBe(404);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.access).toHaveBeenCalledWith(key, "owner");
  expect(mocks.serve).not.toHaveBeenCalled();
});
test.each([true, false])(
  "authorized managed=%s files use the correct storage access",
  async (managed) => {
    mocks.access.mockResolvedValue({ allowed: true, managed });
    const request = new Request(
      `http://localhost/api/files/content?key=${key}`
    );
    const resolvedResult1 = await GET(request);
    expect(resolvedResult1.status).toBe(200);
    expect(mocks.serve).toHaveBeenCalledWith(request, {
      allowRedirect: !managed,
    });
  }
);
