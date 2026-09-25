import { beforeEach, expect, test, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ register: vi.fn(), upload: vi.fn() }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: () => ({ user: { id: "owner" } }) } },
}));
vi.mock("@/lib/config", () => ({
  config: { features: { attachments: true } },
}));
vi.mock("@/lib/env", () => ({
  env: { WORKFLOW_POSTGRES_URL: "postgresql://localhost/fixture" },
}));
vi.mock("@/lib/db/eve-files", () => ({
  reserveEveUpload: mocks.register,
  writeEveUpload: async (
    _owner: string,
    _key: string,
    write: () => Promise<unknown>
  ) => await write(),
}));
vi.mock("@/lib/file-storage", () => ({
  createFileStorageKey: () => "abcdefghijklmnopqrstuvwx.png",
  uploadFileAtKey: mocks.upload,
}));

const key = "abcdefghijklmnopqrstuvwx.png";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.upload.mockResolvedValue({
    contentType: "image/png",
    pathname: "fixture.png",
    url: `/api/files/${key}`,
  });
});
const request = () => {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["fixture"], { type: "image/png" }),
    "fixture.png"
  );
  return new Request("http://localhost/api/files/upload", {
    body: form,
    method: "POST",
  });
};
test("records the authenticated owner of a server-created storage key before returning it", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.register).toHaveBeenCalledWith("owner", key);
  expect(await response.json()).toMatchObject({
    url: `/api/files/${key}`,
  });
});
test("does not return a usable upload when ownership registration fails", async () => {
  mocks.register.mockRejectedValue(new Error("database unavailable"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Upload failed" });
  expect(mocks.upload).not.toHaveBeenCalled();
});

test("waits for durable ownership before starting storage I/O", async () => {
  const gate = Promise.withResolvers<undefined>();
  mocks.register.mockImplementation(() => gate.promise);
  const response = POST(request());
  await vi.waitFor(() =>
    expect(mocks.register).toHaveBeenCalledWith("owner", key)
  );
  expect(mocks.upload).not.toHaveBeenCalled();
  gate.resolve(undefined);
  const resolvedResult1 = await response;
  expect(resolvedResult1.status).toBe(200);
  expect(mocks.upload).toHaveBeenCalledWith(
    key,
    "fixture.png",
    expect.any(ArrayBuffer),
    "image/png"
  );
});

test("retains the reserved identity after an uncertain storage failure", async () => {
  mocks.upload.mockRejectedValue(new Error("storage response lost"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(mocks.register).toHaveBeenCalledExactlyOnceWith("owner", key);
  expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(
    key,
    "fixture.png",
    expect.any(ArrayBuffer),
    "image/png"
  );
});
