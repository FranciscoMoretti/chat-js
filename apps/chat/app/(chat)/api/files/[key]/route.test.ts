import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET as getPathFile } from "./route";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  principal: vi.fn(),
  serve: vi.fn(),
}));
vi.mock("@/lib/db/eve-files", () => ({ canReadEveFile: mocks.access }));
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

describe("file route", () => {
  const request = new Request(
    `http://localhost/api/files/${key}?dpl=dpl_test&other=ignored`
  );
  const getFile = () =>
    getPathFile(request, { params: Promise.resolve({ key }) });

  test("a deletion fence denies storage redirects and bytes", async () => {
    mocks.access.mockResolvedValue({ allowed: false, managed: true });
    const response = await getFile();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.access).toHaveBeenCalledWith(key, "owner");
    expect(mocks.serve).not.toHaveBeenCalled();
  });

  test.each([true, false])(
    "authorized managed=%s files use the correct storage access",
    async (managed) => {
      mocks.access.mockResolvedValue({ allowed: true, managed });
      const response = await getFile();
      expect(response.status).toBe(200);
      expect(mocks.access).toHaveBeenCalledWith(key, "owner");
      expect(mocks.serve).toHaveBeenCalledWith(request, key, {
        allowRedirect: !managed,
      });
    }
  );
});

test("invalid path keys are rejected before authorization", async () => {
  const pathResponse = await getPathFile(
    new Request("http://localhost/api/files/invalid"),
    {
      params: Promise.resolve({ key: "invalid" }),
    }
  );
  expect(pathResponse.status).toBe(400);
  expect(mocks.access).not.toHaveBeenCalled();
  expect(mocks.serve).not.toHaveBeenCalled();
});
