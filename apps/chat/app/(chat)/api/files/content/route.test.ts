import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GET as getPathFile } from "../[key]/route";
import { GET as getLegacyFile } from "./route";

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

describe.each(["path", "legacy"])("%s file route", (format) => {
  const request = new NextRequest(
    format === "path"
      ? `http://localhost/api/files/${key}?dpl=dpl_test&other=ignored`
      : `http://localhost/api/files/content?key=${key}&dpl=dpl_test&other=ignored`
  );
  const getFile = () =>
    format === "path"
      ? getPathFile(request, { params: Promise.resolve({ key }) })
      : getLegacyFile(request);

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

test("invalid path keys and duplicate legacy keys are rejected before authorization", async () => {
  const pathResponse = await getPathFile(
    new Request("http://localhost/api/files/invalid"),
    {
      params: Promise.resolve({ key: "invalid" }),
    }
  );
  const legacyResponse = await getLegacyFile(
    new NextRequest(`http://localhost/api/files/content?key=${key}&key=${key}`)
  );
  expect(pathResponse.status).toBe(400);
  expect(legacyResponse.status).toBe(400);
  expect(mocks.access).not.toHaveBeenCalled();
  expect(mocks.serve).not.toHaveBeenCalled();
});
