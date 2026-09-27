import assert from "node:assert/strict";

import { describe, it, vi } from "vitest";

import { fileIdsForStorageKeys } from "./db/file-storage-keys";
import {
  deleteFilesByUrls,
  listFiles,
  createFileId,
  uploadFileAtKey,
} from "./file-storage";
import { keyFromFileUrl } from "./file-url";

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "storage-test" },
}));

vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: () => memory(),
  };
});

describe("file storage", () => {
  it("uploads, lists, and deletes through Files SDK", async () => {
    const uploaded = await uploadFileAtKey(
      createFileId(),
      "../hello.txt",
      "hello",
      "text/plain"
    );
    const key = keyFromFileUrl(uploaded.url);

    assert.ok(key);
    assert.equal(uploaded.pathname, "hello.txt");
    assert.equal(uploaded.contentType, "text/plain");
    assert.equal(uploaded.url, `/api/files/${key}`);
    const uploadedFiles = await listFiles();
    assert.deepEqual(
      uploadedFiles.files.map((file) => file.pathname),
      [key]
    );

    const previousDeploymentUrl = new URL(
      uploaded.url,
      "https://old-chat.example"
    ).toString();
    await deleteFilesByUrls([previousDeploymentUrl]);
    const remainingFiles = await listFiles();
    assert.equal(remainingFiles.files.length, 0);
  });
  it("lists across page boundaries with one mapping query per page", async () => {
    const uploads = await Promise.all(
      Array.from({ length: 101 }, () =>
        uploadFileAtKey(createFileId(), "file.txt", "content", "text/plain")
      )
    );
    vi.mocked(fileIdsForStorageKeys).mockClear();
    try {
      const { files } = await listFiles();
      assert.deepEqual(
        new Set(files.map((file) => file.url)),
        new Set(uploads.map((file) => file.url))
      );
      assert.deepEqual(
        vi
          .mocked(fileIdsForStorageKeys)
          .mock.calls.map(([keys]) => keys.length),
        [100, 1]
      );
    } finally {
      await deleteFilesByUrls(uploads.map((file) => file.url));
    }
  });
});

vi.mock("./db/file-storage-keys", () => ({
  fileIdsForStorageKeys: vi.fn((keys: string[]) =>
    Promise.resolve(
      new Map(keys.map((key) => [key, key.slice("objects/".length)]))
    )
  ),
  storageKeyForFile: (id: string) => Promise.resolve(`objects/${id}`),
}));
