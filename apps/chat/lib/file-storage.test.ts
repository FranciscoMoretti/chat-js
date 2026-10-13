import {
  createFileId,
  deleteFilesByUrls,
  listFiles,
  uploadFileAtKey,
} from "./file-storage";
import { describe, it, vi } from "vitest";
import assert from "node:assert/strict";
import { fileIdsForStorageKeys } from "./db/file-storage-keys";
import { keyFromFileUrl } from "./file-url";

vi.mock("@/lib/config", () => ({
  config: { appPrefix: "storage-test" },
}));

vi.mock("./storage-provider", async () => {
  const { memory } = await import("files-sdk/memory");
  return {
    createStorageAdapter: (): ReturnType<typeof memory> => memory(),
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

    assert.ok(typeof key === "string" && key !== "");
    assert.equal(uploaded.pathname, "hello.txt");
    assert.equal(uploaded.contentType, "text/plain");
    assert.equal(uploaded.url, `/api/files/${key}`);
    const uploadedFiles = await listFiles();
    assert.deepEqual(
      uploadedFiles.files.map(
        (file: { readonly pathname: string }) => file.pathname
      ),
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

  it("removes only ASCII C0 and DEL characters from upload pathnames", async () => {
    const controlCharacters =
      Array.from({ length: 32 }, (_value, codePoint) =>
        String.fromCodePoint(codePoint)
      ).join("") + String.fromCodePoint(127);
    const c1Controls = Array.from({ length: 32 }, (_value, codePoint) =>
      String.fromCodePoint(codePoint + 128)
    ).join("");
    const preservedCharacters = ` ~${c1Controls}\u200D\u2028🧪`;
    const uploaded = await uploadFileAtKey(
      createFileId(),
      `../pre${controlCharacters}report${preservedCharacters}.txt`,
      "hello",
      "text/plain"
    );

    try {
      assert.equal(uploaded.pathname, `prereport${preservedCharacters}.txt`);
    } finally {
      await deleteFilesByUrls([uploaded.url]);
    }
  });

  it("lists across page boundaries with one mapping query per page", async () => {
    const uploads = await Promise.all(
      Array.from(
        { length: 101 },
        async () =>
          await uploadFileAtKey(
            createFileId(),
            "file.txt",
            "content",
            "text/plain"
          )
      )
    );
    vi.mocked(fileIdsForStorageKeys).mockClear();
    try {
      const { files } = await listFiles();
      assert.deepEqual(
        new Set(files.map((file: { readonly url: string }) => file.url)),
        new Set(uploads.map((file: { readonly url: string }) => file.url))
      );
      assert.deepEqual(
        vi
          .mocked(fileIdsForStorageKeys)
          .mock.calls.map(
            ([keys]: Readonly<[storageKeys: readonly string[]]>) => keys.length
          ),
        [100, 1]
      );
    } finally {
      await deleteFilesByUrls(
        uploads.map((file: { readonly url: string }) => file.url)
      );
    }
  });
});

vi.mock("./db/file-storage-keys", () => ({
  // oxlint-disable-next-line typescript/promise-function-async -- This DB fixture maps each requested storage-key batch to IDs; its Promise-only API and synchronous mapping conflict with eslint/require-await.
  fileIdsForStorageKeys: vi.fn((keys: readonly string[]) =>
    Promise.resolve(
      new Map(keys.map((key) => [key, key.slice("objects/".length)]))
    )
  ),
  // oxlint-disable-next-line typescript/promise-function-async -- This DB fixture derives a storage key per file ID; its Promise-only API has no work to await under eslint/require-await.
  storageKeyForFile: (id: string): Promise<string> =>
    Promise.resolve(`objects/${id}`),
}));
