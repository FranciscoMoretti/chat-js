import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "file-response-test" },
}));

vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: () => memory(),
  };
});

import { createFileContentResponse } from "./file-content-response";
import { uploadFile } from "./file-storage";

describe("file content response", () => {
  it("serves byte ranges", async () => {
    const uploaded = await uploadFile("hello.txt", "hello", "text/plain");

    const response = await createFileContentResponse(
      new Request(new URL(uploaded.url, "https://chat.example"), {
        headers: { Range: "bytes=1-3" },
      })
    );
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 1-3/5");
    assert.equal(await response.text(), "ell");

    const suffixResponse = await createFileContentResponse(
      new Request(new URL(uploaded.url, "https://chat.example"), {
        headers: { Range: "bytes=-2" },
      })
    );
    assert.equal(suffixResponse.status, 206);
    assert.equal(await suffixResponse.text(), "lo");
  });

  it("rejects unsatisfiable ranges", async () => {
    const uploaded = await uploadFile("short.txt", "hi", "text/plain");

    const response = await createFileContentResponse(
      new Request(new URL(uploaded.url, "https://chat.example"), {
        headers: { Range: "bytes=5-8" },
      })
    );

    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */2");
  });
});
