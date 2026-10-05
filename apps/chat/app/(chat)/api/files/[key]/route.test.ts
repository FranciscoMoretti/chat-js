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
/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 404); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity. */

describe("file route", () => {
  const request = new Request(
    `http://localhost/api/files/${key}?dpl=dpl_test&other=ignored`
  );
  const getFile = () =>
    getPathFile(request, { params: Promise.resolve({ key }) });

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test("a deletion fence denies storage redirects and bytes", async () => {
    mocks.access.mockResolvedValue({ allowed: false, managed: true });
    const response = await getFile();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.access).toHaveBeenCalledWith(key, "owner");
    expect(mocks.serve).not.toHaveBeenCalled();
  });
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([true, false])'s awaited sequencing and rejected-Promise behavior. */
  test.each([true, false])(
    "authorized managed=%s files use the correct storage access",
    async (managed) => {
      mocks.access.mockResolvedValue({ allowed: true, managed });
      const response = await getFile();
      expect(response.status).toBe(managed ? 200 : 404);
      if (!managed) {
        expect(mocks.serve).not.toHaveBeenCalled();
        return;
      }
      expect(mocks.access).toHaveBeenCalledWith(key, "owner");
      expect(mocks.serve).toHaveBeenCalledWith(request, key, {
        allowRedirect: true,
      });
    }
  );
  /* oxlint-enable oxc/no-async-await */
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type, typescript/promise-function-async */

/* oxlint-disable no-magic-numbers -- route.test route: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 400);  */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers */
