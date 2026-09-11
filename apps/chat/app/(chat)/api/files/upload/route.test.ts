import { beforeEach, expect, test, vi } from "vitest";

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
  registerEveStoredFile: mocks.register,
}));
vi.mock("@/lib/file-storage", () => ({ uploadFile: mocks.upload }));

import { POST } from "./route";

const key = "abcdefghijklmnopqrstuvwx.png";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.upload.mockResolvedValue({
    url: `/api/files/content?key=${key}`,
    pathname: "fixture.png",
    contentType: "image/png",
  });
});
function request() {
  const form = new FormData();
  form.append(
    "file",
    new Blob(["fixture"], { type: "image/png" }),
    "fixture.png"
  );
  return new Request("http://localhost/api/files/upload", {
    method: "POST",
    body: form,
  });
}
test("records the authenticated owner of a server-created storage key before returning it", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(mocks.register).toHaveBeenCalledWith("owner", key);
  expect(await response.json()).toMatchObject({
    url: `/api/files/content?key=${key}`,
  });
});
test("does not return a usable upload when ownership registration fails", async () => {
  mocks.register.mockRejectedValue(new Error("database unavailable"));
  const response = await POST(request());
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Upload failed" });
});
