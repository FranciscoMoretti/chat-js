import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "storage-test" },
}));

vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: () => memory(),
  };
});

import { deleteFilesByUrls, listFiles, uploadFile } from "./file-storage";
import { keyFromFileUrl } from "./file-url";

describe("file storage", () => {
  it("uploads, lists, and deletes through Files SDK", async () => {
    const uploaded = await uploadFile("../hello.txt", "hello", "text/plain");
    const key = keyFromFileUrl(uploaded.url);

    assert(key);
    assert.equal(uploaded.pathname, "hello.txt");
    assert.equal(uploaded.contentType, "text/plain");
    assert.equal(uploaded.url, `/api/files/content?key=${key}`);
    assert.deepEqual(
      (await listFiles()).files.map((file) => file.pathname),
      [key]
    );

    const previousDeploymentUrl = new URL(
      uploaded.url,
      "https://old-chat.example"
    ).toString();
    await deleteFilesByUrls([previousDeploymentUrl]);
    assert.equal((await listFiles()).files.length, 0);
  });
});
